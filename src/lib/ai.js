// Client Claude (Anthropic) — toutes les fonctions IA de l'application.
//
// Deux modes, choisis automatiquement :
//   1. Clé personnelle — saisie dans Paramètres > Intégrations
//      (societe.anthropicApiKey) : appel direct depuis le navigateur.
//   2. IA partagée (par défaut) — aucun réglage pour l'utilisateur : les
//      appels passent par la Supabase Edge Function « claude-proxy », qui
//      détient la clé de l'administrateur côté serveur et n'accepte que les
//      utilisateurs connectés. Voir supabase/functions/claude-proxy/.

import { supabase } from './supabase';

const API_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-sonnet-5-5';

function proxyAvailable() {
  return Boolean(supabase);
}

// Mode IA choisi par l'utilisateur dans Paramètres > Intégrations :
//   'partagee'     → IA de l'application (Edge Function, clé de l'administrateur)
//   'personnelle'  → sa propre clé API Anthropic
// Rétrocompatibilité : si rien n'est choisi, une clé saisie vaut « personnelle ».
export function aiMode(societe) {
  return societe?.aiMode || (societe?.anthropicApiKey ? 'personnelle' : 'partagee');
}

// « L'IA est-elle disponible ? » — selon le mode choisi.
export function hasApiKey(societe) {
  return aiMode(societe) === 'personnelle'
    ? Boolean(societe?.anthropicApiKey)
    : proxyAvailable();
}

// Outil « recherche web » d'Anthropic : exécuté côté serveur Anthropic, le
// modèle cherche et cite ses sources — utilisé pour les fiches prospect, les
// avis de valeur et la veille. maxUses borne le nombre de recherches.
function webSearchTool(maxUses = 3) {
  return [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }];
}

async function callClaudeRaw(societe, { system, messages, maxTokens = 2048, tools }) {
  const payload = {
    model: societe?.aiModel || DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: system || undefined,
    messages,
    ...(tools ? { tools } : {}),
  };

  // --- Mode « Ma propre clé API » : appel direct. ---
  if (aiMode(societe) === 'personnelle') {
    if (!societe?.anthropicApiKey) {
      throw new Error("Mode « Ma propre clé API » sélectionné mais aucune clé saisie — ajoutez votre clé dans Paramètres > Intégrations, ou repassez sur « IA de l'application ».");
    }
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': societe.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erreur API Anthropic (${res.status})`);
    }
    return res.json();
  }

  // --- Mode « IA de l'application » : Edge Function partagée. ---
  if (!proxyAvailable()) {
    throw new Error("L'IA de l'application n'est pas disponible (Supabase non configuré) — choisissez « Ma propre clé API » dans Paramètres > Intégrations, ou contactez l'administrateur.");
  }
  const { data, error } = await supabase.functions.invoke('claude-proxy', { body: payload });
  if (error) {
    let message = '';
    try { message = (await error.context?.json())?.error?.message || ''; } catch { /* réponse illisible */ }
    if (!message && /not found|404/i.test(error.message || '')) {
      message = "L'IA partagée n'est pas encore déployée (fonction « claude-proxy » introuvable) — voir INSTRUCTIONS.md, ou saisissez une clé personnelle dans Paramètres > Intégrations.";
    }
    throw new Error(message || error.message || "Erreur de l'IA partagée.");
  }
  if (data?.error) throw new Error(data.error.message || "Erreur de l'IA partagée.");
  return data;
}

