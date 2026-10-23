
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return text;
}

const MONTANT_RE = /(\d{1,3}(?:[ .]\d{3})*(?:,\d{2})?)\s?(?:€|EUR|euros)/gi;
const DATE_RE = /\b(\d{1,2})\s?(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/i;
const DATE_NUM_RE = /\b(\d{2})[\/.](\d{2})[\/.](\d{4})\b/;

const MOIS = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
};

function parseMontant(str) {
  return parseFloat(str.replace(/[ .](?=\d{3})/g, '').replace(',', '.'));
}

function findAfter(text, keywords, windowChars = 220) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) return text.slice(idx, idx + windowChars);
  }
  return '';
}

function guessName(snippet, stopWords) {
  // Cherche un motif "M./Mme/Monsieur/Madame/Société NOM Prénom" simplifié.
  const m = snippet.match(/(?:M\.|Mme|Monsieur|Madame|Société|SCI|SARL)\s+([A-ZÀ-Ý][\wÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’-]+){0,3})/);
  if (m) return m[0].trim();
  return '';
}

function findDateNear(text, keywords, windowChars = 300) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    let searchFrom = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const idx = lower.indexOf(kw, searchFrom);
      if (idx === -1) break;
      const window = text.slice(idx, idx + windowChars);
      const lit = window.match(DATE_RE);
      if (lit) {
        const [, d, moisLit, y] = lit;
        const mois = MOIS[moisLit.toLowerCase()];
        return { date: `${y}-${String(mois + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, confidence: 'haute' };
      }
      const num = window.match(DATE_NUM_RE);
      if (num) {
        const [, d, m, y] = num;
        return { date: `${y}-${m}-${d}`, confidence: 'moyenne' };
      }
      searchFrom = idx + kw.length;
    }
  }
  return { date: null, confidence: null };
}

export function parseActeFields(text) {
  const result = {
    prixVente: null,
    dateSignature: null,
    vendeur: '',
    acquereur: '',
    adresseBien: '',
    reference: '',
    notaire: '',
    confidence: {},
  };

  // Prix — on privilégie l'occurrence proche de "prix de vente" / "moyennant le prix".
  const prixCtx = findAfter(text, ['prix de vente', 'moyennant le prix', 'prix principal']);
  const montants = [...(prixCtx || text).matchAll(MONTANT_RE)].map((m) => parseMontant(m[1]));
  if (montants.length) {
    result.prixVente = Math.max(...montants);
    result.confidence.prixVente = prixCtx ? 'haute' : 'à vérifier';
  }

  // Date de signature.
  const dateLit = text.match(DATE_RE);
  if (dateLit) {
    const [, d, moisLit, y] = dateLit;
    const mois = MOIS[moisLit.toLowerCase()];
    result.dateSignature = `${y}-${String(mois + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.confidence.dateSignature = 'haute';
  } else {
    const dateNum = text.match(DATE_NUM_RE);
    if (dateNum) {
      const [, d, m, y] = dateNum;
      result.dateSignature = `${y}-${m}-${d}`;
      result.confidence.dateSignature = 'moyenne';
    }
  }

  // Parties.
  const venCtx = findAfter(text, ['le vendeur', 'la venderesse', 'les vendeurs', 'd\u2019une part']);
  const acqCtx = findAfter(text, ['l\u2019acquéreur', 'l\u2019acquereur', 'les acquéreurs', 'd\u2019autre part']);
  result.vendeur = guessName(venCtx || text);
  result.acquereur = guessName(acqCtx || text);

  // Adresse du bien.
  const adrCtx = findAfter(text, ['sis à', 'sis au', 'situé à', 'sise à', 'bien immobilier']);
  const adrMatch = adrCtx.match(/(?:sis[e]? à|situé à)\s+([^.,;]{5,80})/i);
  if (adrMatch) result.adresseBien = adrMatch[1].trim();

  // Référence cadastrale / lot.
  const refMatch = text.match(/(?:section|cadastr\w*)\s+([A-Z0-9\s°n°]{2,20})/i);
  if (refMatch) result.reference = refMatch[0].trim();

  // Notaire instrumentaire.
  const notaireMatch = text.match(/(?:Maître|Me\.?|M\.)\s+([A-ZÀ-Ý][\wÀ-ÿ'’-]+)[^.]{0,20}?notaire[^.]{0,30}?(?:à|au)\s+([A-ZÀ-Ý][\wÀ-ÿ '’-]{2,30})/i);
  if (notaireMatch) result.notaire = `M ${notaireMatch[1]}, notaire à ${notaireMatch[2].trim()}`;

  return result;
}

// Promesse / compromis de vente — reprend la base de parseActeFields (prix,
// parties, adresse, notaire) et ajoute les deux échéances clés que le broker
// doit suivre : la date limite de levée des conditions suspensives et la
// date de réitération (signature de l'acte authentique) prévue.
export function parsePromesseFields(text) {
  const base = parseActeFields(text);
  const result = {
    ...base,
    dateSignaturePromesse: base.dateSignature,
    dateLimiteConditionsSuspensives: null,
    dateReiterationPrevue: null,
  };
  delete result.dateSignature;

  const cs = findDateNear(text, [
    'conditions suspensives seront réputées réalisées au plus tard le',
    'conditions suspensives devront être réalisées au plus tard le',
    'réalisation des conditions suspensives',
    'levée des conditions suspensives',
    'conditions suspensives',
    'au plus tard le',
  ]);
  result.dateLimiteConditionsSuspensives = cs.date;
  if (cs.date) result.confidence.dateLimiteConditionsSuspensives = cs.confidence;

  const re = findDateNear(text, [
    'réitération par acte authentique',
    'acte authentique sera reçu',
    'signature de l\u2019acte authentique',
    'date prévue de signature',
    'réitération de la vente',
    'réitération',
    'acte authentique',
  ]);
  result.dateReiterationPrevue = re.date;
  if (re.date) result.confidence.dateReiterationPrevue = re.confidence;

  return result;
}
