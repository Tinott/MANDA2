import { createSyncEngine } from '../src/lib/syncEngine.js';
import { mergeSnapshots, sameSnapshot, canonical, normalizeSnapshot, countItems } from '../src/lib/syncMerge.js';

// ---------- horloge logique partagée (dates ISO strictement croissantes)
let T = Date.parse('2026-11-01T00:00:00Z');
const now = () => new Date(T += 1000).toISOString();
let seq = 0; const uid = (p) => `${p}_${++seq}`;
const rnd = (n) => Math.floor(Math.random() * n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeServer(initial) {
  const srv = { data: initial, version: 'v0', writes: 0, fail: 0, pulls: 0 };
  srv.peek = async () => { await sleep(rnd(2)); if (srv.fail > 0 && Math.random() < srv.fail) return { ok: false }; return { ok: true, version: srv.version }; };
  srv.pull = async () => { srv.pulls++; await sleep(rnd(4)); if (srv.fail > 0 && Math.random() < srv.fail) return { ok: false, error: 'net' }; return { ok: true, data: JSON.parse(JSON.stringify(srv.data)), version: srv.version }; };
  srv.push = async (data, version, forcer) => { await sleep(rnd(4)); if (srv.fail > 0 && Math.random() < srv.fail) return { ok: false, error: 'net' }; if (!forcer && (srv.alwaysConflict || version !== srv.version)) return { ok: false, conflict: true }; srv.data = JSON.parse(JSON.stringify(data)); srv.version = 'v' + (++srv.writes); return { ok: true, version: srv.version }; };
  return srv;
}

function makeClient(name, srv, initialLocal, { firstRun = false } = {}) {
  const c = { name, state: normalizeSnapshot(initialLocal), dirty: false, firstRun, status: '', backups: [] };
  c.engine = createSyncEngine({
    pull: srv.pull, push: srv.push, peek: srv.peek,
    getLocal: () => c.state,
    applyMerged: (m) => { c.state = normalizeSnapshot(JSON.parse(JSON.stringify(m))); },
    onStatus: (s) => { c.status = s; },
    isDirty: () => c.dirty, setDirty: (d) => { c.dirty = d; },
    isFirstRun: () => c.firstRun, markRun: () => { c.firstRun = false; },
    backup: async (snap, why) => { c.backups.push({ why, n: countItems(snap) }); },
    debounceMs: 2,
  });
  const touch = () => c.engine.notifyLocalChange();
  c.add = (list, fields) => { const t = now(); const rec = { id: uid(list), createdAt: t, updatedAt: t, ...fields }; c.state[list] = [rec, ...c.state[list]]; touch(); return rec.id; };
  c.update = (list, id, patch) => { if (!c.state[list].some((x) => x.id === id)) return false; c.state[list] = c.state[list].map((x) => x.id === id ? { ...x, ...patch, updatedAt: now() } : x); touch(); return true; };
  c.softDelete = (list, type, id) => { const it = c.state[list].find((x) => x.id === id); if (!it) return false; c.state.trash = [{ id: uid('trash'), type, data: it, deletedAt: now() }, ...c.state.trash]; c.state[list] = c.state[list].filter((x) => x.id !== id); touch(); return true; };
  c.restore = (trashId, list) => { const e = c.state.trash.find((t) => t.id === trashId); if (!e) return false; const rec = { ...e.data, updatedAt: now() }; c.state[list] = [rec, ...c.state[list].filter((x) => x.id !== rec.id)]; c.state.trash = c.state.trash.filter((t) => t.id !== trashId); touch(); return true; };
  c.purge = (trashId) => { const e = c.state.trash.find((t) => t.id === trashId); if (!e) return false; const t = now(); c.state.deleted = { ...c.state.deleted, [e.id]: t, ...(e.data?.id ? { [e.data.id]: t } : {}) }; c.state.trash = c.state.trash.filter((x) => x.id !== trashId); touch(); return true; };
  c.setSociete = (patch) => { c.state.societe = { ...(c.state.societe || {}), ...patch }; c.state.meta = { ...c.state.meta, societeAt: now() }; touch(); };
  return c;
}

async function settle(clients) {
  for (let pass = 0; pass < 4; pass++) for (const c of clients) await c.engine.sync({ leger: true });
}
function assert(cond, msg) { if (!cond) { console.error('ÉCHEC :', msg); process.exit(1); } }

// =====================================================================
// TEST 1 — simulation aléatoire : 3 appareils, opérations concurrentes
// =====================================================================
let totalOps = 0;
for (let run = 0; run < 60; run++) {
  const srv = makeServer({});
  const clients = ['A', 'B', 'C'].map((n) => makeClient(n, srv, {}));
  await settle(clients);
  // Vérité terrain : dernier état voulu de chaque enregistrement
  const truth = new Map(); // id -> { list, alive:'list'|'trash'|'purged', value }
  for (let step = 0; step < 60; step++) {
    const c = clients[rnd(3)];
    const op = rnd(100);
    const ids = c.state.contacts.map((x) => x.id);
    // Règle : la dernière action (dans le temps) l'emporte.
    if (op < 35 || !ids.length) { const v = `v${step}`; const id = c.add('contacts', { nom: v }); truth.set(id, { alive: 'list', value: v }); }
    else if (op < 65) { const id = ids[rnd(ids.length)]; const v = `u${step}`; if (c.update('contacts', id, { nom: v })) truth.set(id, { alive: 'list', value: v }); }
    else if (op < 80) { const id = ids[rnd(ids.length)]; if (c.softDelete('contacts', 'contact', id)) truth.set(id, { alive: 'trash' }); }
    else if (op < 90 && c.state.trash.length) { const e = c.state.trash[rnd(c.state.trash.length)]; if (c.restore(e.id, 'contacts')) truth.set(e.data.id, { alive: 'list', value: e.data.nom }); }
    else if (c.state.trash.length) { const e = c.state.trash[rnd(c.state.trash.length)]; if (c.purge(e.id)) truth.set(e.data.id, { alive: 'purged' }); }
    else { c.setSociete({ nom: `S${step}` }); }
    totalOps++;
    if (rnd(3) === 0) await sleep(rnd(6));
    if (rnd(4) === 0) clients[rnd(3)].engine.sync({ leger: rnd(2) === 0 }); // synchros concurrentes, non attendues
  }
  await sleep(30);
  await settle(clients);
  // (a) convergence : tous les appareils et le serveur ont le même état
  for (const c of clients) assert(sameSnapshot(c.state, srv.data), `run ${run} : ${c.name} ≠ serveur`);
  // (b) aucun enregistrement vivant perdu, aucune suppression définitive ressuscitée
  const final = normalizeSnapshot(srv.data);
  const inList = new Map(final.contacts.map((x) => [x.id, x]));
  const inTrash = new Set(final.trash.map((e) => e.data.id));
  for (const [id, t] of truth) {
    if (t.alive === 'purged') assert(!inList.has(id) && !inTrash.has(id), `run ${run} : ${id} purgé mais présent`);
    else if (t.alive === 'list') { assert(inList.has(id), `run ${run} : ${id} devrait être dans la liste`); assert(inList.get(id).nom === t.value, `run ${run} : ${id} a perdu sa dernière modification (${inList.get(id).nom} ≠ ${t.value})`); assert(!inTrash.has(id), `run ${run} : ${id} à la fois en liste et en corbeille`); }
    else { assert(inTrash.has(id), `run ${run} : ${id} devrait être en corbeille`); assert(!inList.has(id), `run ${run} : ${id} supprimé mais encore en liste`); }
  }
  // (c) pas de doublon d'identifiant
  assert(new Set(final.contacts.map((x) => x.id)).size === final.contacts.length, `run ${run} : doublons`);
  assert(clients.every((c) => !c.dirty), `run ${run} : un appareil reste « à envoyer »`);
}
console.log(`TEST 1 ✓ — 60 simulations, ${totalOps} opérations concurrentes sur 3 appareils : convergence, 0 perte, 0 résurrection`);

// =====================================================================
// TEST 2 — le scénario de l'incident : appareil vide face à un serveur plein
// =====================================================================
{
  const plein = { contacts: Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, createdAt: now(), nom: `N${i}` })), societe: { nom: 'CARDO' } };
  const srv = makeServer(plein);
  const neuf = makeClient('neuf', srv, {}, { firstRun: true });
  await neuf.engine.sync();
  assert(countItems(srv.data) === 40 && neuf.state.contacts.length === 40, 'appareil vide : le serveur doit rester intact et remplir l\'appareil');
  // serveur injoignable : rien n'est envoyé, rien n'est perdu
  const srv2 = makeServer(plein); srv2.fail = 1;
  const hs = makeClient('hs', srv2, {}, { firstRun: true });
  await hs.engine.sync(); hs.add('contacts', { nom: 'saisi hors ligne' }); await sleep(20);
  assert(countItems(srv2.data) === 40 && srv2.writes === 0, 'serveur injoignable : aucune écriture');
  srv2.fail = 0; await hs.engine.sync();
  assert(countItems(srv2.data) === 41 && hs.state.contacts.length === 41, 'reconnexion : la saisie hors ligne rejoint les 40 du serveur');
  console.log('TEST 2 ✓ — appareil vide / serveur injoignable : serveur intact, saisie hors ligne conservée (40 → 41)');
}

