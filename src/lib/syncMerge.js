// Fusion d'instantanés — enregistrement par enregistrement.
//
// Les données d'une organisation tiennent dans un seul document JSON partagé
// entre appareils et utilisateurs. Pour qu'aucune saisie ne puisse en écraser
// une autre, deux instantanés ne sont jamais « remplacés » l'un par l'autre :
// ils sont FUSIONNÉS.
//
//   · Listes (contacts, mandats, factures…) : réunies par identifiant ; quand
//     un même enregistrement existe des deux côtés, la version la plus
//     récente (updatedAt, à défaut createdAt) l'emporte.
//   · Corbeille : réunion des entrées ; un élément mis à la corbeille d'un
//     côté disparaît des listes de l'autre (sauf s'il a été modifié après).
//   · Suppressions définitives : mémorisées dans `deleted` (identifiant →
//     date), pour qu'un appareil resté ouvert ne ressuscite pas l'élément.
//   · Réglages uniques (société, kilomètres, catégories) : le plus récent
//     l'emporte, d'après les dates conservées dans `meta`.
//
// La fusion est déterministe : quel que soit l'ordre dans lequel les
// appareils se synchronisent, tous aboutissent au même état.

export const LISTES = ['mandats', 'factures', 'notesFrais', 'dossiers', 'promesses', 'contacts', 'prospects', 'courriers', 'documents', 'users', 'taches'];

// Type d'une entrée de corbeille → liste d'origine.
export const LISTE_PAR_TYPE = {
  mandat: 'mandats', facture: 'factures', frais: 'notesFrais', promesse: 'promesses', contact: 'contacts',
  prospect: 'prospects', courrier: 'courriers', dossier: 'dossiers', document: 'documents', tache: 'taches',
};

const TOMBSTONE_TTL_MS = 180 * 86400000;

// JSON canonique (clés triées) : deux objets identiques donnent la même
// chaîne, quel que soit l'ordre de leurs clés (le serveur les réordonne).
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}

export const stamp = (x) => (x && (x.updatedAt || x.createdAt)) || '';

export function countItems(data) {
  if (!data || typeof data !== 'object') return 0;
  return [...LISTES, 'trash'].reduce((n, k) => n + (Array.isArray(data[k]) ? data[k].length : 0), 0);
}

// Met un instantané (éventuellement ancien ou partiel) au format complet.
export function normalizeSnapshot(d) {
  const s = d && typeof d === 'object' ? d : {};
  const out = { ...s };
  LISTES.forEach((k) => { out[k] = Array.isArray(s[k]) ? s[k] : []; });
  out.trash = Array.isArray(s.trash) ? s.trash : [];
  out.deleted = s.deleted && typeof s.deleted === 'object' && !Array.isArray(s.deleted) ? s.deleted : {};
  out.meta = s.meta && typeof s.meta === 'object' ? s.meta : {};
  return out;
}

// `a` = appareil, `b` = serveur. À dates égales (enregistrements antérieurs
// à l'horodatage, ou jamais modifiés), la copie du serveur fait foi.
function plusRecent(a, b) {
  const ta = stamp(a), tb = stamp(b);
  if (ta !== tb) return ta > tb ? a : b;
  return b;
}

