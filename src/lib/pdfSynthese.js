import { jsPDF } from 'jspdf';
import { formatEUR, formatDate, aggregatePeriod, soldeTresorerieAt } from './calc';

const INK = [20, 24, 29];
const MUTED = [90, 95, 105];
const LINE = [226, 222, 212];

export function generateSynthesePdf({ societe, mandats, factures, notesFrais, registre }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageW = 595;
  let y = 0;

  const newPage = () => { doc.addPage(); y = 56; };
  const ensure = (needed) => { if (y + needed > 780) newPage(); };

  const h1 = (text) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(text, marginX, y);
    y += 8;
    doc.setDrawColor(...LINE);
    doc.line(marginX, y, pageW - marginX, y);
    y += 22;
  };
  const kv = (label, value) => {
    ensure(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(label, marginX, y);
    doc.setTextColor(...INK);
    doc.text(String(value ?? '—'), marginX + 180, y, { maxWidth: pageW - marginX * 2 - 180 });
    y += 15;
  };
  const rowLine = (cols, bold = false) => {
    ensure(15);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...(bold ? INK : MUTED));
    let x = marginX;
    cols.forEach(({ text, w, align }) => {
      doc.text(String(text), align === 'right' ? x + w : x, y, align === 'right' ? { align: 'right' } : {});
      x += w;
    });
    y += 14;
  };

  // --- Couverture ---
  y = 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text('Synthèse du compte', marginX, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(societe?.nom || 'Société non renseignée', marginX, y);
  y += 16;
  doc.setFontSize(9);
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, marginX, y);
  y += 40;

  // --- Identité ---
  h1('Identité de la société');
  kv('Raison sociale', societe?.nom);
  kv('SIRET', societe?.siret);
  kv('Adresse', societe?.adresse);
  kv('Régime de TVA', societe?.regimeTva);
  kv('Capital social', formatEUR(societe?.capitalSocial));
  y += 10;

  // --- KPIs globaux ---
  const totalCA = factures.filter((f) => f.statut !== 'Brouillon').reduce((s, f) => s + f.montantHT, 0);
  const totalFrais = notesFrais.reduce((s, n) => s + n.montantHT, 0);
  const solde = soldeTresorerieAt(registre, new Date().toISOString().slice(0, 10), societe?.soldeTresorerieInitial || 0);

  h1("Vue d'ensemble");
  kv('Mandats enregistrés', mandats.length);
  kv('Factures émises', factures.length);
  kv('Chiffre d\u2019affaires cumulé (HT)', formatEUR(totalCA));
  kv('Notes de frais enregistrées', notesFrais.length);
  kv('Charges cumulées (HT)', formatEUR(totalFrais));
  kv('Trésorerie estimée à date', formatEUR(solde));
  y += 10;

  // --- Mandats ---
  h1(`Mandats & biens (${mandats.length})`);
  if (mandats.length === 0) {
    kv('Aucun mandat enregistré', '');
  } else {
    rowLine([
      { text: 'Adresse', w: 220 }, { text: 'Type', w: 90 }, { text: 'Client', w: 130 }, { text: 'Statut', w: 65 },
    ], true);
    mandats.forEach((m) => {
      rowLine([
        { text: m.adresse || '—', w: 220 }, { text: m.typeMandat || '—', w: 90 },
        { text: m.client || '—', w: 130 }, { text: m.statut || '—', w: 65 },
      ]);
    });
  }
  y += 10;

  // --- Factures ---
  h1(`Facturation (${factures.length})`);
  if (factures.length === 0) {
    kv('Aucune facture émise', '');
  } else {
    rowLine([
      { text: 'N°', w: 90 }, { text: 'Client', w: 170 }, { text: 'Émission', w: 80 },
      { text: 'Statut', w: 70 }, { text: 'Montant TTC', w: 95, align: 'right' },
    ], true);
    factures.forEach((f) => {
      rowLine([
        { text: f.numero || '—', w: 90 }, { text: f.client || '—', w: 170 }, { text: formatDate(f.dateEmission), w: 80 },
        { text: f.statut || '—', w: 70 }, { text: formatEUR(f.montantTTC), w: 95, align: 'right' },
      ]);
    });
  }
  y += 10;

  // --- Notes de frais ---
  h1(`Notes de frais (${notesFrais.length})`);
  if (notesFrais.length === 0) {
    kv('Aucune dépense enregistrée', '');
  } else {
    rowLine([
      { text: 'Date', w: 80 }, { text: 'Commerçant / motif', w: 220 },
      { text: 'Catégorie', w: 130 }, { text: 'Montant TTC', w: 95, align: 'right' },
    ], true);
    notesFrais.forEach((n) => {
      rowLine([
        { text: formatDate(n.date), w: 80 }, { text: n.commercant || n.categorieLabel || '—', w: 220 },
        { text: n.categorieLabel || '—', w: 130 }, { text: formatEUR(n.montantTTC), w: 95, align: 'right' },
      ]);
    });
  }

  y += 24;
  ensure(30);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    'Document généré automatiquement à partir des données saisies dans Mandat — à conserver comme trace de votre activité.',
    marginX, y, { maxWidth: pageW - marginX * 2 }
  );

  return doc;
}

export function downloadSynthesePdf(state) {
  const doc = generateSynthesePdf(state);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`synthese-${date}.pdf`);
}
