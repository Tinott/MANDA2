// Résolution des champs d'un document — léger, sans jsPDF, importable
// statiquement par les pages qui construisent le formulaire.

const LOADERS = {
  mandat_vente: () => import('./documentTemplates/mandatVente.js'),
  mandat_recherche: () => import('./documentTemplates/mandatRecherche.js'),
  avenant: () => import('./documentTemplates/avenant.js'),
  offre_achat: () => import('./documentTemplates/offreAchat.js'),
};

export async function loadTemplate(typeId) {
  const loader = LOADERS[typeId];
  if (!loader) return null;
  return loader();
}

export function applyDefaults(fields, champs) {
  const out = { ...champs };
  fields.forEach((f) => {
    if (out[f.id] === undefined && f.default !== undefined) out[f.id] = f.default;
  });
  return out;
}

export async function getFieldsFor(typeId) {
  const mod = await loadTemplate(typeId);
  return mod ? mod.FIELDS : [];
}

export function visibleFields(fields, champs) {
  return fields.filter((f) => !f.showIf || f.showIf(champs));
}

// Regroupe les champs par section, dans l'ordre d'apparition, pour
// construire l'assistant pas-à-pas.
export function fieldsBySections(fields) {
  const order = [];
  const map = new Map();
  fields.forEach((f) => {
    if (!map.has(f.section)) {
      map.set(f.section, []);
      order.push(f.section);
    }
    map.get(f.section).push(f);
  });
  return order.map((section) => ({ section, fields: map.get(section) }));
}

