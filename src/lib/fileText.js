// Lecture de fichiers déposés dans l'application (Copilote, Facturation,
// Notes de frais) → texte exploitable par l'IA. Tout se passe dans le
// navigateur : rien n'est envoyé à un serveur avant la demande à l'IA.
//   PDF → pdf.js (texte natif) ; images → OCR (tesseract.js, français) ;
//   Word .docx → XML du document ; Excel/CSV → tableau texte ;
//   txt/md/json/eml → tel quel.

const MAX = 200000;

export const TYPES_ACCEPTES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.eml';

function ext(file) {
  return (file.name.split('.').pop() || '').toLowerCase();
}

export function estImage(file) {
  return /^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext(file));
}
export function estPdf(file) {
  return file.type === 'application/pdf' || ext(file) === 'pdf';
}

export async function extractTextFromFile(file, { onProgress } = {}) {
  const e = ext(file);
  if (estPdf(file)) {
    const { extractPdfText } = await import('./pdfExtract');
    const t = await extractPdfText(file);
    if (t && t.trim().length > 40) return { texte: t.slice(0, MAX), methode: 'pdf' };
    // PDF scanné (pas de texte) : OCR de la première page impossible sans
    // rasterisation — on le signale clairement.
    return { texte: t || '', methode: 'pdf', avertissement: 'Ce PDF ne contient pas de texte sélectionnable (scan) : le contenu n’a pas pu être lu.' };
  }
  if (estImage(file)) {
    const { ocrReceipt } = await import('./ocr');
    onProgress?.('Reconnaissance du texte (OCR)…');
    const r = await ocrReceipt(file);
    return { texte: (r.text || '').slice(0, MAX), methode: 'ocr', champsTicket: r };
  }
  if (e === 'docx') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('Document Word illisible.');
    const texte = xml
      .replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n').trim();
    return { texte: texte.slice(0, MAX), methode: 'docx' };
  }
  if (['xlsx', 'xls', 'csv'].includes(e)) {
    const { readWorkbookSheets } = await import('./xlsxImport');
    const sheets = await readWorkbookSheets(file);
    const texte = sheets.map((s) => {
      const header = s.columns.map((c) => c.label).join(' | ');
      const rows = s.rows.slice(0, 500).map((r) => s.columns.map((c) => String(r[c.index] ?? '')).join(' | '));
      return `### Onglet ${s.name}\n${header}\n${rows.join('\n')}`;
    }).join('\n\n');
    return { texte: texte.slice(0, MAX), methode: 'tableur' };
  }
  if (['txt', 'md', 'json', 'eml', 'html', 'htm'].includes(e) || /^text\//.test(file.type)) {
    const t = await file.text();
    return { texte: t.slice(0, MAX), methode: 'texte' };
  }
  throw new Error(`Format non pris en charge : .${e || '?'} (acceptés : PDF, images, Word, Excel, CSV, texte).`);
}
