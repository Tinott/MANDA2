import pptxgen from 'pptxgenjs';

// Mémorandum d'information (IM) — structure professionnelle calquée sur les
// IM Capital Markets : couverture photo, sommaire, intercalaires numérotés,
// 01 Situation géographique · 02 Composition du bien · 03 Conditions
// financières (schéma bail + tableau) · 04 Modalités de cession & contact.

const INK = '14181D';
const PAPER = 'FFFFFF';
const MUTED = '565F6B';
const LINE = 'E2DED4';


export async function generateImPptx(bien, societe) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'IM', width: 13.33, height: 7.5 });
  pptx.layout = 'IM';
  const nomSociete = (societe?.nom || 'BROKER IMMOBILIER').toUpperCase();
  const annee = new Date().getFullYear();
  const moisAnnee = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  let pageNum = 0;

  const footer = (slide) => {
    pageNum += 1;
    slide.addText(`© ${annee} ${nomSociete} — Confidentiel`, { x: 0, y: 7.12, w: 13.33, h: 0.3, align: 'center', fontSize: 8, color: MUTED, fontFace: 'Georgia', italic: true });
    if (pageNum > 1) slide.addText(String(pageNum), { x: 12.6, y: 7.05, w: 0.5, h: 0.35, fontSize: 10, bold: true, color: INK, align: 'center' });
  };

  const brand = (slide, dark = false) => {
    slide.addText(nomSociete, { x: 0.5, y: 0.35, w: 4.5, h: 0.5, fontSize: 18, charSpacing: 6, bold: true, color: dark ? 'FFFFFF' : INK, fontFace: 'Arial' });
  };

  const sectionHeader = (slide, num, titre, sousTitre) => {
    slide.addText(num, { x: 0.35, y: 0.3, w: 1, h: 0.6, fontSize: 28, bold: true, color: INK, fontFace: 'Arial' });
    slide.addShape('rect', { x: 1.1, y: 0.62, w: 1.4, h: 0.07, fill: { color: INK } });
    slide.addText(titre.toUpperCase(), { x: 0.9, y: 0.85, w: 9.5, h: 0.6, fontSize: 24, bold: true, color: '1F3A2E', fontFace: 'Arial' });
    if (sousTitre) slide.addText(sousTitre.toUpperCase(), { x: 0.95, y: 1.4, w: 9.5, h: 0.45, fontSize: 15, color: INK, charSpacing: 2, fontFace: 'Arial' });
  };

  const divider = (num, titre) => {
    const s = pptx.addSlide();
    s.background = { color: PAPER };
    brand(s);
    s.addText(num, { x: 1.4, y: 2.1, w: 3.3, h: 2.1, fontSize: 150, bold: true, color: '1F8A5F', fontFace: 'Arial' });
    s.addText(titre.toUpperCase(), { x: 4.9, y: 2.7, w: 7.6, h: 1.4, fontSize: 36, bold: true, color: INK, fontFace: 'Arial' });
    s.addShape('rect', { x: 4.95, y: 4.0, w: 0.8, h: 0.06, fill: { color: INK } });
    footer(s);
    return s;
  };

  // ---------------------------------------------------------------- Couverture
  const cover = pptx.addSlide();
  cover.background = { color: PAPER };
  cover.addShape('rect', { x: 8.6, y: 0, w: 4.73, h: 7.5, fill: { color: INK } });
  brand(cover);
  if (bien?.photoPrincipale) {
    cover.addImage({ data: bien.photoPrincipale, x: 4.85, y: 2.0, w: 7.75, h: 3.25, sizing: { type: 'cover', w: 7.75, h: 3.25 } });
  }
  cover.addText((bien?.titre || `${bien?.typeBien || 'ACTIF'}`).toUpperCase(), { x: 0.4, y: 2.4, w: 4.4, h: 1.5, fontSize: 36, bold: true, color: INK, fontFace: 'Arial' });
  if (bien?.locataire) {
    cover.addText([{ text: 'LOCATAIRE :\n', options: { color: MUTED, bold: false } }, { text: bien.locataire.toUpperCase(), options: { bold: true, color: INK } }], { x: 0.4, y: 3.95, w: 4.4, h: 1.1, fontSize: 26, fontFace: 'Arial' });
  }
  cover.addText(`${moisAnnee.charAt(0).toUpperCase() + moisAnnee.slice(1)} — Opportunité d'investissement — Confidentiel`, { x: 0.42, y: 5.15, w: 4.4, h: 0.4, fontSize: 11, italic: true, color: MUTED, fontFace: 'Georgia' });
  cover.addShape('rect', { x: 0, y: 6.3, w: 13.33, h: 0.75, fill: { color: PAPER } });
  cover.addText((bien?.adresse || 'Adresse du bien').toUpperCase(), { x: 0.3, y: 6.28, w: 12.7, h: 0.7, fontSize: 30, bold: true, color: INK, fontFace: 'Arial' });
  footer(cover);

  // ------------------------------------------------------------------ Sommaire
  const som = pptx.addSlide();
  som.background = { color: PAPER };
  brand(som);
  som.addShape('rect', { x: 0, y: 0, w: 0.55, h: 7.5, fill: { color: INK } });
  som.addText('SOMMAIRE', { x: 0.02, y: 2.4, w: 0.5, h: 3, fontSize: 20, bold: true, color: 'FFFFFF', rotate: 270, align: 'center', fontFace: 'Arial' });
  const items = ['Situation géographique', 'Composition du bien', 'Conditions financières', 'Modalités de cession & contact'];
  items.forEach((t, i) => {
    const yy = 1.3 + i * 1.35;
    som.addText(String(i + 1), { x: 1.5, y: yy, w: 0.9, h: 0.9, fontSize: 44, bold: true, color: INK, fontFace: 'Arial' });
    som.addShape('rect', { x: 1.55, y: yy + 0.78, w: 0.75, h: 0.28, fill: { color: '1F8A5F' } });
    som.addText(t.toUpperCase(), { x: 2.7, y: yy + 0.18, w: 8.5, h: 0.6, fontSize: 18, bold: true, color: INK, fontFace: 'Arial' });
  });
  footer(som);

  // ------------------------------------------- 01 — Situation géographique
  divider('01', 'Situation\ngéographique');
  const geo = pptx.addSlide();
  geo.background = { color: PAPER };
  geo.addShape('rect', { x: 8.55, y: 0, w: 4.78, h: 7.5, fill: { color: INK } });
  brand(geo, false);
  sectionHeader(geo, '01', "Présentation de l'emplacement");
  geo.addText(`Opportunité d'acquisition — ${bien?.typeBien || 'actif'}${bien?.locataire ? ` loué à ${bien.locataire.toUpperCase()}` : ''}`, { x: 0.5, y: 1.75, w: 5.4, h: 0.6, fontSize: 13, bold: true, color: INK, fontFace: 'Georgia' });
  geo.addText(bien?.environnement || "Décrivez ici le bassin économique, les accès routiers et la dynamique du secteur (champ « Environnement » de l'assistant IM).", { x: 0.5, y: 2.35, w: 5.4, h: 4.3, fontSize: 13.5, color: INK, fontFace: 'Georgia', lineSpacingMultiple: 1.25, align: 'justify' });
  if (bien?.photoSituation) geo.addImage({ data: bien.photoSituation, x: 6.2, y: 1.8, w: 6.3, h: 4.6, sizing: { type: 'cover', w: 6.3, h: 4.6 } });
  footer(geo);

  // ------------------------------------------------ 02 — Composition du bien
  divider('02', 'Composition\ndu bien');
  const comp = pptx.addSlide();
  comp.background = { color: PAPER };
  comp.addShape('rect', { x: 9.0, y: 0, w: 4.33, h: 7.5, fill: { color: INK } });
  brand(comp);
  sectionHeader(comp, '02', 'Composition du local');
  const details = [
    bien?.surface ? `Surface totale : ${bien.surface} m²` : null,
    bien?.typeBien ? `Typologie : ${bien.typeBien}` : null,
    bien?.reference ? `Référence : ${bien.reference}` : null,
    bien?.dpe ? `DPE : ${bien.dpe}` : null,
  ].filter(Boolean);
  comp.addText(details.map((d) => ({ text: `•  ${d}\n`, options: {} })), { x: 0.55, y: 1.85, w: 4.1, h: 2.5, fontSize: 14, color: INK, fontFace: 'Georgia', lineSpacingMultiple: 1.4 });
  if (bien?.description) comp.addText(bien.description, { x: 0.55, y: 4.0, w: 4.1, h: 2.6, fontSize: 12, color: MUTED, fontFace: 'Georgia', lineSpacingMultiple: 1.2, align: 'justify' });
  if (bien?.photoComposition) comp.addImage({ data: bien.photoComposition, x: 4.95, y: 1.85, w: 7.5, h: 4.7, sizing: { type: 'contain', w: 7.5, h: 4.7 } });
  footer(comp);

  // --------------------------------------------- 03 — Conditions financières
  divider('03', 'Conditions\nfinancières');

  // 3a — schéma bail (boîtes alternées comme l'IM Tesla)
  const fin = pptx.addSlide();
  fin.background = { color: PAPER };
  fin.addShape('rect', { x: 8.55, y: 0, w: 4.78, h: 7.5, fill: { color: INK } });
  brand(fin);
  sectionHeader(fin, '03', 'Conditions financières');
  const loyer = Number(bien?.loyerAnnuel) || 0;
  const boxes = [
    { t: 'Loyer', v: loyer ? `${loyer.toLocaleString('fr-FR')} € annuel HC, hors TVA` : 'À renseigner', x: 2.9 },
    { t: 'Durée du bail', v: bien?.dureeBail || '3/6/9', x: 6.1 },
    { t: 'Indexation', v: bien?.indexation || 'ILC — Triennale', x: 2.9 },
    { t: "Date d'effet du bail", v: bien?.dateEffetBail || '—', x: 6.1 },
    { t: 'Activité du locataire', v: (bien?.activiteLocataire || '').slice(0, 220) || '—', x: 2.9, h: 1.3 },
    { t: 'Régime des charges', v: bien?.tripleNet ? 'Loyer triple net — charges récupérables sauf art. 606' : 'Charges selon bail', x: 6.1 },
  ];
  let by = 1.85;
  boxes.forEach((b, i) => {
    const h = b.h || 0.8;
    fin.addShape('rect', { x: b.x, y: by, w: 4.2, h, fill: { color: i % 2 ? 'E9EDF2' : 'FFFFFF' }, line: { color: LINE, width: 1 } });
    fin.addText([{ text: `${b.t}\n`, options: { bold: true, underline: true, fontSize: 13 } }, { text: b.v, options: { fontSize: 10.5 } }], { x: b.x + 0.15, y: by + 0.06, w: 3.9, h: h - 0.1, color: INK, fontFace: 'Georgia', align: 'center', valign: 'middle' });
    if (i < boxes.length - 1) fin.addShape('rect', { x: b.x + 2.05, y: by + h, w: 0.1, h: 0.18, fill: { color: '35506B' } });
    by += h + 0.18;
    if (by > 6.4) by = 6.4;
  });
  footer(fin);

  // 3b — tableau lot / surface / loyer / prix + modalités
  const fin2 = pptx.addSlide();
  fin2.background = { color: PAPER };
  fin2.addShape('rect', { x: 9.0, y: 0, w: 4.33, h: 7.5, fill: { color: INK } });
  brand(fin2);
  sectionHeader(fin2, '03', 'Conditions financières');
  const prix = Number(bien?.prix) || 0;
  const rendement = prix && loyer ? `${((loyer / prix) * 100).toFixed(2).replace('.', ',')} %` : '—';
  fin2.addTable(
    [
      [
        { text: 'Lot', options: { bold: true, fill: { color: 'D9EBF5' } } },
        { text: 'Surface', options: { bold: true, fill: { color: 'D9EBF5' } } },
        { text: 'Loyer HT HC €/an', options: { bold: true, fill: { color: 'D9EBF5' } } },
        { text: 'Prix de vente net vendeur', options: { bold: true, fill: { color: 'D9EBF5' } } },
        { text: 'Rendement AEM', options: { bold: true, fill: { color: 'D9EBF5' } } },
      ],
      [
        bien?.adresse || '—',
        bien?.surface ? `${bien.surface} m²` : '—',
        loyer ? `${loyer.toLocaleString('fr-FR')} €` : '—',
        prix ? `${prix.toLocaleString('fr-FR')} €` : 'Nous consulter',
        rendement,
      ],
    ],
    { x: 0.6, y: 2.0, w: 8.1, fontSize: 12, fontFace: 'Georgia', color: INK, border: { type: 'solid', color: INK, pt: 0.75 }, align: 'center', valign: 'middle', rowH: 0.55 }
  );
  const bullets = [
    bien?.prixRecommande ? `Prix net vendeur recommandé : ${Number(bien.prixRecommande).toLocaleString('fr-FR')} €` : null,
    bien?.modaliteVente || "Vente d'actif de gré à gré",
    bien?.honorairesPct ? `Honoraires : ${bien.honorairesPct} % HT du prix Hors Droits` : null,
    bien?.situationLocative || null,
  ].filter(Boolean);
  fin2.addText(bullets.map((b) => ({ text: `•   ${b}\n`, options: {} })), { x: 0.75, y: 3.6, w: 7.9, h: 2.4, fontSize: 14, color: INK, fontFace: 'Georgia', lineSpacingMultiple: 1.5 });
  footer(fin2);

  // ------------------------------------- 04 — Modalités de cession & contact
  divider('04', 'Modalités de cession\n& contacts');
  const mod = pptx.addSlide();
  mod.background = { color: PAPER };
  brand(mod);
  sectionHeader(mod, '04', 'Modalités de cession');
  mod.addShape('rect', { x: 0.55, y: 1.8, w: 6.6, h: 0.42, fill: { color: INK } });
  mod.addText([{ text: 'Processus de vente :', options: { bold: true, color: 'FFFFFF' } }, { text: `   ${bien?.modaliteVente || "Appel d'offres"}`, options: { color: 'FFFFFF' } }], { x: 0.65, y: 1.8, w: 6.4, h: 0.42, fontSize: 12, fontFace: 'Arial', valign: 'middle' });
  const lignesCession = [
    ['Type de consultation', 'Asset deal'],
    ['Prix', prix ? `${prix.toLocaleString('fr-FR')} € net vendeur` : 'Nous consulter'],
    ['Type de cession', "Vente d'actif en TVA"],
    ['Honoraires de vente', bien?.honorairesPct ? `${bien.honorairesPct} % HT — charge acquéreur` : 'Nous consulter'],
  ];
  let cy = 2.35;
  lignesCession.forEach(([k, v]) => {
    mod.addText([{ text: `${k} : `, options: { bold: true } }, { text: v }], { x: 0.65, y: cy, w: 6.4, h: 0.35, fontSize: 12.5, color: INK, fontFace: 'Georgia' });
    cy += 0.4;
  });
  mod.addShape('rect', { x: 0.55, y: cy + 0.15, w: 6.6, h: 0.42, fill: { color: '1F8A5F' } });
  mod.addText("CONTENU DE L'OFFRE INDICATIVE", { x: 0.65, y: cy + 0.15, w: 6.4, h: 0.42, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: 'Arial', valign: 'middle' });
  const offre = [
    "Présentation de l'acquéreur",
    "Prix de l'actif net vendeur (hors droits et honoraires de commercialisation)",
    'Détail des sources de financement envisagées',
    "Description et nature des audits souhaités pour l'acquisition",
    "Processus interne de validation de l'investissement",
    'Coordonnées de la personne à contacter et étude notariale',
  ];
  mod.addText(offre.map((o) => ({ text: `•   ${o}\n`, options: {} })), { x: 0.7, y: cy + 0.7, w: 6.4, h: 2.4, fontSize: 11.5, color: INK, fontFace: 'Georgia', lineSpacingMultiple: 1.3 });
  if (bien?.photoPrincipale) mod.addImage({ data: bien.photoPrincipale, x: 7.6, y: 1.8, w: 5.2, h: 4.6, sizing: { type: 'cover', w: 5.2, h: 4.6 } });
  footer(mod);

  // Contact
  const contact = pptx.addSlide();
  contact.background = { color: PAPER };
  brand(contact);
  if (societe?.photoContact) contact.addImage({ data: societe.photoContact, x: 1.3, y: 1.7, w: 2.4, h: 2.4, rounding: true, sizing: { type: 'cover', w: 2.4, h: 2.4 } });
  contact.addText('VOTRE CONTACT', { x: 4.2, y: 2.6, w: 7.5, h: 0.9, fontSize: 44, bold: true, color: INK, fontFace: 'Arial' });
  contact.addShape('rect', { x: 1.35, y: 4.35, w: 4.4, h: 0.14, fill: { color: INK } });
  contact.addText((societe?.contactNom || '').toUpperCase(), { x: 1.35, y: 4.6, w: 4.6, h: 0.6, fontSize: 22, bold: true, color: INK, fontFace: 'Arial' });
  if (societe?.telephone) contact.addText(societe.telephone, { x: 6.8, y: 4.45, w: 5.5, h: 0.5, fontSize: 20, color: INK, fontFace: 'Georgia' });
  if (societe?.email) contact.addText(societe.email, { x: 6.8, y: 5.05, w: 5.8, h: 0.5, fontSize: 18, underline: true, color: INK, fontFace: 'Georgia' });
  footer(contact);

  return pptx;
}

export async function downloadImPptx(bien, societe) {
  const pptx = await generateImPptx(bien, societe);
  const slug = (bien?.adresse || 'memorandum').replace(/[^\w-]+/g, '_').slice(0, 60);
  await pptx.writeFile({ fileName: `IM_${slug}.pptx` });
}