function textOf(data) {
  return (data?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

async function callClaude(societe, options) {
  return textOf(await callClaudeRaw(societe, options));
}

// ---------------------------------------------------------------------------
// Boucle agent — le modèle peut appeler des outils métier (déclarés dans
// agentTools.js) ; chaque demande d'action est exécutée ICI, dans le
// navigateur, par `execute(nom, entrée)`, puis le résultat lui est renvoyé
// jusqu'à sa réponse finale. `onAction` reçoit chaque action effectuée.
// ---------------------------------------------------------------------------
export async function runAgent(societe, { system, messages, tools, execute, maxTokens = 3000, maxTours = 8, onAction }) {
  const conv = [...messages];
  const actions = [];
  for (let tour = 0; tour < maxTours; tour++) {
    const data = await callClaudeRaw(societe, { system, messages: conv, maxTokens, tools });
    const demandes = (data.content || []).filter((c) => c.type === 'tool_use');
    if (data.stop_reason !== 'tool_use' || demandes.length === 0) {
      return { texte: textOf(data), actions };
    }
    conv.push({ role: 'assistant', content: data.content });
    const resultats = [];
    for (const d of demandes) {
      let sortie;
      let erreur = false;
      try {
        sortie = await execute(d.name, d.input || {});
      } catch (e) {
        sortie = { erreur: e?.message || String(e) };
        erreur = true;
      }
      const resume = sortie && typeof sortie === 'object' && sortie.resume ? sortie.resume : null;
      actions.push({ outil: d.name, entree: d.input, resume: resume || (erreur ? `Échec : ${sortie.erreur}` : 'OK'), erreur });
      if (onAction) onAction(actions[actions.length - 1]);
      resultats.push({
        type: 'tool_result',
        tool_use_id: d.id,
        content: JSON.stringify(sortie ?? { ok: true }).slice(0, 20000),
        ...(erreur ? { is_error: true } : {}),
      });
    }
    conv.push({ role: 'user', content: resultats });
  }
  return { texte: "J'ai atteint la limite d'actions pour une seule demande — reformulez pour continuer.", actions };
}

// Règles d'usage communes (plan d'exploitation CARDO) — rappelées au modèle
// dans chaque production métier.
const REGLES =
  "Règles impératives : (1) toute donnée de marché citée porte sa source et sa date ; une donnée sans source est marquée « à vérifier » ; (2) n'invente jamais un chiffre, un comparable, un taux ou une surface ; (3) les comparables sont présentés en tableau : date, ville, surface, prix, taux ; (4) un teaser ne mentionne jamais le nom du vendeur ni l'adresse exacte du bien ; (5) le document produit sera relu et validé par l'utilisateur avant tout envoi — termine par la mention des points à vérifier en priorité (chiffres, noms, dates).";

function parseJson(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('Réponse IA inexploitable — cliquez sur « Actualiser » pour réessayer.');
  const brut = clean.slice(start);

  // Essai direct : réponse complète.
  const fin = brut.lastIndexOf('}');
  if (fin !== -1) {
    try { return JSON.parse(brut.slice(0, fin + 1)); } catch { /* réparation ci-dessous */ }
  }

  // Réponse coupée en route (limite de longueur atteinte) : on repère les
  // points de coupe plausibles (fins de valeur), puis, du plus tardif au plus
  // ancien, on referme les accolades/crochets ouverts et on tente le parse.
  const cutPoints = [];
  {
    let inStr = false, esc = false;
    for (let i = 0; i < brut.length; i++) {
      const c = brut[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') { inStr = false; cutPoints.push(i + 1); }
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '}' || c === ']') cutPoints.push(i + 1);
      else if (/[0-9el]/.test(c)) cutPoints.push(i + 1); // fin possible de nombre/true/false/null
    }
  }
  const referme = (frag) => {
    const pile = [];
    let inStr = false, esc = false;
    for (const c of frag) {
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{' || c === '[') pile.push(c);
      else if (c === '}' || c === ']') pile.pop();
    }
    if (inStr) return null; // coupe au milieu d'une chaîne : point invalide
    let out = frag;
    for (let i = pile.length - 1; i >= 0; i--) out += pile[i] === '{' ? '}' : ']';
    return out;
  };
  for (let k = cutPoints.length - 1, essais = 0; k >= 0 && essais < 80; k--, essais++) {
    let frag = brut.slice(0, cutPoints[k]);
    // Nettoyage de fin de fragment : virgules pendantes, clé orpheline
    // (« …,"titre" » ou « …,"titre": »), objet/tableau à peine ouvert — en
    // boucle, car ces restes s'empilent (« …},{"titre": » par exemple).
    for (let avant = null; avant !== frag;) {
      avant = frag;
      frag = frag
        .replace(/[,\s]+$/, '')
        .replace(/"(?:[^"\\]|\\.)*"\s*:\s*$/, '')
        .replace(/[{[]\s*$/, '')
        .replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, '');
    }
    const cand = referme(frag);
    if (!cand) continue;
    try { return JSON.parse(cand); } catch { /* point de coupe suivant */ }
  }
  throw new Error('Réponse IA incomplète — cliquez sur « Actualiser » pour réessayer.');
}

// ---------------------------------------------------------------------------
// 1. Extraction fiable d'un acte / promesse / mandat (remplace les heuristiques
//    regex de pdfExtract quand l'IA est disponible).
// ---------------------------------------------------------------------------
export async function extractActeAI(societe, texteActe) {
  const text = await callClaude(societe, {
    system:
      "Tu es l'assistant d'un broker en immobilier d'entreprise français. On te donne le texte brut d'un acte notarié, d'une promesse de vente ou d'un mandat. Réponds UNIQUEMENT avec un objet JSON, sans préambule ni backticks, avec exactement ces clés (null si introuvable) : prixVente (nombre, €), vendeur (string), acquereur (string), bienAdresse (string), dateSignature (YYYY-MM-DD), dateReiteration (YYYY-MM-DD), notaire (string), honorairesMontantTTC (nombre), honorairesRedevable ('vendeur'|'acquereur'|null), numeroMandat (string), reference (string), loyerAnnuel (nombre), locataire (string).",
    messages: [{ role: 'user', content: texteActe.slice(0, 100000) }],
    maxTokens: 1024,
  });
  return parseJson(text);
}

// ---------------------------------------------------------------------------
// 1 bis. Lecture d'un justificatif de dépense (ticket, facture fournisseur)
//        à partir du texte OCR / PDF — remplace les heuristiques de ocr.js.
// ---------------------------------------------------------------------------
export async function extractReceiptAI(societe, texte, categories = []) {
  const text = await callClaude(societe, {
    system:
      `Tu lis des justificatifs de dépenses (tickets, notes de restaurant, factures fournisseurs, péages, carburant) pour la comptabilité d'un broker immobilier français. Réponds UNIQUEMENT avec un objet JSON (sans backticks) : commercant (string), date (YYYY-MM-DD), montantTTC (nombre), tauxTva (nombre : 20, 10, 5.5, 2.1 ou 0), montantTVA (nombre ou null), categorie (un identifiant parmi : ${categories.map((c) => `${c.id} = ${c.label}`).join(' ; ') || 'autre'}), libelle (description courte). null si introuvable.`,
    messages: [{ role: 'user', content: (texte || '').slice(0, 30000) }],
    maxTokens: 400,
  });
  return parseJson(text);
}

// ---------------------------------------------------------------------------
// 2. Brouillon de RÉPONSE à un email, avec le contexte métier de l'appli.
// ---------------------------------------------------------------------------
export async function draftEmailReply(societe, { from, subject, body, instructions, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu es l'assistant de ${societe?.contactNom || 'un broker'} (${societe?.nom || 'cabinet de brokerage'}), broker en immobilier d'investissement d'entreprise en France. Tu rédiges des réponses d'email professionnelles, directes, en français, prêtes à envoyer : pas de placeholders inutiles, signature sobre avec nom, société et téléphone (${societe?.telephone || ''}). Tu disposes d'un instantané des données de l'application (mandats, promesses, factures, contacts) ; appuie-toi dessus quand l'email concerne un dossier connu, et n'invente jamais de chiffres.`,
    messages: [{
      role: 'user',
      content: `CONTEXTE APPLICATION (JSON):\n${JSON.stringify(snapshot || {}).slice(0, 30000)}\n\nEMAIL REÇU\nDe: ${from}\nObjet: ${subject}\n\n${(body || '').slice(0, 15000)}\n\nCONSIGNE: ${instructions || 'Rédige la meilleure réponse possible.'}\n\nRéponds uniquement avec le corps de l'email de réponse.`,
    }],
    maxTokens: 1500,
  });
}

// ---------------------------------------------------------------------------
// 3. Brouillon d'un NOUVEAU message (composer), destinataires choisis dans
//    les contacts de l'appli.
// ---------------------------------------------------------------------------
export async function draftEmailNew(societe, { to, subject, instructions, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu es l'assistant de ${societe?.contactNom || 'un broker'} (${societe?.nom || 'cabinet de brokerage'}), broker en immobilier d'investissement d'entreprise en France. Tu rédiges des emails professionnels, directs, en français, prêts à envoyer, avec une signature sobre (nom, société, téléphone ${societe?.telephone || ''}). Tu disposes d'un instantané des données de l'application ; si un destinataire correspond à un contact, un mandant ou un dossier connu, personnalise le message avec ces informations, sans jamais inventer de chiffres.`,
    messages: [{
      role: 'user',
      content: `CONTEXTE APPLICATION (JSON):\n${JSON.stringify(snapshot || {}).slice(0, 30000)}\n\nNOUVEAU MESSAGE\nÀ: ${to}\nObjet: ${subject || '(à proposer si pertinent)'}\n\nCONSIGNE: ${instructions || 'Rédige le meilleur email possible pour ce destinataire.'}\n\nRéponds uniquement avec le corps de l'email.`,
    }],
    maxTokens: 1500,
  });
}

