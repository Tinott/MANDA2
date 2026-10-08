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

async function callClaude(societe, { system, messages, maxTokens = 2048, tools }) {
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
    const data = await res.json();
    return data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
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
  return (data?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

// Règles d'usage communes (plan d'exploitation CARDO) — rappelées au modèle
// dans chaque production métier.
const REGLES =
  "Règles impératives : (1) toute donnée de marché citée porte sa source et sa date ; une donnée sans source est marquée « à vérifier » ; (2) n'invente jamais un chiffre, un comparable, un taux ou une surface ; (3) les comparables sont présentés en tableau : date, ville, surface, prix, taux ; (4) un teaser ne mentionne jamais le nom du vendeur ni l'adresse exacte du bien ; (5) le document produit sera relu et validé par l'utilisateur avant tout envoi — termine par la mention des points à vérifier en priorité (chiffres, noms, dates).";

function parseJson(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  return JSON.parse(clean.slice(start, end + 1));
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
// 5. Briefing quotidien — généré automatiquement à l'ouverture du Copilote,
//    sans rien demander : la secrétaire fait le point du jour.
// ---------------------------------------------------------------------------
export async function dailyBriefing(societe, { snapshot, alerts }) {
  const text = await callClaude(societe, {
    system:
      `Tu es la secrétaire de direction de ${societe?.contactNom || "l'utilisateur"} (${societe?.nom || 'cabinet de brokerage'}), broker en immobilier d'entreprise en France. On te donne l'instantané complet de son activité et les alertes calculées par l'application. Prépare son briefing du jour, comme une secrétaire ultra compétente : l'essentiel d'abord, puis les actions concrètes datées. Réponds UNIQUEMENT en JSON, sans backticks, avec les clés : resume (2-3 phrases, l'état de l'activité et ce qui compte aujourd'hui), actions (tableau de 3 à 7 éléments {titre (court, impératif), detail (1 phrase avec les noms et les dates), route (une de : /promesses, /mandats, /facturation, /suivi, /mail, /documents, /im, /frais, /comptabilite)}). N'invente aucun chiffre ni aucune échéance : appuie-toi uniquement sur les données fournies. S'il n'y a vraiment rien d'urgent, dis-le dans resume et propose des actions de fond (relances commerciales, documents à préparer).`,
    messages: [{
      role: 'user',
      content: `DATE DU JOUR : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\nDONNÉES:\n${JSON.stringify(snapshot).slice(0, 60000)}\n\nALERTES:\n${JSON.stringify(alerts || []).slice(0, 15000)}`,
    }],
    maxTokens: 1200,
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
    maxTokens: 1500,
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
// Instantané compact de l'application, injecté dans les prompts.
// ---------------------------------------------------------------------------
export function buildAppSnapshot({ societe, mandats, promesses, factures, notesFrais, contacts, prospects, courriers, documents, registre }) {
  const lite = (arr, keys, max = 60) => (arr || []).slice(0, max).map((o) => Object.fromEntries(keys.filter((k) => o[k] !== undefined && o[k] !== '').map((k) => [k, o[k]])));
  return {
    societe: { nom: societe?.nom, contactNom: societe?.contactNom },
    mandats: lite(mandats, ['numero', 'adresse', 'typeBien', 'typeMandat', 'variante', 'mandant', 'prixVente', 'loyerAnnuel', 'statut', 'dateSignature', 'dateFin']),
    promesses: lite(promesses, ['bienAdresse', 'vendeur', 'acquereur', 'prixVente', 'honorairesHT', 'redevable', 'notaire', 'dateSignature', 'dateConditionsSuspensives', 'dateReiteration', 'dateProchaineRelance', 'statut']),
    factures: lite(factures, ['numero', 'client', 'bienAdresse', 'montantHT', 'montantTTC', 'dateEmission', 'statut', 'mandatRef']),
    notesFrais: lite(notesFrais, ['date', 'categorie', 'montantTTC', 'statut'], 30),
    contacts: lite(contacts, ['nom', 'prenom', 'societe', 'email', 'telephone', 'categorie'], 100),
    prospects: lite(prospects, ['nom', 'societe', 'statut', 'prochaineRelance', 'notes'], 50),
    courriers: lite(courriers, ['objet', 'destinataire', 'date', 'dateRelancePrevue', 'statut'], 30),
    documents: lite(documents, ['nom', 'type', 'statut', 'date'], 40),
    registre: registre ? { totalProduitsHT: registre.totalProduitsHT, totalChargesHT: registre.totalChargesHT } : undefined,
  };
}
