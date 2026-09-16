// Moteur de génération PDF — sépare du fichier documentFields.js (léger,
// sans dépendance lourde) pour que les pages qui n'ont besoin que des
// champs n'entraînent pas jsPDF dans leur bundle.
import { loadTemplate, applyDefaults } from './documentFields.js';

export async function generateDocumentPdf({ typeId, variante, champs, societe, numero }) {
  const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), loadTemplate(typeId)]);
  if (!mod) throw new Error('Modèle de document introuvable.');

  const filledChamps = applyDefaults(mod.FIELDS, {
    ...champs,
    _agenceRaisonSociale: societe?.nom,
    _agenceAdresse: societe?.adresse,
    _agenceCpi: societe?.cpi,
    _agenceRcp: societe?.rcp,
  });

  const sections = mod.buildSections(filledChamps, variante);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 54;
  const pageW = 595;
  let y = 0;

  const ensure = (needed) => { if (y + needed > 780) { doc.addPage(); y = 60; } };

  // --- Page de garde ---
  y = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(160, 106, 44);
  doc.text((societe?.nom || '').toUpperCase(), marginX, y);
  y += 40;
  doc.setFontSize(22);
  doc.setTextColor(20, 24, 29);
  const titre = variante ? `${titreFor(typeId)} (${variante})` : titreFor(typeId);
  const titreLines = doc.splitTextToSize(titre.toUpperCase(), pageW - marginX * 2);
  doc.text(titreLines, marginX, y);
  y += titreLines.length * 26 + 10;
  if (numero) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(90, 95, 105);
    doc.text(`N° ${numero}`, marginX, y);
    y += 40;
  }
  doc.setDrawColor(226, 222, 212);
  doc.line(marginX, y, pageW - marginX, y);
  y += 30;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(172, 82, 54);
  const notice = doc.splitTextToSize(mod.DRAFT_NOTICE, pageW - marginX * 2);
  doc.text(notice, marginX, y);

  // --- Corps du document ---
  doc.addPage();
  y = 60;

  sections.forEach((section) => {
    ensure(40);
    doc.setFillColor(243, 241, 236);
    doc.rect(marginX, y, pageW - marginX * 2, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 24, 29);
    doc.text(section.title, marginX + 8, y + 15);
    y += 34;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 44, 50);
    section.paragraphs.forEach((p) => {
      const lines = doc.splitTextToSize(p, pageW - marginX * 2);
      ensure(lines.length * 13 + 10);
      doc.text(lines, marginX, y);
      y += lines.length * 13 + 10;
    });
    y += 6;
  });

  ensure(60);
  y += 20;
  doc.setDrawColor(226, 222, 212);
  doc.line(marginX, y, pageW - marginX, y);
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 24, 29);
  doc.text('Le Mandant', marginX, y);
  doc.text('Le Mandataire', 320, y);

  return doc;
}

function titreFor(typeId) {
  const map = {
    mandat_vente: 'Mandat de vente',
    mandat_recherche: 'Mandat de recherche',
    avenant: 'Avenant',
    offre_achat: "Offre d'achat",
  };
  return map[typeId] || typeId;
}

export async function downloadDocumentPdf(args) {
  const doc = await generateDocumentPdf(args);
  const slug = (args.numero || titreFor(args.typeId)).replace(/[^\w-]+/g, '_');
  doc.save(`${slug}.pdf`);
}