// ---------------------------------------------------------------------------
// 4. Assistant conversationnel « Copilote » — une secrétaire qui connaît tout
//    le contenu de l'appli ET la liste des échéances calculées par relances.js.
// ---------------------------------------------------------------------------
export async function askAssistant(societe, { history, snapshot, alerts, emails }) {
  return callClaude(societe, {
    system:
      `Tu es la secrétaire de direction intégrée de « ${societe?.nom || 'Mandat'} », application de gestion d'un broker en immobilier d'entreprise (Capital Markets) en France, dirigée par ${societe?.contactNom || "l'utilisateur"}. À chaque question tu reçois : un instantané JSON complet des données (mandats, promesses avec dates de conditions suspensives et de réitération, factures, notes de frais, comptabilité, contacts, prospects, documents), la liste des ALERTES déjà calculées par l'application, et parfois les derniers emails. Ton rôle : être proactive comme une excellente secrétaire — réponds précisément à la question, puis signale spontanément ce qui mérite attention (échéance qui approche, facture à émettre ou relancer, promesse à surveiller, prospect à rappeler, document à préparer et à quelle date). Réponds en français, de façon concrète et chiffrée, en citant les dossiers par leur nom. Si une information manque, dis-le. Propose des actions avec leur date limite. Tu sais aussi, sur demande, produire tout document écrit du métier : NDA, lettre de process, index de data room, compte rendu, tableau comparatif et scoring d'offres, posts LinkedIn et tombstones — en appliquant ces règles : ${REGLES}`,
    messages: [
      {
        role: 'user',
        content: `DONNÉES ACTUELLES DE L'APPLICATION:\n${JSON.stringify(snapshot).slice(0, 60000)}${alerts?.length ? `\n\nALERTES CALCULÉES PAR L'APPLICATION:\n${JSON.stringify(alerts).slice(0, 15000)}` : ''}${emails?.length ? `\n\nDERNIERS EMAILS:\n${JSON.stringify(emails).slice(0, 20000)}` : ''}`,
      },
      { role: 'assistant', content: "Bien reçu, j'ai l'état complet de l'application et les échéances en tête. Quelle est la question ?" },
      ...history,
    ],
    maxTokens: 2048,
  });
}

