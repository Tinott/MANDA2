import { createWorker } from 'tesseract.js';

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('fra');
  }
  return workerPromise;
}

export async function ocrReceipt(file, onProgress) {
  const worker = await getWorker();
  if (onProgress) worker.setParameters && (await worker.setParameters({}));
  const { data } = await worker.recognize(file, {}, { text: true });
  const text = data.text || '';
  return { text, ...parseReceiptFields(text) };
}

const AMOUNT_RE = /(\d{1,4}[,.]\d{2})\s?(?:€|eur)?/gi;
const TVA_RATE_RE = /(20|10|5[.,]5|2[.,]1)\s?%/;

export function parseReceiptFields(text) {
  const lower = text.toLowerCase();
  const amounts = [...text.matchAll(AMOUNT_RE)].map((m) => parseFloat(m[1].replace(',', '.')));
  let montantTTC = amounts.length ? Math.max(...amounts) : null;

  // Cherche une ligne "total" en priorité.
  const totalLineMatch = lower.match(/total[^\n\d]{0,15}(\d{1,4}[,.]\d{2})/);
  if (totalLineMatch) montantTTC = parseFloat(totalLineMatch[1].replace(',', '.'));

  const dateMatch = text.match(/\b(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})\b/);
  let date = null;
  if (dateMatch) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = `20${y}`;
    date = `${y}-${m}-${d}`;
  }

  const tvaMatch = text.match(TVA_RATE_RE);
  const tauxTva = tvaMatch ? parseFloat(tvaMatch[1].replace(',', '.')) : 20;

  const commercantLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 2 && /[A-Za-zÀ-ÿ]/.test(l) && !/\d{2}[\/.\-]\d{2}/.test(l));

  return {
    montantTTC,
    date,
    tauxTva,
    commercant: commercantLine ? commercantLine.slice(0, 40) : '',
  };
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
