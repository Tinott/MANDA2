// Registre des types de documents — reprend l'organisation par catégorie
// observée chez le client (VENTE > Mandats / Compromis / Promesses,
// ACHAT > Mandats / Offre / Promesses), limité aux documents de vente
// comme demandé.

export const DOCUMENT_CATEGORIES = [
  { id: 'vente_mandats', label: 'Vente > Mandats' },
  { id: 'vente_compromis', label: 'Vente > Compromis' },
  { id: 'vente_promesses', label: 'Vente > Promesses' },
  { id: 'achat_mandats', label: 'Achat > Mandats' },
  { id: 'achat_offre', label: 'Achat > Offre' },
  { id: 'achat_promesses', label: 'Achat > Promesses' },
  { id: 'avenants', label: 'Avenants' },
];

export const VARIANTES_MANDAT = ['Simple', 'Semi-exclusif', 'Exclusif'];

// `ready: true` = contenu complet, généré à partir de modèles réels revus
// et reformulés. `ready: false` = le type existe dans la bibliothèque
// (pour que l'organisation Modelo soit fidèlement reproduite) mais ne
// génère pas encore de document tant qu'un contenu juridique validé n'a
// pas été fourni — pour ne jamais produire un compromis ou une promesse
// inventés de toutes pièces.
export const DOCUMENT_TYPES = [
  {
    id: 'mandat_vente',
    label: 'Mandat de vente',
    category: 'vente_mandats',
    hasVariante: true,
    ready: true,
  },
  {
    id: 'mandat_recherche',
    label: 'Mandat de recherche',
    category: 'achat_mandats',
    hasVariante: true,
    ready: true,
  },
  {
    id: 'offre_achat',
    label: "Offre d'achat",
    category: 'achat_offre',
    hasVariante: false,
    ready: true,
  },
  {
    id: 'compromis_vente',
    label: 'Compromis de vente',
    category: 'vente_compromis',
    hasVariante: false,
    ready: false,
  },
  {
    id: 'promesse_vente',
    label: 'Promesse de vente',
    category: 'vente_promesses',
    hasVariante: false,
    ready: false,
  },
  {
    id: 'avenant',
    label: 'Avenant',
    category: 'avenants',
    hasVariante: false,
    ready: true,
  },
];

export const DOCUMENT_STATUTS = ['Brouillon', 'Signature en cours', 'Signé'];

export function documentTypeLabel(typeId) {
  return DOCUMENT_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

export function documentTitle(typeId, variante) {
  const type = DOCUMENT_TYPES.find((t) => t.id === typeId);
  if (!type) return typeId;
  if (!type.hasVariante || !variante) return type.label;
  return `${type.label} (${variante})`;
}