// ---------------------------------------------------------------------------
// 4 bis. Copilote AGENT — la secrétaire qui agit : elle dispose des outils
//        métier (agentTools.js), de l'instantané complet, des alertes, des
//        documents déposés dans la conversation et de la recherche web.
// ---------------------------------------------------------------------------
export async function askAgent(societe, { history, snapshot, alerts, attachments, tools, execute, onAction }) {
  // Budget de taille : le serveur refuse les requêtes trop volumineuses.
  // Les pièces jointes se partagent une enveloppe commune, et l'historique
  // est raccourci par le début si nécessaire.
  const liste = attachments || [];
  const parPiece = Math.max(8000, Math.min(60000, Math.floor(150000 / Math.max(1, liste.length))));
  const piecesJointes = liste.map((a, i) => {
    const t = a.texte || '';
    return `--- PIÈCE JOINTE ${i + 1} : ${a.nom} ---\n${t.slice(0, parPiece)}${t.length > parPiece ? '\n[… document tronqué : demande à l\'utilisateur de le déposer seul si la suite est nécessaire]' : ''}`;
  }).join('\n\n');
  let hist = [...(history || [])];
  const tailleHist = () => hist.reduce((n, m) => n + String(m.content || '').length, 0);
  while (hist.length > 1 && tailleHist() > 60000) hist = hist.slice(hist[1]?.role === 'assistant' ? 2 : 1);
  const consignes = String(societe?.copiloteInstructions || '').trim();
  return runAgent(societe, {
    system:
      `Tu es la collaboratrice administrative et commerciale intégrée de « ${societe?.nom || 'Mandat'} », application de gestion d'un broker en immobilier d'entreprise (Capital Markets) en France, dirigée par ${societe?.contactNom || "l'utilisateur"}. Tu agis comme une secrétaire de direction ultra compétente, proactive et fiable : tu ne te contentes pas de répondre, tu FAIS — grâce à tes outils tu crées et mets à jour les contacts, notes d'échanges, lignes de suivi commercial, mandats, promesses, factures brouillon, notes de frais ; tu prépares les emails (composer pré-rempli, l'utilisateur envoie), les IM (assistant pré-rempli), les documents juridiques (PDF brouillon) ; tu rapproches investisseurs et biens ; tu tiens l'agenda (rappels datés avec creer_rappel dès qu'une suite est à donner : « rappelle-moi », rendez-vous, relance, pièce à envoyer) ; tu mets à jour les factures (envoyée, payée) ; tu traces les courriers ; tu mémorises dans la bibliothèque ce qui doit l'être, et les consignes permanentes de l'utilisateur avec memoriser_consigne ; tu cherches sur le web quand il faut une information externe (toujours sourcée et datée).

Méthode : (1) comprends la demande et ce qu'elle implique concrètement dans l'application ; (2) consulte les données (instantané ci-dessous, outils lister_donnees / rechercher_contacts) avant d'agir, pour éviter les doublons et retrouver les identifiants ; (3) agis avec les outils, en enchaînant les étapes nécessaires sans redemander ce que tu peux déduire ; (4) réponds brièvement en français : ce que tu as fait, ce qu'il reste à valider par l'utilisateur, et ce que tu suggères ensuite (échéance, relance, document). Ne demande confirmation que pour les décisions réellement ambiguës. N'invente jamais un chiffre, un nom ou une date : si une donnée manque, dis-le ou cherche-la. Quand tu rédiges (emails, posts LinkedIn, comptes rendus, NDA, lettres de process, index de data room, tableaux comparatifs, scoring d'offres, tombstones), applique : ${REGLES} Pour un post LinkedIn : sobre, professionnel, sans emoji excessif, avec 3 à 5 hashtags en fin. Dates au format français dans tes réponses, montants en euros formatés. Quand l'utilisateur dicte un compte rendu d'appel ou de rendez-vous, fais tout d'un coup : note l'échange sur la fiche contact (ajouter_interaction), mets à jour ses critères s'il en a donné, crée le rappel de suite, et propose l'email de suivi. Tu ne supprimes rien sans demande explicite (et la suppression va à la corbeille, restaurable).${consignes ? `\n\nCONSIGNES PERMANENTES DE L'UTILISATEUR (à respecter systématiquement, elles priment sur tes habitudes de rédaction) :\n${consignes.slice(0, 4000)}` : ''}`,
    messages: [
      {
        role: 'user',
        content: `DONNÉES ACTUELLES DE L'APPLICATION (instantané — utilise les outils pour le détail) :\n${JSON.stringify(snapshot).slice(0, 90000)}${alerts?.length ? `\n\nALERTES CALCULÉES PAR L'APPLICATION :\n${JSON.stringify(alerts).slice(0, 15000)}` : ''}${piecesJointes ? `\n\nDOCUMENTS DÉPOSÉS DANS LA CONVERSATION :\n${piecesJointes}` : ''}`,
      },
      { role: 'assistant', content: "Bien reçu : j'ai l'état complet de l'application, les échéances et les documents déposés. Dites-moi ce que vous voulez que je fasse." },
      ...hist,
    ],
    tools: [...(tools || []), ...webSearchTool(3)],
    execute,
    onAction,
    maxTokens: 3500,
    maxTours: 10,
  });
}

