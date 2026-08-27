import { jsPDF } from 'jspdf';
import { formatEUR, formatDate } from './calc';

export function generateInvoicePdf(facture, societe) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ink = societe?.couleurAccent || '#a06a2c';
  const marginX = 48;
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 24, 29);
  doc.text(societe?.nom || 'SARL', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 95, 105);
  y += 18;
  [
    societe?.adresse,
    `SIRET ${societe?.siret || '—'}`,
    societe?.carteT ? `Carte T n° ${societe.carteT}` : null,
    societe?.cpi ? `CPI ${societe.cpi}` : null,
  ]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(line, marginX, y);
      y += 12;
    });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(ink);
  doc.text('FACTURE', 400, 74, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 95, 105);
  let hy = 92;
  doc.text(`N° ${facture.numero}`, 400, hy); hy += 14;
  doc.text(`Date d'émission : ${formatDate(facture.dateEmission)}`, 400, hy); hy += 14;
  if (facture.clientNumero) { doc.text(`N° client : ${facture.clientNumero}`, 400, hy); hy += 14; }
  if (facture.dateEcheance) { doc.text(`Échéance : ${formatDate(facture.dateEcheance)}`, 400, hy); hy += 14; }

  y = 150;
  doc.setDrawColor(226, 222, 212);
  doc.line(marginX, y, 547, y);
  y += 22;

  // Référence — mandat / bien / notaire, à l'image d'une facture de commission
  // d'agence transmise à un office notarial.
  if (facture.refTitre || facture.mandatRef || facture.notaire) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 24, 29);
    if (facture.refTitre) { doc.text(`Réf. : ${facture.refTitre}`, marginX, y); y += 13; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 95, 105);
    if (facture.mandatRef) { doc.text(`Avenant au mandat n° ${facture.mandatRef}${facture.bienAdresse ? ` — Bien sis ${facture.bienAdresse}` : ''}`, marginX, y); y += 12; }
    if (facture.notaire) { doc.text(`Acte reçu par ${facture.notaire}`, marginX, y); y += 12; }
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 24, 29);
  doc.text('Facturé à', marginX, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 66, 75);
  doc.text(facture.client || '—', marginX, y);
  if (facture.clientAdresse) {
    y += 13;
    doc.text(facture.clientAdresse, marginX, y);
  }

  if (facture.bienAdresse && !facture.refTitre) {
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 24, 29);
    doc.text('Objet', marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 66, 75);
    doc.text(`Honoraires — ${facture.bienAdresse}`, marginX, y);
  }

  y += 32;
  doc.setFillColor(20, 24, 29);
  doc.rect(marginX, y, 499, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Libellé', marginX + 10, y + 16);
  doc.text('Montant HT', 547 - 10, y + 16, { align: 'right' });
  y += 24;

  const lignes = facture.lignes?.length
    ? facture.lignes
    : [{ libelle: facture.libelle || 'Honoraires de transaction', montant: facture.montantHT }];

  doc.setFont('helvetica', 'normal');
  lignes.forEach((l, i) => {
    const rowY = y + i * 22 + 16;
    if (i % 2 === 1) {
      doc.setFillColor(247, 246, 242);
      doc.rect(marginX, y + i * 22, 499, 22, 'F');
    }
    const negatif = Number(l.montant) < 0;
    doc.setTextColor(negatif ? 172 : 40, negatif ? 82 : 44, negatif ? 54 : 50);
    doc.text(l.libelle, marginX + 10, rowY, { maxWidth: 340 });
    doc.text(formatEUR(l.montant), 547 - 10, rowY, { align: 'right' });
  });
  y += lignes.length * 22 + 16;

  const totalsX = 380;
  doc.setDrawColor(226, 222, 212);
  doc.line(totalsX, y, 547, y);
  y += 16;
  const row = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 10);
    doc.setTextColor(bold ? 20 : 90, bold ? 24 : 95, bold ? 29 : 105);
    doc.text(label, totalsX, y);
    doc.text(formatEUR(value), 547, y, { align: 'right' });
    y += 18;
  };
  row('Total HT', facture.montantHT);
  row(`TVA (${facture.tauxTva ?? 20}%)`, facture.montantTVA);
  y += 4;
  row('Total TTC', facture.montantTTC, true);

  y += 26;
  doc.setDrawColor(226, 222, 212);
  doc.line(marginX, y, 547, y);
  y += 16;

  // Règlement & coordonnées bancaires
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 24, 29);
  doc.text('Règlement', marginX, y);
  doc.text('Coordonnées bancaires', 300, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 95, 105);
  doc.text(`Virement bancaire${facture.echeanceLabel ? ` — ${facture.echeanceLabel}` : ' — à réception'}`, marginX, y, { maxWidth: 230 });
  const banque = [
    societe?.banque ? `Banque : ${societe.banque}` : null,
    societe?.iban ? `IBAN : ${societe.iban}` : null,
    societe?.bic ? `BIC : ${societe.bic}` : null,
  ].filter(Boolean);
  banque.forEach((line, i) => doc.text(line, 300, y + i * 11));
  y += Math.max(24, banque.length * 11 + 6);

  doc.setDrawColor(226, 222, 212);
  doc.line(marginX, y, 547, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 126, 135);
  const mentions = [
    facture.tauxTva === 0 ? 'TVA non applicable, art. 293 B du CGI.' : 'TVA acquittée sur les débits.',
    societe?.rcp ? `Assurance RC Pro : ${societe.rcp}.` : null,
    societe?.rcs ? `RCS ${societe.rcs}.` : null,
    societe?.capitalSocial ? `Capital social ${formatEUR(societe.capitalSocial)}.` : null,
    societe?.tvaIntra ? `TVA intracommunautaire ${societe.tvaIntra}.` : null,
    facture.redevable ? `Honoraires à la charge : ${facture.redevable}.` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  doc.text(mentions, marginX, y, { maxWidth: 499 });

  return doc;
}

export function downloadInvoicePdf(facture, societe) {
  const doc = generateInvoicePdf(facture, societe);
  doc.save(`${facture.numero}.pdf`);
}
