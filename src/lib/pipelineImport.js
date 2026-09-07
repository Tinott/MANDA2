import * as XLSX from 'xlsx';

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function makeGuesser(synonyms) {
  return function guessField(header) {
    const h = normalize(header);
    if (!h) return 'ignorer';
    for (const [field, syns] of Object.entries(synonyms)) {
      if (syns.some((s) => h === normalize(s))) return field;
    }
    for (const [field, syns] of Object.entries(synonyms)) {
      if (syns.some((s) => h.includes(normalize(s)))) return field;
    }
    return 'ignorer';
  };
}

// Lit toutes les feuilles d'un classeur avec un mappage deviné selon le
// dictionnaire de synonymes fourni — même logique que l'import Contacts,
// réutilisée ici pour les deux tableaux de suivi (prospects, courriers).
export async function readWorkbookSheets(file, synonyms) {
  const guessField = makeGuesser(synonyms);
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!rows.length) return { name, columns: [], rows: [], hasHeader: false };

    // Cherche la ligne d'en-tête parmi les 5 premières lignes — les
    // classeurs de suivi réels ont souvent un titre et des instructions
    // au-dessus du vrai tableau (comme les deux fichiers du client).
    let headerRowIndex = -1;
    let bestGuesses = null;
    for (let i = 0; i < Math.min(10, rows.length); i += 1) {
      const guesses = rows[i].map((h) => guessField(h));
      const matchCount = guesses.filter((g) => g !== 'ignorer').length;
      if (matchCount >= 3 && (!bestGuesses || matchCount > bestGuesses.filter((g) => g !== 'ignorer').length)) {
        headerRowIndex = i;
        bestGuesses = guesses;
      }
    }

    const hasHeader = headerRowIndex !== -1;
    const headerRow = hasHeader ? rows[headerRowIndex] : [];
    const dataRows = hasHeader ? rows.slice(headerRowIndex + 1) : rows;
    const sampleRow = dataRows[0] || [];
    const colCount = Math.max(...rows.map((r) => r.length), 1);

    const columns = Array.from({ length: colCount }).map((_, i) => ({
      index: i,
      label: hasHeader ? String(headerRow[i] ?? '').trim() || `Colonne ${i + 1}` : `Colonne ${i + 1}`,
      sample: String(sampleRow[i] ?? ''),
      guess: hasHeader ? bestGuesses[i] : 'ignorer',
    }));

    return { name, columns, rows: dataRows, hasHeader };
  }).filter((s) => s.rows.length > 0);
}

// Applique un mappage {colIndex: champ} pour produire des enregistrements
// génériques — aucune règle propre aux contacts ici, chaque champ mappé
// devient une clé de l'objet ; les colonnes en double sur un même champ
// sont concaténées.
export function buildRecordsFromMapping(sheet, mapping, extraFields = {}) {
  return sheet.rows
    .map((row) => {
      const rec = { ...extraFields };
      let hasAnything = false;
      sheet.columns.forEach((col) => {
        const field = mapping[col.index];
        const value = String(row[col.index] ?? '').trim();
        if (!value || !field || field === 'ignorer') return;
        hasAnything = true;
        rec[field] = rec[field] ? `${rec[field]} / ${value}` : value;
      });
      return hasAnything ? rec : null;
    })
    .filter(Boolean);
}

