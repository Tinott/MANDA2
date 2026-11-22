// Copies de sécurité locales — conservées dans le navigateur (IndexedDB),
// indépendamment du serveur. Une copie est prise automatiquement une fois
// par jour, et avant toute synchronisation qui réduirait le nombre
// d'enregistrements de l'appareil. Paramètres → « Historique des versions »
// permet de les restaurer. Tout échec (navigation privée, quota) est
// silencieux : ces copies sont un filet, jamais un prérequis.

const DB = 'mandat-backups';
const STORE = 'snapshots';
const MAX_PAR_ORG = 14;

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB indisponible')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('org', 'orgId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
const ask = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function saveLocalBackup(orgId, data, reason, count) {
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.add({ orgId: orgId || 'local', at: new Date().toISOString(), reason, count: count ?? null, data });
    const keys = await ask(store.index('org').getAllKeys(orgId || 'local'));
    keys.slice(0, Math.max(0, keys.length - MAX_PAR_ORG)).forEach((k) => store.delete(k));
    await done(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function listLocalBackups(orgId) {
  try {
    const db = await open();
    const all = await ask(db.transaction(STORE).objectStore(STORE).index('org').getAll(orgId || 'local'));
    db.close();
    return all.map(({ id, at, reason, count }) => ({ id, at, reason, count })).sort((a, b) => (a.at < b.at ? 1 : -1));
  } catch {
    return [];
  }
}

export async function getLocalBackup(id) {
  try {
    const db = await open();
    const rec = await ask(db.transaction(STORE).objectStore(STORE).get(id));
    db.close();
    return rec?.data || null;
  } catch {
    return null;
  }
}
