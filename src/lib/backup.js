const SNAPSHOT_VERSION = 1;

export function buildSnapshot({ societe, mandats, factures, notesFrais, dossiers, users, kmCumules, promesses, contacts, prospects, courriers, trash, contactCategories, documents, taches, deleted, meta }) {
  return {
    app: 'mandat',
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    societe, mandats, factures, notesFrais, dossiers, users, kmCumules,
    promesses, contacts, prospects, courriers, trash, contactCategories, documents,
    taches: taches || [], deleted: deleted || {}, meta: meta || {},
  };
}

export function downloadSnapshot(state) {
  const snapshot = buildSnapshot(state);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const societeSlug = (state.societe?.nom || 'compte').replace(/[^\w-]+/g, '_').slice(0, 40);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mandat-sauvegarde-${societeSlug}-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return snapshot.exportedAt;
}

// Un export brut du stockage du navigateur (clés « mandat:contacts »,
// « mandat:mandats »… copiées depuis les outils de développement) est aussi
// accepté : c'est la voie de récupération quand un appareil détient encore
// une copie locale des données.
export function fromLocalStorageDump(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const keys = Object.keys(obj).filter((k) => k.startsWith('mandat:'));
  if (!keys.length) return null;
  const out = {};
  keys.forEach((k) => {
    const name = k.slice('mandat:'.length);
    try { out[name] = typeof obj[k] === 'string' ? JSON.parse(obj[k]) : obj[k]; } catch { /* valeur non JSON : ignorée */ }
  });
  if (!out.societe && !out.contacts && !out.mandats) return null;
  return { app: 'mandat', version: SNAPSHOT_VERSION, exportedAt: new Date().toISOString(), societe: out.societe || {}, ...out };
}

export function readSnapshotFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let data = JSON.parse(reader.result);
        if (data.app !== 'mandat' || !data.societe) {
          const dump = fromLocalStorageDump(data);
          if (!dump) {
            reject(new Error("Ce fichier ne correspond pas à une sauvegarde Mandat valide."));
            return;
          }
          data = dump;
        }
        resolve(data);
      } catch {
        reject(new Error('Fichier illisible — vérifiez qu\u2019il s\u2019agit bien du fichier .json exporté depuis Mandat.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier.'));
    reader.readAsText(file);
  });
}
