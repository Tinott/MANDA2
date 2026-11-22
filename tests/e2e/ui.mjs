import { createRequire } from 'module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const BASE = 'http://localhost:4599';
const admin = async (org, body = {}) => (await fetch(`${BASE}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org, ...body }) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } };
const OUT = process.argv[2];
const longue = 'Cherche retail park Occitanie, ticket 3-8 M€.\nRappeler après le MAPIC.\nA déjà visité Lescar en 2025, trouvait le taux trop bas.\nDécideur : son associé M. Roux (comité le 1er mardi du mois).\nNe veut pas de galerie marchande.\nPréférence pour baux fermes 6 ans minimum.\nBanque : CA Pyrénées Gascogne.\nSensible au DPE.\nA un 1031 à remployer avant juin.';
const data = {
  societe: { onboarded: true, nom: 'Global Immo Invest', contactNom: 'Alexan OUDART', tauxTvaDefaut: 20, bareme: { type: 'degressif', tranches: [{ jusqu_a: null, taux: 3 }] } },
  contacts: [
    { id: 'contact_a', createdAt: '2026-09-10T08:00:00.000Z', societe: 'NCAP REGION', nom: 'Dupont', prenom: 'Jean', fonction: 'Directeur des acquisitions', email: 'j.dupont@ncap-region.fr', telephone: '06 12 34 56 78', categorie: 'Investisseur', notes: longue, classesActifs: ['Commerces'], zones: ['31', '64'], ticketMin: 3000000, ticketMax: 8000000, interactions: [{ id: 'i1', date: '2026-10-02', type: 'Appel', note: 'Intéressé par Lescar, attend l\'état locatif.' }, { id: 'i2', date: '2026-11-12', type: 'RDV', note: 'Déjeuner : confirme le ticket, veut voir Angers.' }] },
    { id: 'contact_b', createdAt: '2026-09-11T08:00:00.000Z', nom: 'Martin', prenom: 'Claire', email: 'c.martin@logis.fr', categorie: 'Propriétaire', notes: 'Cahier des charges : logistique XXL axe A7.' },
    { id: 'contact_c', createdAt: '2026-09-12T08:00:00.000Z', societe: 'Étude Leroy', nom: 'Leroy', telephone: '05 61 00 00 00', categorie: 'Notaire' },
  ],
  mandats: [{ id: 'mandat_1', createdAt: '2026-09-12T08:00:00.000Z', adresse: 'Lescar', typeBien: 'Retail park', prixVente: 3850000, statut: 'En cours' }],
  factures: [{ id: 'fact_1', createdAt: '2026-10-01T08:00:00.000Z', numero: 'FAC-2026-0001', client: 'NCAP', montantHT: 100, montantTVA: 20, montantTTC: 120, statut: 'Envoyée', dateEmission: '2026-11-10', lignes: [] }],
};
await admin('ui', { data, reset: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(`${BASE}/?org=ui#/contacts`);
await page.waitForFunction(() => window.__app?.cloudReady);
await page.waitForSelector('text=NCAP REGION');
// Notes visibles sans cliquer
const txt = await page.evaluate(() => document.body.innerText);
assert(txt.includes('Rappeler après le MAPIC') && txt.includes('logistique XXL') && txt.includes('veut voir Angers'), 'notes et échanges visibles sur les cartes sans ouvrir la fiche');
await sleep(900); await page.screenshot({ path: `${OUT}/contacts-cartes.png` });
await page.click('button:has-text("Liste")');
await sleep(200);
assert((await page.evaluate(() => document.body.innerText)).includes('1031 à remployer'), 'vue liste : note complète');
await sleep(700); await page.screenshot({ path: `${OUT}/contacts-liste.png` });
// Note rapide depuis la liste
await page.click('button[title="Noter un échange"] >> nth=1');
await page.fill('textarea', 'Appel : envoie son bail lundi.');
await page.click('button:has-text("Enregistrer")');
await sleep(300);
assert((await page.evaluate(() => window.__state.current.contacts.find((c) => c.id === 'contact_b').interactions?.[0]?.note)) === 'Appel : envoie son bail lundi.', 'note rapide enregistrée');
assert((await page.evaluate(() => window.__state.current.contacts.find((c) => c.id === 'contact_b').notes)).includes('logistique'), 'la note existante est conservée');
// Copilote global : enchaînement d'actions sur la même fiche
await page.evaluate(() => { window.__aiScript = [
  { stop_reason: 'tool_use', content: [
    { type: 'tool_use', id: 't1', name: 'creer_contact', input: { societe: 'ACME INVEST', nom: 'Durand' } },
    { type: 'tool_use', id: 't2', name: 'ajouter_interaction', input: { contact: 'ACME INVEST', type: 'Appel', note: 'Premier échange' } },
    { type: 'tool_use', id: 't3', name: 'ajouter_interaction', input: { contact: 'ACME INVEST', type: 'Note', note: 'Second échange', prochaineRelance: '2026-11-30' } },
    { type: 'tool_use', id: 't4', name: 'creer_rappel', input: { titre: 'Rappeler Durand', date: '2026-11-23', heure: '10:00', contact: 'ACME INVEST' } },
    { type: 'tool_use', id: 't5', name: 'modifier_facture', input: { id: 'FAC-2026-0001', modifications: { statut: 'Payée' } } },
    { type: 'tool_use', id: 't6', name: 'memoriser_consigne', input: { consigne: 'Toujours vouvoyer' } },
    { type: 'tool_use', id: 't7', name: 'supprimer_element', input: { type: 'facture', id: 'fact_1' } },
    { type: 'tool_use', id: 't8', name: 'creer_promesse', input: { bienAdresse: 'Lescar', dateReiteration: '2027-01-15' } },
  ] },
  { stop_reason: 'end_turn', content: [{ type: 'text', text: 'C\'est fait.' }] },
]; });
await page.keyboard.press('Control+k');
await page.fill('textarea[placeholder^="Dites"]', 'Note mon appel avec Durand');
await page.keyboard.press('Enter');
await page.waitForSelector('text=C\'est fait.', { timeout: 15000 });
const st = await page.evaluate(() => JSON.parse(JSON.stringify(window.__state.current)));
const acme = st.contacts.find((c) => c.societe === 'ACME INVEST');
assert(acme && acme.interactions.length === 2 && acme.prochaineRelance === '2026-11-30', `deux actions enchaînées sur la même fiche : les deux sont conservées (${acme?.interactions?.length})`);
assert(st.taches.length === 1 && st.taches[0].contactId === acme.id && st.taches[0].heure === '10:00', 'rappel créé et rattaché au contact');
assert(st.factures[0].statut === 'Payée' && st.factures[0].datePaiement, 'facture passée en payée (et non supprimée)');
assert(st.factures.length === 1, 'facture émise non supprimable');
assert(st.societe.copiloteInstructions === '- Toujours vouvoyer', 'consigne mémorisée');
assert(st.promesses[0].dateReiterationPrevue === '2027-01-15', 'promesse : date de réitération au bon champ');
const calls = await page.evaluate(() => window.__aiCalls.filter((c) => c.tools));
assert(JSON.stringify(calls[1]).includes('numérotation légale'), 'le refus de suppression est renvoyé au modèle');
assert(JSON.stringify(calls[0]).length < 380000, 'requête sous la limite');
await page.screenshot({ path: `${OUT}/copilote.png` });
// second message : la consigne est dans le prompt
await page.evaluate(() => { window.__aiScript = [{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Bien noté.' }] }]; });
await page.fill('input[placeholder^="« Note"]', 'merci'); await page.keyboard.press('Enter');
await page.waitForSelector('text=Bien noté.');
const last = await page.evaluate(() => window.__aiCalls.filter((c) => c.tools).pop());
assert(last.system.includes('Toujours vouvoyer') && JSON.stringify(last.messages[0]).includes('Rappeler Durand'), 'consigne et rappels transmis au Copilote');
// Tableau de bord
await page.goto(`${BASE}/?org=ui#/`); await page.waitForSelector('text=Rappels & agenda');
await page.fill('input[aria-label="Nouveau rappel"]', 'Envoyer l\'IM Angers à NCAP');
await page.click('button:has-text("Ajouter")'); await sleep(300);
await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Vers mon calendrier')]);
const ics = require('fs').readFileSync(await dl.path(), 'utf8');
assert(ics.includes('BEGIN:VEVENT') && ics.includes('SUMMARY:Rappeler Durand') && ics.includes('DTSTART:20261123T100000'), 'export calendrier valide');
await page.click('button[title="Marquer comme fait"] >> nth=0'); await sleep(300);
assert((await page.evaluate(() => window.__state.current.taches.filter((t) => t.fait).length)) === 1, 'rappel coché');
// tout est bien parti au serveur
await page.evaluate(() => window.__app.syncNow()); await sleep(2500);
const srv = (await admin('ui')).data;
assert(srv.taches.length === 2 && srv.contacts.length === 4 && srv.societe.copiloteInstructions, 'tout est enregistré sur le serveur');
// mobile
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(`${BASE}/?org=ui#/contacts`); await page.waitForSelector('text=NCAP REGION'); await sleep(300);
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: `${OUT}/contacts-mobile.png` });
console.log('débordement horizontal mobile (px) :', debord);
assert(errors.length === 0, 'erreurs console : ' + errors.join(' | '));
console.log('INTERFACE ✓ notes visibles, note rapide, Copilote (8 actions enchaînées), rappels, calendrier, serveur');
await browser.close(); process.exit(0);
