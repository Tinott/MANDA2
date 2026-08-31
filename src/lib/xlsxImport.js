import * as XLSX from 'xlsx';

// Dictionnaire de synonymes pour deviner le champ cible d'une colonne à
// partir de son en-tête — les classeurs de contacts réels (comme celui du
// client) mélangent des intitulés différents d'un onglet à l'autre.
const FIELD_SYNONYMS = {
  societe: ['societe', 'entreprise', 'enseigne', 'nom societe', 'mandat de recherche', 'societe contact'],
  nom: ['nom', 'nom gerant', 'contact proprietaire', 'contact', 'proprietaire'],
  prenom: ['prenom'],
  email: ['mail', 'email', 'e mail'],
  telephone: ['telephone', 'tel', 'coordonnees telephoniques', 'numero'],
  adresse: ['adresse du bien', 'adresse postale', 'adresse'],
  notes: [
    'notes', 'notes adresse', 'adresse notes', 'notes localisation',
    'dossier interet', 'type d actif', 'statut', 'enseigne type', 'enseigne zone',
  ],
};

export const TARGET_FIELDS = [
  { id: 'ignorer', label: 'Ignorer' },
  { id: 'societe', label: 'Société' },
  { id: 'nom', label: 'Nom' },
  { id: 'prenom', label: 'Prénom' },
  { id: 'email', label: 'Email' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'adresse', label: 'Adresse' },
  { id: 'notes', label: 'Notes (autres infos)' },
];

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function guessField(header) {
  const h = normalize(header);
  if (!h) return 'ignorer';
  // Passe 1 : correspondance exacte — évite que « Prénom » (qui contient
  // "nom") ne soit happé par le champ Nom avant d'être comparé à lui-même.
  for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
    if (syns.some((s) => h === normalize(s))) return field;
  }
  // Passe 2 : correspondance partielle, pour les en-têtes composés.
  for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
    if (syns.some((s) => h.includes(normalize(s)))) return field;
  }
  return 'ignorer';
}

// Lit toutes les feuilles d'un classeur et propose, pour chacune, un
// mappage de colonnes deviné automatiquement — rien n'est encore importé,
// c'est une proposition à valider (ou corriger) à l'écran suivant.
export async function readWorkbookSheets(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
    if (!rows.length) return { name, columns: [], rows: [], hasHeader: false };

    const first = rows[0];
    // Une feuille "sans en-tête" (données dès la ligne 1) est repérée
    // quand la première ligne contient déjà un email ou un téléphone.
    const looksLikeData = first.some(
      (c) => /@/.test(String(c)) || /^\+?\d[\d .]{6,}$/.test(String(c).trim())
    );
    const guesses = first.map((h) => guessField(h));
    const hasHeader = !looksLikeData && guesses.some((g) => g !== 'ignorer');

    const colCount = Math.max(...rows.map((r) => r.length), 1);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const sampleRow = dataRows[0] || [];

    const columns = Array.from({ length: colCount }).map((_, i) => ({
      index: i,
      label: hasHeader ? String(first[i] ?? '').trim() || `Colonne ${i + 1}` : `Colonne ${i + 1}`,
      sample: String(sampleRow[i] ?? ''),
      guess: hasHeader ? guesses[i] : 'ignorer',
    }));

    return { name, columns, rows: dataRows, hasHeader };
  }).filter((s) => s.rows.length > 0);
}

// Applique un mappage {colIndex: champ} aux lignes d'une feuille pour
// produire des contacts. Plusieurs colonnes vers le même champ sont
// concaténées (utile pour les cellules "deux emails séparés par et").
export function buildContactsFromMapping(sheet, mapping) {
  return sheet.rows
    .map((row) => {
      const c = { societe: '', nom: '', prenom: '', email: '', telephone: '', adresse: '' };
      const extraNotes = [];
      sheet.columns.forEach((col) => {
        const field = mapping[col.index];
        const value = String(row[col.index] ?? '').trim();
        if (!value || !field || field === 'ignorer') return;
        if (field === 'notes') extraNotes.push(value);
        else c[field] = c[field] ? `${c[field]} / ${value}` : value;
      });
      c.notes = extraNotes.join(' — ');
      c.categorie = sheet.name.trim();
      const hasAnything = c.societe || c.nom || c.prenom || c.email || c.telephone;
      return hasAnything ? c : null;
    })
    .filter(Boolean);
}