// ---------------------------------------------------------------------------
// 5. Briefing quotidien — généré automatiquement à l'ouverture du Copilote,
//    sans rien demander : la secrétaire fait le point du jour.
// ---------------------------------------------------------------------------
export async function dailyBriefing(societe, { snapshot, alerts }) {
  const text = await callClaude(societe, {
    system:
      `Tu es la secrétaire de direction de ${societe?.contactNom || "l'utilisateur"} (${societe?.nom || 'cabinet de brokerage'}), broker en immobilier d'entreprise en France. On te donne l'instantané complet de son activité et les alertes calculées par l'application. Prépare son briefing du jour, comme une secrétaire ultra compétente : l'essentiel d'abord, puis les actions concrètes datées. Réponds UNIQUEMENT en JSON, sans backticks, avec les clés : resume (2-3 phrases, l'état de l'activité et ce qui compte aujourd'hui), actions (tableau de 3 à 5 éléments MAXIMUM {titre (court, impératif), detail (1 phrase courte avec les noms et les dates), route (une de : /promesses, /mandats, /facturation, /suivi, /mail, /documents, /im, /frais, /comptabilite)}). N'invente aucun chiffre ni aucune échéance : appuie-toi uniquement sur les données fournies. S'il n'y a vraiment rien d'urgent, dis-le dans resume et propose des actions de fond (relances commerciales, documents à préparer).`,
    messages: [{
      role: 'user',
      content: `DATE DU JOUR : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\nDONNÉES:\n${JSON.stringify(snapshot).slice(0, 60000)}\n\nALERTES:\n${JSON.stringify(alerts || []).slice(0, 15000)}`,
    }],
    maxTokens: 2500,
  });
  return parseJson(text);
}

// ---------------------------------------------------------------------------
// 5 bis. Données d'un bien pour l'IM, extraites des documents déposés (bail,
//        état locatif, diagnostics, plaquette, acte…).
// ---------------------------------------------------------------------------
export async function extractImDataAI(societe, { documents, bienConnu }) {
  const corpus = (documents || []).map((d, i) => `--- DOCUMENT ${i + 1} : ${d.nom} ---\n${(d.texte || '').slice(0, 40000)}`).join('\n\n');
  const text = await callClaude(societe, {
    system:
      "Tu prépares un mémorandum d'information (IM) immobilier d'investissement en France. À partir des documents fournis (bail commercial, état locatif, diagnostics, plaquette, acte, plan…), extrais les données du bien. Réponds UNIQUEMENT avec un objet JSON (sans backticks) avec ces clés (null si introuvable, ne devine jamais) : adresse, typeBien (ex. « Bâtiment d'activité », « Plateforme logistique », « Local commercial », « Bureaux »), surface (nombre, m²), locataire (nom de l'enseigne / société), activiteLocataire (1 à 2 phrases), loyerAnnuel (nombre, € HT HC/an), charges (texte court : répartition des charges, triple net…), tripleNet (booléen), dureeBail (ex. « 3/6/9 », « 12 ans fermes »), dateEffetBail (YYYY-MM-DD), dateFinBail (YYYY-MM-DD), indexation (ex. « ILC — révision triennale », « ILAT annuelle »), depotGarantie (texte), reference (références cadastrales), dpe (lettre), situationLocative (texte court : loué en totalité, vacance…), prix (nombre € si un prix de vente apparaît), pointsAttention (tableau de phrases courtes : clauses ou éléments à vérifier).",
    messages: [{ role: 'user', content: `${bienConnu ? `DONNÉES DÉJÀ CONNUES (à compléter, pas à contredire sans preuve) :\n${JSON.stringify(bienConnu)}\n\n` : ''}${corpus.slice(0, 120000)}` }],
    maxTokens: 1500,
  });
  return parseJson(text);
}