function fusionListe(a, b) {
  const parId = new Map();
  const sansId = [];
  const vus = new Set();
  const ajouter = (x) => {
    if (!x || typeof x !== 'object') return;
    if (!x.id) {
      const c = canonical(x);
      if (!vus.has(c)) { vus.add(c); sansId.push(x); }
      return;
    }
    const deja = parId.get(x.id);
    parId.set(x.id, deja ? plusRecent(deja, x) : x);
  };
  a.forEach(ajouter);
  b.forEach(ajouter);
  // Ordre stable : plus récents d'abord (ordre de création), comme à l'écran.
  const items = [...parId.values()];
  items.sort((x, y) => {
    const cx = x.createdAt || '', cy = y.createdAt || '';
    if (cx !== cy) return cx > cy ? -1 : 1;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
  return [...items, ...sansId];
}

function fusionUnique(champ, cleDate, a, b, out) {
  const da = a.meta[cleDate] || '', db = b.meta[cleDate] || '';
  const aDef = a[champ] !== undefined, bDef = b[champ] !== undefined;
  let choix;
  if (aDef && !bDef) choix = 'a';
  else if (!aDef && bDef) choix = 'b';
  else if (da !== db) choix = da > db ? 'a' : 'b';
  else choix = 'b'; // dates égales : le serveur fait foi
  const src = choix === 'a' ? a : b;
  if (src[champ] !== undefined) out[champ] = src[champ];
  const d = da > db ? da : db;
  if (d) out.meta[cleDate] = d;
}

export function mergeSnapshots(localBrut, distantBrut, maintenant = Date.now()) {
  const a = normalizeSnapshot(localBrut);
  const b = normalizeSnapshot(distantBrut);
  const out = { ...b, ...a, meta: {}, deleted: {} };

  // 1. Suppressions définitives : réunion, date la plus récente, purge des anciennes.
  const limite = new Date(maintenant - TOMBSTONE_TTL_MS).toISOString();
  [a.deleted, b.deleted].forEach((m) => Object.entries(m).forEach(([id, date]) => {
    if (typeof date !== 'string' || date < limite) return;
    if (!out.deleted[id] || out.deleted[id] < date) out.deleted[id] = date;
  }));

  // 2. Corbeille : réunion des entrées, hors entrées purgées ou restaurées.
  let trash = fusionListe(a.trash, b.trash).filter((e) => !(e.id && out.deleted[e.id]));
  trash.sort((x, y) => ((x.deletedAt || '') > (y.deletedAt || '') ? -1 : (x.deletedAt || '') < (y.deletedAt || '') ? 1 : 0));
  // Un même élément ne figure qu'une fois dans la corbeille (la mise à la
  // corbeille la plus récente), et pas du tout s'il a été supprimé définitivement.
  {
    const dejaVu = new Set();
    trash = trash.filter((e) => {
      const id = e?.data?.id;
      if (!id) return true;
      if (out.deleted[id] && out.deleted[id] >= (e.deletedAt || '')) return false;
      const cle = `${e.type}:${id}`;
      if (dejaVu.has(cle)) return false;
      dejaVu.add(cle);
      return true;
    });
  }

  // Dernière mise à la corbeille connue de chaque élément.
  const misALaCorbeille = new Map();
  trash.forEach((e) => {
    const id = e?.data?.id;
    const liste = LISTE_PAR_TYPE[e.type];
    if (!id || !liste) return;
    const cle = `${liste}:${id}`;
    const d = e.deletedAt || '';
    if (!misALaCorbeille.has(cle) || misALaCorbeille.get(cle) < d) misALaCorbeille.set(cle, d);
  });

  // 3. Listes : la version la plus récente de chaque enregistrement, sauf
  //    s'il a été supprimé (corbeille ou définitif) APRÈS sa dernière modification.
  LISTES.forEach((k) => {
    out[k] = fusionListe(a[k], b[k]).filter((x) => {
      if (!x.id) return true;
      const t = stamp(x);
      const supprime = out.deleted[x.id];
      if (supprime && supprime >= t) return false;
      const corbeille = misALaCorbeille.get(`${k}:${x.id}`);
      if (corbeille !== undefined && corbeille >= t) return false;
      return true;
    });
  });

  // Une entrée de corbeille dont l'élément est revenu dans sa liste (modifié
  // ou restauré après la suppression) n'a plus lieu d'être.
  const vivants = new Set();
  LISTES.forEach((k) => out[k].forEach((x) => { if (x.id) vivants.add(`${k}:${x.id}`); }));
  out.trash = trash.filter((e) => {
    const liste = LISTE_PAR_TYPE[e.type];
    return !(liste && e?.data?.id && vivants.has(`${liste}:${e.data.id}`));
  });

  // 4. Réglages uniques.
  fusionUnique('societe', 'societeAt', a, b, out);
  fusionUnique('kmCumules', 'kmAt', a, b, out);
  fusionUnique('contactCategories', 'categoriesAt', a, b, out);

  return out;
}

// Comparaison de fond entre deux instantanés (insensible à l'ordre des clés
// et aux champs techniques d'export).
export function sameSnapshot(x, y) {
  const nettoie = (d) => {
    const n = normalizeSnapshot(d);
    const { exportedAt: _e, app: _a, version: _v, ...reste } = n;
    return reste;
  };
  return canonical(nettoie(x)) === canonical(nettoie(y));
}