// =====================================================================
// TEST 3 — récupération : serveur vide, appareil rempli
// =====================================================================
{
  const srv = makeServer({ societe: { nom: 'CARDO' }, contacts: [], mandats: [] });
  const local = { contacts: Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, createdAt: now(), nom: `N${i}` })) };
  const c = makeClient('ancien', srv, local, { firstRun: true });
  await c.engine.sync();
  assert(countItems(srv.data) === 25, 'le serveur doit être re-rempli par l\'appareil');
  console.log('TEST 3 ✓ — serveur vide + appareil rempli : le serveur est restauré (0 → 25)');
}

// =====================================================================
// TEST 4 — premier lancement (migration) : données existantes sans dates
// =====================================================================
{
  const legacy = { societe: { nom: 'GII', bareme: { x: 1 } }, contacts: [{ id: 'a', createdAt: '2026-09-01T10:00:00.000Z', nom: 'Dupont', notes: 'Note longue' }, { id: 'b', nom: 'Sans date' }], trash: [{ id: 't1', type: 'contact', data: { id: 'z', nom: 'Supprimé' }, deletedAt: '2026-10-01T10:00:00.000Z' }], mandats: [{ id: 'm1', adresse: 'Lescar' }], kmCumules: 1200, contactCategories: ['Investisseur'] };
  const srv = makeServer(JSON.parse(JSON.stringify(legacy)));
  // cache local = copie exacte, clés dans un autre ordre (comme le renvoie le serveur)
  const cacheLocal = JSON.parse(JSON.stringify(legacy)); cacheLocal.contacts = cacheLocal.contacts.map((x) => Object.fromEntries(Object.entries(x).reverse()));
  const c = makeClient('migr', srv, cacheLocal, { firstRun: true });
  await c.engine.sync();
  assert(srv.writes === 0, `migration : aucune écriture attendue si rien n'a changé (écritures : ${srv.writes})`);
  assert(canonical(normalizeSnapshot(srv.data).contacts) === canonical(legacy.contacts), 'migration : contacts strictement inchangés');
  assert(c.state.contacts.length === 2 && c.state.trash.length === 1 && c.state.kmCumules === 1200 && c.state.societe.nom === 'GII', 'migration : état local complet');
  // puis une saisie : seul l'enregistrement modifié change
  c.update('contacts', 'a', { notes: 'Note modifiée' }); await sleep(20); await c.engine.sync();
  const f = normalizeSnapshot(srv.data);
  assert(f.contacts.find((x) => x.id === 'a').notes === 'Note modifiée' && f.contacts.find((x) => x.id === 'b').nom === 'Sans date' && f.mandats.length === 1 && f.trash.length === 1 && f.kmCumules === 1200, 'après saisie : tout le reste intact');
  console.log('TEST 4 ✓ — migration des données existantes : 0 écriture à l\'ouverture, contenu identique, puis modification ciblée');
}

