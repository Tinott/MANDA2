import pptxgen from 'pptxgenjs';
import { formatEUR } from './calc';

const INK = '14181D';
const BRASS = 'A06A2C';
const PAPER = 'F3F1EC';
const LINE = 'E2DED4';
const MUTED = '565F6B';

export async function generateImPptx(bien, societe) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'IM', width: 13.33, height: 7.5 });
  pptx.layout = 'IM';

  const nomSociete = (societe?.nom || 'BROKER IMMOBILIER').toUpperCase();

  // --- 00 · Couverture ---
  const cover = pptx.addSlide();
  cover.background = { color: INK };
  cover.addShape('rect', { x: 0, y: 6.9, w: 13.33, h: 0.6, fill: { color: BRASS } });
  cover.addText(nomSociete, { x: 0.7, y: 0.55, w: 8, h: 0.5, fontSize: 12, color: 'D8CBB2', charSpacing: 3, fontFace: 'Arial' });
  cover.addText(bien?.titre || 'OPPORTUNITÉ\nD\u2019INVESTISSEMENT', {
    x: 0.65, y: 2.2, w: 10.5, h: 2.4, fontSize: 42, bold: true, color: 'FFFFFF', fontFace: 'Georgia',
  });
  if (bien?.locataire) {
    cover.addText(`LOCATAIRE : ${bien.locataire.toUpperCase()}`, {
      x: 0.7, y: 4.55, w: 10, h: 0.5, fontSize: 16, bold: true, color: 'D8CBB2', fontFace: 'Arial',
    });
  }
  cover.addText((bien?.adresse || 'Adresse du bien').toUpperCase(), {
    x: 0.7, y: 6.15, w: 11.8, h: 0.5, fontSize: 20, bold: true, color: 'FFFFFF', fontFace: 'Arial',
  });
  cover.addText('Opportunité confidentielle — diffusion restreinte', {
    x: 0.7, y: 7.05, w: 8, h: 0.35, fontSize: 9, color: '8A93A0', fontFace: 'Arial',
  });

  // --- 01 · Présentation / situation ---
  const s1 = pptx.addSlide();
  s1.background = { color: 'FFFFFF' };
  sectionHeader(s1, '01', 'Présentation de l\u2019opportunité', nomSociete);
  const kpis = [
    ['Prix de vente net vendeur', bien?.prix ? formatEUR(bien.prix) : '—'],
    ['Surface', bien?.surface ? `${bien.surface} m²` : '—'],
    ['Loyer annuel HC', bien?.loyerAnnuel ? formatEUR(bien.loyerAnnuel) : '—'],
    ['Rendement brut', bien?.prix && bien?.loyerAnnuel ? `${((bien.loyerAnnuel / bien.prix) * 100).toFixed(2)} %` : '—'],
  ];
  kpis.forEach(([label, value], i) => {
    const x = 0.7 + i * 3;
    s1.addShape('rect', { x, y: 1.9, w: 2.7, h: 1.4, fill: { color: PAPER }, line: { color: LINE, width: 1 } });
    s1.addText(value, { x, y: 2.12, w: 2.7, h: 0.55, align: 'center', fontSize: 19, bold: true, color: INK, fontFace: 'Georgia' });
    s1.addText(label.toUpperCase(), { x: x + 0.1, y: 2.68, w: 2.5, h: 0.5, align: 'center', fontSize: 8, color: MUTED, charSpacing: 0.5 });
  });
  s1.addText(bien?.description || 'Description du bien et de son environnement à compléter.', {
    x: 0.7, y: 3.7, w: 11.9, h: 2.9, fontSize: 12.5, color: '2A2F36', valign: 'top', fontFace: 'Arial', lineSpacingMultiple: 1.35,
  });

  // --- 02 · Composition / caractéristiques ---
  const s2 = pptx.addSlide();
  s2.background = { color: 'FFFFFF' };
  sectionHeader(s2, '02', 'Composition du bien', nomSociete);
  const rows = [
    ['Type de bien', bien?.typeBien || '—'],
    ['Surface', bien?.surface ? `${bien.surface} m²` : '—'],
    ['Situation locative', bien?.situationLocative || '—'],
    ['Charges annuelles', bien?.charges ? formatEUR(bien.charges) : '—'],
    ['DPE', bien?.dpe || '—'],
    ['Référence cadastrale', bien?.reference || '—'],
  ];
  s2.addTable(
    rows.map(([k, v]) => [
      { text: k, options: { bold: true, color: MUTED, fontSize: 11, fill: { color: PAPER } } },
      { text: v, options: { color: INK, fontSize: 11 } },
    ]),
    { x: 0.7, y: 1.9, w: 11.9, colW: [4, 7.9], border: { type: 'solid', color: LINE, pt: 0.5 }, autoPage: false }
  );

  // --- 03 · Conditions financières (mise en page à blocs, comme un bail commercial) ---
  const s3 = pptx.addSlide();
  s3.background = { color: 'FFFFFF' };
  sectionHeader(s3, '03', 'Conditions financières', nomSociete);

  const block = (x, y, w, h, label, value) => {
    s3.addShape('rect', { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 } });
    s3.addText(label.toUpperCase(), { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.3, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 0.5 });
    s3.addText(value, { x: x + 0.18, y: y + 0.38, w: w - 0.36, h: h - 0.5, fontSize: 13, color: INK, fontFace: 'Georgia' });
  };
  block(0.7, 1.85, 4.6, 0.95, 'Loyer', bien?.loyerAnnuel ? `${formatEUR(bien.loyerAnnuel)} annuel HC, hors TVA` : '—');
  block(5.6, 1.85, 3, 0.95, 'Durée du bail', bien?.dureeBail || '3/6/9');
  block(0.7, 2.95, 4.6, 0.95, 'Indexation', bien?.indexation || 'ILC — révision triennale');
  block(5.6, 2.95, 3, 0.95, 'Date d\u2019effet', bien?.dateEffetBail || '—');
  block(0.7, 4.05, 7.9, 1.5, 'Activité', bien?.activiteLocataire || bien?.description || '—');
  block(0.7, 5.7, 4.6, 0.85, 'Loyer', bien?.tripleNet ? 'Triple net — charges récupérables' : 'Charges au réel');

  // --- Synthèse tarifaire & recommandation ---
  const s4 = pptx.addSlide();
  s4.background = { color: 'FFFFFF' };
  sectionHeader(s4, '04', 'Conditions de cession', nomSociete);
  s4.addTable(
    [
      [
        { text: 'Lot', options: { bold: true, fill: { color: PAPER }, color: MUTED, fontSize: 10.5 } },
        { text: 'Surface', options: { bold: true, fill: { color: PAPER }, color: MUTED, fontSize: 10.5 } },
        { text: 'Loyer HT HC', options: { bold: true, fill: { color: PAPER }, color: MUTED, fontSize: 10.5 } },
        { text: 'Prix net vendeur', options: { bold: true, fill: { color: PAPER }, color: MUTED, fontSize: 10.5 } },
      ],
      [
        { text: bien?.adresse || '—', options: { color: INK, fontSize: 11 } },
        { text: bien?.surface ? `${bien.surface} m²` : '—', options: { color: INK, fontSize: 11 } },
        { text: bien?.loyerAnnuel ? formatEUR(bien.loyerAnnuel) : '—', options: { color: INK, fontSize: 11 } },
        { text: bien?.prix ? formatEUR(bien.prix) : '—', options: { color: INK, fontSize: 11 } },
      ],
    ],
    { x: 0.7, y: 1.85, w: 11.9, colW: [4.5, 2.2, 2.5, 2.7], border: { type: 'solid', color: LINE, pt: 0.5 }, autoPage: false }
  );
  const bullets = [
    bien?.prixRecommande ? `Prix net vendeur recommandé : ${formatEUR(bien.prixRecommande)}` : null,
    bien?.modaliteVente || 'Vente d\u2019actif de gré à gré',
    bien?.honorairesPct ? `Honoraires : ${bien.honorairesPct}% HT du prix hors droits` : null,
  ].filter(Boolean);
  s4.addText(bullets.map((b) => ({ text: b, options: { bullet: { code: '2022' }, breakLine: true } })), {
    x: 0.7, y: 3.1, w: 11.9, h: 2, fontSize: 13, color: '2A2F36', fontFace: 'Arial', lineSpacingMultiple: 1.5,
  });

  // --- Contact ---
  const s5 = pptx.addSlide();
  s5.background = { color: INK };
  s5.addText('Votre contact', { x: 0.7, y: 2.6, w: 6, h: 0.6, fontSize: 14, color: 'D8CBB2', charSpacing: 2 });
  s5.addText(societe?.contactNom || societe?.nom || '', { x: 0.7, y: 3.1, w: 8, h: 0.7, fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Georgia' });
  s5.addText([societe?.telephone, societe?.email].filter(Boolean).join('   —   '), {
    x: 0.7, y: 3.9, w: 10, h: 0.5, fontSize: 13, color: 'D8CBB2',
  });
  s5.addText(`© ${new Date().getFullYear()} ${societe?.nom || ''} — Confidentiel`, {
    x: 0.7, y: 7.05, w: 8, h: 0.35, fontSize: 9, color: '8A93A0',
  });

  return pptx;
}

function sectionHeader(slide, numero, title, brand) {
  slide.addText(numero, { x: 0.65, y: 0.42, w: 1.2, h: 0.7, fontSize: 26, bold: true, color: INK, fontFace: 'Georgia' });
  slide.addShape('line', { x: 1.55, y: 0.75, w: 1.2, h: 0, line: { color: INK, width: 2 } });
  slide.addText(title, { x: 2.9, y: 0.42, w: 8.5, h: 0.7, fontSize: 22, bold: true, color: INK, fontFace: 'Georgia' });
  slide.addText(brand, { x: 9.5, y: 0.5, w: 3.1, h: 0.4, align: 'right', fontSize: 10, color: MUTED, charSpacing: 2 });
  slide.addShape('line', { x: 0.7, y: 1.5, w: 11.9, h: 0, line: { color: LINE, width: 1 } });
}

export async function downloadImPptx(bien, societe) {
  const pptx = await generateImPptx(bien, societe);
  await pptx.writeFile({ fileName: `IM_${(bien?.reference || bien?.adresse || 'bien').replace(/\s+/g, '_')}.pptx` });
}