// ---------------------------------------------------------------------------
// 6. Textes marketing d'un IM (description emplacement, actif, locataire).
// ---------------------------------------------------------------------------
export async function generateImTexts(societe, bien) {
  const text = await callClaude(societe, {
    system:
      "Tu rédiges les textes d'un mémorandum d'information (IM) immobilier d'investissement en France, dans le style des brokers Capital Markets (CBRE, BNPPRE) : factuel, valorisant, sans superlatifs creux. Réponds UNIQUEMENT en JSON avec les clés : environnement (paragraphe sur la situation géographique et le bassin économique, 80-120 mots), descriptionActif (paragraphe sur le bien, 60-100 mots), presentationLocataire (paragraphe sur le locataire et son activité, 60-100 mots), pointsCles (tableau de 5 à 6 points clés de l'investissement, chacun {titre, detail}).",
    messages: [{ role: 'user', content: JSON.stringify(bien) }],
    maxTokens: 2200,
  });
  return parseJson(text);
}

// ---------------------------------------------------------------------------
// 7. Fiche prospect — recherche web réelle : société, dirigeants, patrimoine
//    connu, actualité, angle d'approche (sourcé et daté).
// ---------------------------------------------------------------------------
export async function ficheProspect(societe, { cible, contexte, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu prépares des fiches prospect pour ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker en immobilier d'investissement d'entreprise (Capital Markets) en France. Utilise la recherche web pour établir une fiche factuelle et exploitable. Structure exacte : IDENTITÉ (forme, siège, RCS si trouvé, dirigeants), ACTIVITÉ ET PATRIMOINE IMMOBILIER CONNU (sites, implantations, opérations passées), ACTUALITÉ RÉCENTE (12 derniers mois, datée), SIGNAUX DE CESSION OU D'ACQUISITION (déménagement, arbitrage, croissance, difficultés…), ANGLE D'APPROCHE RECOMMANDÉ (2-3 phrases concrètes pour le premier contact), COORDONNÉES PUBLIQUES trouvées. ${REGLES} Réponds en français, de façon dense et directement utilisable.`,
    messages: [{
      role: 'user',
      content: `PROSPECT À ÉTUDIER : ${cible}${contexte ? `\nCONTEXTE / OBJECTIF : ${contexte}` : ''}${snapshot ? `\n\nDONNÉES DÉJÀ CONNUES DANS L'APPLICATION (contacts, dossiers éventuels) :\n${JSON.stringify(snapshot).slice(0, 20000)}` : ''}`,
    }],
    maxTokens: 3000,
    tools: webSearchTool(5),
  });
}

// ---------------------------------------------------------------------------
// 8. Avis de valeur — comparables recherchés sur le web, fourchette argumentée.
// ---------------------------------------------------------------------------
export async function avisDeValeur(societe, { bien }) {
  return callClaude(societe, {
    system:
      `Tu prépares des avis de valeur pour ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker Capital Markets en France. À partir de la description du bien et de recherches web (transactions comparables, taux de rendement pratiqués, valeurs locatives du secteur), produis : SYNTHÈSE DU BIEN (reformulation en 3 lignes), ANALYSE LOCATIVE (loyer en place vs marché, WALB/WALT si calculables à partir des données fournies), COMPARABLES (tableau : date | ville | typologie | surface | prix | taux — uniquement des références trouvées et sourcées, sinon « comparables publics insuffisants »), APPROCHE PAR LE RENDEMENT (taux retenu argumenté, calcul), FOURCHETTE DE VALEUR RECOMMANDÉE (basse / centrale / haute, argumentée), POINTS DE VIGILANCE. ${REGLES}`,
    messages: [{ role: 'user', content: `BIEN À VALORISER :\n${JSON.stringify(bien).slice(0, 15000)}` }],
    maxTokens: 4000,
    tools: webSearchTool(5),
  });
}

// ---------------------------------------------------------------------------
// 9. Veille marché — synthèse datée de l'investissement en immobilier
//    d'entreprise en France.
// ---------------------------------------------------------------------------
export async function veilleMarche(societe) {
  return callClaude(societe, {
    system:
      `Tu prépares la veille marché de ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker Capital Markets en France (bureaux, logistique, activité, commerces). Par recherche web, produis une synthèse datée du jour : TRANSACTIONS RÉCENTES MARQUANTES (France, avec montants et taux quand publiés), TAUX ET FINANCEMENT (OAT, tendances de taux de rendement par classe d'actifs), MOUVEMENTS DES INVESTISSEURS (collecte SCPI/OPCI, stratégies annoncées), RÉGLEMENTATION ET FISCALITÉ (nouveautés utiles au métier), À RETENIR POUR LA PROSPECTION (3 angles concrets). ${REGLES}`,
    messages: [{ role: 'user', content: `Veille du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Concentre-toi sur les 4 à 8 dernières semaines.` }],
    maxTokens: 3500,
    tools: webSearchTool(5),
  });
}