// =====================================================================
// TEST 5 — deux utilisateurs en même temps (le cas qui écrasait avant)
// =====================================================================
{
  const base = { contacts: [{ id: 'c1', createdAt: now(), updatedAt: now(), nom: 'Base' }] };
  const srv = makeServer(base);
  const a = makeClient('A', srv, base), b = makeClient('B', srv, base);
  await settle([a, b]);
  a.add('contacts', { nom: 'Ajout de A' }); b.add('mandats', { adresse: 'Ajout de B' }); b.update('contacts', 'c1', { notes: 'Note de B' });
  await Promise.all([a.engine.sync(), b.engine.sync()]); await settle([a, b]);
  const f = normalizeSnapshot(srv.data);
  assert(f.contacts.length === 2 && f.mandats.length === 1 && f.contacts.find((x) => x.id === 'c1').notes === 'Note de B', 'saisies simultanées : tout doit être conservé');
  assert(sameSnapshot(a.state, b.state), 'les deux utilisateurs voient la même chose');
  console.log('TEST 5 ✓ — deux utilisateurs simultanés : ajout de A + ajout et note de B tous conservés');
}

// =====================================================================
// TEST 6 — propriétés de la fusion
// =====================================================================
{
  const x = { contacts: [{ id: '1', createdAt: '2026-01-01', updatedAt: '2026-01-05', n: 'x' }, { id: '2', createdAt: '2026-01-02' }], trash: [], societe: { a: 1 }, meta: { societeAt: '2026-01-03' } };
  const y = { contacts: [{ id: '1', createdAt: '2026-01-01', updatedAt: '2026-01-04', n: 'y' }, { id: '3', createdAt: '2026-01-03' }], trash: [{ id: 't', type: 'contact', data: { id: '2' }, deletedAt: '2026-01-06' }], societe: { a: 2 }, meta: { societeAt: '2026-01-02' } };
  const xy = mergeSnapshots(x, y), yx = mergeSnapshots(y, x);
  assert(sameSnapshot(xy, yx), 'commutativité');
  assert(sameSnapshot(mergeSnapshots(xy, x), xy) && sameSnapshot(mergeSnapshots(xy, xy), xy), 'idempotence');
  assert(xy.contacts.length === 2 && xy.contacts.find((c) => c.id === '1').n === 'x' && !xy.contacts.find((c) => c.id === '2') && xy.trash.length === 1 && xy.societe.a === 1, 'règles : plus récent gagne, corbeille respectée, société la plus récente');
  console.log('TEST 6 ✓ — fusion commutative, idempotente, règles respectées');
}
// =====================================================================
// TEST 7 — envoi conditionnel refusé pour raison technique : repli sûr
// =====================================================================
{
  const srv = makeServer({ contacts: [{ id: 'c1', createdAt: now(), nom: 'Base' }] }); srv.alwaysConflict = true;
  const c = makeClient('T', srv, {}, { firstRun: true });
  await c.engine.sync(); c.add('contacts', { nom: 'Nouveau' }); await sleep(20); await c.engine.sync();
  assert(normalizeSnapshot(srv.data).contacts.length === 2 && c.status === 'synced', 'repli : la saisie doit arriver sur le serveur');
  console.log('TEST 7 ✓ — refus technique de l\'envoi conditionnel : repli sans perte');
}
// =====================================================================
// TEST 8 — un seul utilisateur : pas de retéléchargement à chaque saisie
// =====================================================================
{
  const srv = makeServer({ contacts: [{ id: 'c1', createdAt: now(), nom: 'Base' }] });
  const c = makeClient('solo', srv, {}, { firstRun: true });
  await c.engine.sync(); const apresChargement = srv.pulls;
  for (let i = 0; i < 20; i++) { c.add('contacts', { nom: `n${i}` }); await sleep(12); }
  await sleep(30); await c.engine.sync({ leger: true });
  assert(normalizeSnapshot(srv.data).contacts.length === 21, '20 saisies arrivées');
  assert(srv.pulls === apresChargement, `aucune relecture complète attendue pendant la saisie (lectures : ${srv.pulls - apresChargement})`);
  // un autre appareil écrit : la vérification légère le détecte et récupère
  const autre = makeClient('autre', srv, {}, { firstRun: true }); await autre.engine.sync(); autre.add('mandats', { adresse: 'Lescar' }); await sleep(20); await autre.engine.sync();
  await c.engine.sync({ leger: true });
  assert(c.state.mandats.length === 1, 'la vérification légère récupère la saisie de l\'autre appareil');
  console.log(`TEST 8 ✓ — 20 saisies envoyées sans aucune relecture complète ; saisie d'un autre appareil récupérée à la vérification`);
}
console.log('\nTOUS LES TESTS DE SYNCHRONISATION PASSENT');
