import { createRequire } from 'module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const BASE = 'http://localhost:4599';
const admin = async (org, body = {}) => (await fetch(`${BASE}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org, ...body }) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error('ÉCHEC :', m); process.exit(1); } };
async function until(fn, label, ms = 12000) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) { console.error('DÉLAI DÉPASSÉ :', label); process.exit(1); } await sleep(150); } }

const SOCIETE = { onboarded: true, nom: 'Global Immo Invest', contactNom: 'Alexan OUDART', telephone: '06', email: 'a@b.fr', tauxTvaDefaut: 20, bareme: { type: 'degressif', tranches: [{ jusqu_a: null, taux: 3 }] } };
const LEGACY = () => ({
  app: 'mandat', version: 1, exportedAt: '2026-11-01T10:00:00.000Z', societe: SOCIETE,
  contacts: [
    { id: 'contact_a', createdAt: '2026-09-10T08:00:00.000Z', societe: 'NCAP REGION', nom: 'Dupont', prenom: 'Jean', email: 'j@ncap.fr', categorie: 'Investisseur', notes: 'Cherche retail park Occitanie, ticket 3-8 M€. Rappeler après le MAPIC.', classesActifs: ['Commerces'], zones: ['31'], interactions: [{ id: 'i1', date: '2026-10-02', type: 'Appel', note: 'Intéressé par Lescar' }] },
    { id: 'contact_b', createdAt: '2026-09-11T08:00:00.000Z', nom: 'Martin', notes: 'Cahier des charges : logistique XXL axe A7.' },
  ],
  mandats: [{ id: 'mandat_1', createdAt: '2026-09-12T08:00:00.000Z', adresse: 'Lescar', typeBien: 'Retail park', prixVente: 3850000, description: 'Description longue du bien.', statut: 'En cours' }],
  factures: [{ id: 'fact_1', createdAt: '2026-10-01T08:00:00.000Z', numero: 'FAC-2026-0001', client: 'NCAP', montantHT: 100, montantTVA: 20, montantTTC: 120, statut: 'Émise', lignes: [] }],
  notesFrais: [], dossiers: [], users: [], kmCumules: 320, promesses: [], prospects: [], courriers: [], documents: [],
  trash: [{ id: 'trash_1', type: 'contact', data: { id: 'contact_z', nom: 'Ancien' }, deletedAt: '2026-10-05T08:00:00.000Z' }],
  contactCategories: ['Propriétaire', 'Investisseur'],
});
const cacheFrom = (snap) => { const o = {}; for (const k of ['societe', 'contacts', 'mandats', 'factures', 'notesFrais', 'dossiers', 'users', 'kmCumules', 'promesses', 'prospects', 'courriers', 'documents', 'trash', 'contactCategories']) o[`mandat:${k}`] = JSON.stringify(snap[k]); return o; };

const browser = await chromium.launch();
async function device(org, { cache, slowMs } = {}) {
  const ctx = await browser.newContext();
  if (cache) await ctx.addInitScript((c) => { if (!localStorage.getItem('__seed')) { Object.entries(c).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('__seed', '1'); } }, cache);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (slowMs) await page.route('**/api/row*', async (route) => { await sleep(slowMs); route.continue(); });
  await page.goto(`${BASE}/?org=${org}`);
  const d = { page, ctx, errors, org };
  d.ready = () => until(() => page.evaluate(() => Boolean(window.__app && window.__app.cloudReady)), `${org} prêt`);
  d.app = (fn, arg) => page.evaluate(fn, arg);
  d.state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__state.current)));
  d.sync = () => page.evaluate(() => window.__app.syncNow());
  return d;
}
const srvData = async (org) => (await admin(org)).data;

// ============ S1 — MIGRATION : utilisateur existant, données existantes ============
{
  const org = 's1'; await admin(org, { data: LEGACY(), updated_at: '2026-11-20T10:00:00.123456+00:00', reset: true });
  const d = await device(org, { cache: cacheFrom(LEGACY()) }); await d.ready(); await sleep(2500);
  const a = await admin(org);
  assert(a.writes === 0, `S1 : aucune écriture à l'ouverture (écritures : ${a.writes})`);
  assert(JSON.stringify(a.data) === JSON.stringify(LEGACY()), 'S1 : données serveur strictement inchangées');
  const st = await d.state();
  assert(st.contacts.length === 2 && st.contacts.find((c) => c.id === 'contact_a').notes.includes('MAPIC') && st.contacts.find((c) => c.id === 'contact_a').interactions.length === 1 && st.mandats[0].description === 'Description longue du bien.' && st.trash.length === 1 && st.kmCumules === 320, 'S1 : tout est affiché à l\'identique (notes, échanges, descriptions, corbeille)');
  await d.app(() => window.__app.updateContact('contact_b', { notes: 'Cahier des charges mis à jour.' }));
  await until(async () => (await srvData(org)).contacts?.find((c) => c.id === 'contact_b')?.notes === 'Cahier des charges mis à jour.', 'S1 note envoyée');
  const f = await srvData(org);
  assert(f.contacts.find((c) => c.id === 'contact_a').notes.includes('MAPIC') && f.mandats.length === 1 && f.factures.length === 1 && f.trash.length === 1 && f.societe.nom === 'Global Immo Invest' && f.kmCumules === 320, 'S1 : après une modification, tout le reste est intact sur le serveur');
  assert(d.errors.length === 0, 'S1 : erreurs console : ' + d.errors.join(' | '));
  console.log('S1 ✓ migration : 0 écriture à l\'ouverture, notes/échanges/descriptions intacts, modification ciblée');
  await d.ctx.close();
}
// ============ S2 — appareil neuf (aucun cache) face à un serveur rempli, serveur LENT ============
{
  const org = 's2'; await admin(org, { data: LEGACY(), reset: true });
  const d = await device(org, { slowMs: 3500 });
  await sleep(2500);
  const ecran = await d.page.evaluate(() => document.body.innerText);
  assert(/Chargement de vos données/.test(ecran), 'S2 : écran d\'attente (pas l\'accueil « premier lancement ») pendant que le serveur répond');
  await d.ready(); await sleep(2500);
  const a = await admin(org);
  assert(a.writes === 0 && a.data.contacts.length === 2, `S2 : serveur intact (écritures : ${a.writes})`);
  assert((await d.state()).contacts.length === 2, 'S2 : l\'appareil neuf reçoit les données');
  console.log('S2 ✓ appareil neuf + serveur lent (le scénario de l\'incident) : serveur intact, données reçues');
  await d.ctx.close();
}
// ============ S3 — deux appareils, saisies simultanées ============
{
  const org = 's3'; await admin(org, { data: LEGACY(), reset: true });
  const A = await device(org), B = await device(org); await A.ready(); await B.ready();
  await Promise.all([
    A.app(() => { window.__app.addContact({ nom: 'Ajout A', notes: 'note A' }); }),
    B.app(() => { window.__app.addMandat({ adresse: 'Ajout B' }); window.__app.updateContact('contact_a', { notes: 'Note modifiée par B' }); }),
  ]);
  await until(async () => { const s = await srvData(org); return s.contacts?.length === 3 && s.mandats?.length === 2; }, 'S3 serveur complet');
  await A.sync(); await B.sync(); await A.sync();
  const sa = await A.state(), sb = await B.state(), s = await srvData(org);
  assert(sa.contacts.length === 3 && sa.mandats.length === 2 && sb.contacts.length === 3 && sb.mandats.length === 2, 'S3 : chaque appareil a tout');
  assert(sa.contacts.find((c) => c.id === 'contact_a').notes === 'Note modifiée par B' && s.contacts.find((c) => c.nom === 'Ajout A').notes === 'note A', 'S3 : les modifications des deux sont conservées');
  console.log('S3 ✓ deux appareils en même temps : aucune saisie écrasée');
  // S6 — suppression / restauration / suppression définitive entre appareils
  await A.app(() => window.__app.removeContact('contact_b'));
  await until(async () => (await srvData(org)).trash?.some((e) => e.data.id === 'contact_b'), 'S6 corbeille serveur');
  await B.sync();
  let b = await B.state();
  assert(!b.contacts.some((c) => c.id === 'contact_b') && b.trash.some((e) => e.data.id === 'contact_b'), 'S6 : la suppression arrive sur B (corbeille)');
  await B.app(() => { const e = window.__app.trash.find((t) => t.data.id === 'contact_b'); window.__app.restoreFromTrash(e.id); });
  await until(async () => (await srvData(org)).contacts?.some((c) => c.id === 'contact_b'), 'S6 restauration serveur');
  await A.sync();
  let a = await A.state();
  assert(a.contacts.some((c) => c.id === 'contact_b') && !a.trash.some((e) => e.data.id === 'contact_b') && a.contacts.find((c) => c.id === 'contact_b').notes.includes('logistique'), 'S6 : la restauration arrive sur A, notes comprises');
  await A.app(() => { window.__app.removeContact('contact_b'); });
  await sleep(300);
  await A.app(() => { const e = window.__app.trash.find((t) => t.data.id === 'contact_b'); window.__app.permanentlyDelete(e.id); });
  await until(async () => { const s2 = await srvData(org); return !s2.contacts.some((c) => c.id === 'contact_b') && !s2.trash.some((e) => e.data.id === 'contact_b') && s2.deleted?.contact_b; }, 'S6 suppression définitive serveur');
  await B.sync(); b = await B.state();
  assert(!b.contacts.some((c) => c.id === 'contact_b') && !b.trash.some((e) => e.data.id === 'contact_b'), 'S6 : la suppression définitive ne ressuscite pas sur B');
  console.log('S6 ✓ corbeille, restauration et suppression définitive se propagent correctement');
  // S9 — un ancien onglet (ancienne version) écrase le serveur avec un état périmé
  const perime = LEGACY();
  await admin(org, { data: perime });
  await A.sync(); await sleep(400);
  const r = await srvData(org);
  assert(r.contacts.some((c) => c.nom === 'Ajout A') && r.mandats.length === 2 && !r.contacts.some((c) => c.id === 'contact_b'), 'S9 : les saisies récentes sont rétablies après l\'écrasement par un ancien onglet');
  console.log('S9 ✓ écrasement par une ancienne version encore ouverte : rétabli automatiquement');
  assert(A.errors.length + B.errors.length === 0, 'S3-S9 : erreurs console : ' + [...A.errors, ...B.errors].join(' | '));
  await A.ctx.close(); await B.ctx.close();
}
// ============ S4 — modification puis rechargement immédiat ============
{
  const org = 's4'; await admin(org, { data: LEGACY(), reset: true });
  const d = await device(org); await d.ready();
  await d.app(() => window.__app.updateContact('contact_a', { notes: 'Saisie juste avant de fermer' }));
  await sleep(150); // bien avant l'envoi (1,5 s)
  await d.page.reload(); await d.ready();
  assert((await d.state()).contacts.find((c) => c.id === 'contact_a').notes === 'Saisie juste avant de fermer', 'S4 : la saisie survit au rechargement');
  await until(async () => (await srvData(org)).contacts.find((c) => c.id === 'contact_a').notes === 'Saisie juste avant de fermer', 'S4 envoi après rechargement');
  console.log('S4 ✓ saisie puis fermeture immédiate : conservée et envoyée à la réouverture (avant : perdue)');
  // S5 — hors connexion
  await admin(org, { fail: true });
  await d.app(() => window.__app.addContact({ nom: 'Saisi hors connexion' }));
  await sleep(2500);
  await admin(org, { fail: false });
  await d.sync();
  await until(async () => (await srvData(org)).contacts.some((c) => c.nom === 'Saisi hors connexion'), 'S5 envoi à la reconnexion');
  console.log('S5 ✓ saisie hors connexion : envoyée à la reconnexion');
  await d.ctx.close();
}
// ============ S7 — autre compte sur le même navigateur : pas de mélange ============
{
  const org1 = 's7a', org2 = 's7b'; await admin(org1, { data: LEGACY(), reset: true }); await admin(org2, { data: {}, updated_at: null, reset: true });
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(`${BASE}/?org=${org1}`); await until(() => page.evaluate(() => Boolean(window.__app?.cloudReady)), 'S7 org1');
  await page.goto(`${BASE}/?org=${org2}`); await until(() => page.evaluate(() => Boolean(window.__app?.cloudReady)), 'S7 org2'); await sleep(2500);
  const s2 = (await admin(org2)).data;
  assert(!(s2.contacts?.length) && !(s2.mandats?.length), 'S7 : les données du premier compte ne partent pas dans le second');
  assert((await admin(org1)).data.contacts.length === 2, 'S7 : le premier compte est intact');
  await page.goto(`${BASE}/?org=${org1}`); await until(() => page.evaluate(() => Boolean(window.__app?.cloudReady)), 'S7 retour org1');
  assert((await page.evaluate(() => window.__state.current.contacts.length)) === 2, 'S7 : retour sur le premier compte, tout est là');
  console.log('S7 ✓ deux comptes sur le même navigateur : aucun mélange de données');
  await ctx.close();
}
// ============ S10 — restauration d'une version : rien ne disparaît ============
{
  const org = 's10'; await admin(org, { data: LEGACY(), reset: true });
  const d = await device(org); await d.ready();
  const ancien = await d.state();
  await d.app(() => { window.__app.removeContact('contact_a'); window.__app.addContact({ nom: 'Créé après' }); });
  await sleep(300);
  await d.app((snap) => window.__app.restoreSnapshot(snap), ancien);
  await sleep(300);
  const st = await d.state();
  assert(st.contacts.some((c) => c.id === 'contact_a') && st.contacts.some((c) => c.nom === 'Créé après') && !st.trash.some((e) => e.data.id === 'contact_a'), 'S10 : le contact supprimé revient, celui créé depuis reste');
  await until(async () => { const s = await srvData(org); return s.contacts.some((c) => c.id === 'contact_a') && s.contacts.some((c) => c.nom === 'Créé après'); }, 'S10 serveur');
  console.log('S10 ✓ restauration d\'une version : le supprimé revient, le récent est conservé');
  await d.ctx.close();
}
await browser.close();
console.log('\nTOUS LES SCÉNARIOS NAVIGATEUR PASSENT');
process.exit(0);