// ---------------------------------------------------------------------------
// 10. Analyse d'un document déposé (bail, état locatif, diagnostic, PLU,
//     promesse…) — synthèse structurée et actionnable.
// ---------------------------------------------------------------------------
export async function analyseDocument(societe, { nom, texte }) {
  return callClaude(societe, {
    system:
      `Tu analyses des documents immobiliers (baux commerciaux, états locatifs, diagnostics, audits techniques, règlements d'urbanisme, promesses…) pour ${societe?.contactNom || 'un broker'} Capital Markets. Produis une synthèse structurée : NATURE DU DOCUMENT, PARTIES ET BIEN CONCERNÉS, DONNÉES CLÉS (loyers, surfaces, durées, échéances, indexation, charges et leur répartition, dépôt de garantie — en tableau quand pertinent), ÉCHÉANCES À RETENIR (dates précises), RISQUES ET POINTS D'ATTENTION (clauses inhabituelles, zones d'ombre, incohérences), ACTIONS RECOMMANDÉES. Si une information est illisible ou absente, dis-le explicitement. ${REGLES}`,
    messages: [{ role: 'user', content: `DOCUMENT « ${nom} » (texte extrait) :\n\n${(texte || '').slice(0, 120000)}` }],
    maxTokens: 3000,
  });
}

// ---------------------------------------------------------------------------
// 11. Teaser anonymisé — jamais le nom du vendeur ni l'adresse exacte.
// ---------------------------------------------------------------------------
export async function genererTeaser(societe, bien) {
  return callClaude(societe, {
    system:
      `Tu rédiges des teasers d'investissement anonymisés dans le style des brokers Capital Markets français (une page, envoyée avant NDA). Structure : ACCROCHE (1 ligne), L'OPPORTUNITÉ (localisation au niveau de l'agglomération ou de l'axe uniquement — JAMAIS l'adresse exacte ni le nom du vendeur ; typologie, surface, état locatif), INDICATEURS CLÉS (loyer, durée ferme résiduelle, prix indicatif ou « sur demande », rendement), CALENDRIER ET PROCESS (manifestations d'intérêt, data room sous NDA), CONTACT (${societe?.contactNom || ''}, ${societe?.nom || ''}, ${societe?.telephone || ''}, ${societe?.email || ''}). ${REGLES} Ton : factuel, dense, vendeur sans superlatifs creux.`,
    messages: [{ role: 'user', content: `BIEN :\n${JSON.stringify(bien).slice(0, 12000)}` }],
    maxTokens: 1200,
  });
}

// ---------------------------------------------------------------------------
// 12. Séquence de prospection — emails personnalisés par profil de cible.
// ---------------------------------------------------------------------------
export async function sequenceProspection(societe, { cible, profil, objectif, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu écris des séquences de prospection par email pour ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker Capital Markets en France. Produis une séquence de 3 emails + 2 relances courtes, adaptée au profil de la cible (propriétaire utilisateur, foncière, family office, SCPI/institutionnel…). Pour chaque message : OBJET, CORPS (court, personnalisé, une seule demande claire, signature sobre avec téléphone), DÉLAI D'ENVOI recommandé après le précédent. Jamais de promesse chiffrée invérifiable, jamais de flatterie creuse. ${REGLES}`,
    messages: [{
      role: 'user',
      content: `CIBLE : ${cible}\nPROFIL : ${profil || 'à déduire'}\nOBJECTIF : ${objectif || 'obtenir un rendez-vous pour parler de leur patrimoine immobilier'}${snapshot ? `\n\nCONTEXTE APPLICATION :\n${JSON.stringify(snapshot).slice(0, 15000)}` : ''}`,
    }],
    maxTokens: 2000,
  });
}

// ---------------------------------------------------------------------------
// 13. Brouillon de relance à partir d'une alerte de l'application.
// ---------------------------------------------------------------------------
export async function draftRelance(societe, { contexte, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu rédiges des emails de relance professionnels pour ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker Capital Markets. À partir de l'alerte et des données de l'application, rédige l'email de relance le plus adapté : direct, courtois, avec la date ou l'échéance concernée, une demande claire, et une signature sobre (nom, société, téléphone ${societe?.telephone || ''}). Réponds uniquement avec l'objet (ligne « Objet : … ») puis le corps de l'email.`,
    messages: [{
      role: 'user',
      content: `ALERTE : ${contexte}\n\nDONNÉES DE L'APPLICATION :\n${JSON.stringify(snapshot || {}).slice(0, 30000)}`,
    }],
    maxTokens: 900,
  });
}

