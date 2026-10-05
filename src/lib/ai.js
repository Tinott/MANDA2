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

// « L'IA est-elle disponible ? » — clé personnelle OU proxy partagé.
export function hasApiKey(societe) {
  return Boolean(societe?.anthropicApiKey) || proxyAvailable();
}

async function callClaude(societe, { system, messages, maxTokens = 2048 }) {
  const payload = {
    model: societe?.aiModel || DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: system || undefined,
    messages,
  };

  // --- Mode 1 : clé personnelle, appel direct. ---
  if (societe?.anthropicApiKey) {
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

  // --- Mode 2 : IA partagée via l'Edge Function. ---
  if (!proxyAvailable()) {
    throw new Error("Aucune IA configurée : saisissez une clé API dans Paramètres > Intégrations, ou demandez à l'administrateur d'activer l'IA partagée.");
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
      `Tu es la secrétaire de direction intégrée de « ${societe?.nom || 'Mandat'} », application de gestion d'un broker en immobilier d'entreprise (Capital Markets) en France, dirigée par ${societe?.contactNom || "l'utilisateur"}. À chaque question tu reçois : un instantané JSON complet des données (mandats, promesses avec dates de conditions suspensives et de réitération, factures, notes de frais, comptabilité, contacts, prospects, documents), la liste des ALERTES déjà calculées par l'application, et parfois les derniers emails. Ton rôle : être proactive comme une excellente secrétaire — réponds précisément à la question, puis signale spontanément ce qui mérite attention (échéance qui approche, facture à émettre ou relancer, promesse à surveiller, prospect à rappeler, document à préparer et à quelle date). Réponds en français, de façon concrète et chiffrée, en citant les dossiers par leur nom. Si une information manque, dis-le. Propose des actions avec leur date limite.`,
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
