// Sauvegarde & transfert de compte — l'application stocke tout en local
// (localStorage du navigateur) : rien ne quitte l'appareil, mais rien ne
// survit non plus à un cache vidé ou à un changement d'ordinateur. Ce module
// permet d'exporter un instantané complet (téléchargeable, à transmettre
// d'un appareil à l'autre) et de le restaurer.

const SNAPSHOT_VERSION = 1;

export function buildSnapshot({ societe, mandats, factures, notesFrais, dossiers, users, kmCumules, promesses, contacts }) {
  return {
    app: 'mandat',
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    societe,
    mandats,
    factures,
    notesFrais,
    dossiers,
    users,
    kmCumules,
    promesses,
    contacts,
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

export function readSnapshotFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'mandat' || !data.societe) {
          reject(new Error("Ce fichier ne correspond pas à une sauvegarde Mandat valide."));
          return;
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