// ---------------------------------------------------------------------------
// 14. Post LinkedIn — sobre, professionnel, prêt à publier.
// ---------------------------------------------------------------------------
export async function postLinkedIn(societe, { sujet, snapshot }) {
  return callClaude(societe, {
    system:
      `Tu rédiges les posts LinkedIn de ${societe?.contactNom || 'un broker'} (${societe?.nom || ''}), broker en immobilier d'entreprise Capital Markets en France. Style : sobre, crédible, concret — jamais de superlatifs creux ni d'emojis en rafale (un ou deux au maximum). Structure : accroche d'une ligne, 3 à 6 lignes courtes aérées, une conclusion ou un appel discret à l'échange, 3 à 5 hashtags en fin. 900 caractères maximum. ${REGLES} Ne cite jamais le nom d'un vendeur ni une adresse exacte sans que ce soit explicitement demandé (confidentialité des dossiers). Réponds uniquement avec le texte du post.`,
    messages: [{ role: 'user', content: `SUJET : ${sujet}\n\nCONTEXTE (données de l'application) :\n${JSON.stringify(snapshot || {}).slice(0, 20000)}` }],
    maxTokens: 700,
  });
}

// ---------------------------------------------------------------------------
// Instantané compact de l'application, injecté dans les prompts.
// ---------------------------------------------------------------------------
export function buildAppSnapshot({ societe, mandats, promesses, factures, notesFrais, contacts, prospects, courriers, documents, dossiers, taches, registre }) {
  const lite = (arr, keys, max = 60) => (arr || []).slice(0, max).map((o) => Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length)).map((k) => [k, o[k]])));
  const contactsLite = (contacts || []).slice(0, 250).map((c) => {
    const inter = (c.interactions || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 2);
    const o = {
      id: c.id, societe: c.societe, nom: [c.prenom, c.nom].filter(Boolean).join(' ') || undefined, fonction: c.fonction, categorie: c.categorie,
      email: c.email, tel: c.telephone, vehicule: c.vehicule, classes: c.classesActifs, zones: c.zones,
      ticketMin: c.ticketMin, ticketMax: c.ticketMax, rendementCible: c.rendementCible, strategie: c.strategie,
      statut: c.statutRelation, prochaineRelance: c.prochaineRelance, patrimoine: c.patrimoine ? String(c.patrimoine).slice(0, 200) : undefined,
      notes: c.notes ? String(c.notes).slice(0, 400) : undefined,
      derniersEchanges: inter.length ? inter.map((i) => `${i.date || ''} ${i.type || ''}: ${(i.note || '').slice(0, 120)}`) : undefined,
    };
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
  });
  const bibliotheque = (documents || []).filter((d) => d.type === 'bibliotheque').slice(0, 40).map((d) => ({
    id: d.id, nom: d.nom, date: d.createdAt?.slice(0, 10), resume: (d.resume || '').slice(0, 900),
  }));
  return {
    dateDuJour: new Date().toISOString().slice(0, 10),
    societe: { nom: societe?.nom, contactNom: societe?.contactNom, telephone: societe?.telephone, email: societe?.email, linkedin: societe?.linkedinUrl },
    mandats: lite(mandats, ['id', 'numero', 'adresse', 'typeBien', 'typeMandat', 'variante', 'mandant', 'client', 'prixVente', 'loyerAnnuel', 'surface', 'statut', 'dateSignature', 'dateDebutMandat', 'dateFinMandat']),
    promesses: lite(promesses, ['id', 'bienAdresse', 'vendeur', 'acquereur', 'prixVente', 'honorairesHT', 'redevable', 'notaire', 'dateSignaturePromesse', 'dateLimiteConditionsSuspensives', 'dateReiterationPrevue', 'dateProchaineRelance', 'statut', 'notes']),
    factures: lite(factures, ['id', 'numero', 'client', 'bienAdresse', 'montantHT', 'montantTTC', 'dateEmission', 'statut', 'mandatRef']),
    notesFrais: lite(notesFrais, ['id', 'date', 'commercant', 'categorieLabel', 'montantTTC'], 40),
    contacts: contactsLite,
    prospects: lite(prospects, ['id', 'dossierId', 'prospect', 'contact', 'type', 'statut', 'niveauInteret', 'prochaineRelance', 'prochaineAction', 'retour', 'prixPropose'], 80),
    courriers: lite(courriers, ['id', 'objet', 'societe', 'nomContact', 'date', 'dateRelancePrevue', 'statut'], 30),
    documentsJuridiques: lite((documents || []).filter((d) => d.type !== 'bibliotheque'), ['id', 'numero', 'typeId', 'variante', 'statut', 'createdAt'], 40),
    bibliotheque,
    rappels: (taches || []).filter((t) => !t.fait).sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 60)
      .map((t) => Object.fromEntries(Object.entries({ id: t.id, titre: t.titre, date: t.date, heure: t.heure, contact: t.contactNom, note: t.note ? String(t.note).slice(0, 200) : undefined }).filter(([, v]) => v !== undefined && v !== ''))),
    dossiersIM: lite((dossiers || []).filter((d) => d.type === 'IM'), ['id', 'nom', 'statut', 'createdAt'], 30),
    registre: registre ? { totalProduitsHT: registre.totalProduitsHT, totalChargesHT: registre.totalChargesHT } : undefined,
  };
}
