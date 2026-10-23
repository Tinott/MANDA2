export const DEPENSE_CATEGORIES = [
  { id: 'transport', label: 'Carburant / transport', compte: '6251' },
  { id: 'repas', label: "Repas d'affaires", compte: '6257' },
  { id: 'peage', label: 'Péage / parking', compte: '6251' },
  { id: 'hebergement', label: 'Hébergement', compte: '6256' },
  { id: 'team', label: 'Team building', compte: '6234' },
  { id: 'publicite', label: 'Publicité / communication', compte: '6231' },
  { id: 'fournitures', label: 'Fournitures de bureau', compte: '6064' },
  { id: 'mandat', label: 'Frais de mandat', compte: '6226' },
  { id: 'autre', label: 'Autre charge', compte: '6288' },
];

// Barème kilométrique fiscal (véhicules) — modifiable dans Paramètres.
export const BAREME_KM = {
  3: { t1: 0.529, t2r: 0.316, t2f: 1065, t3: 0.37 },
  4: { t1: 0.606, t2r: 0.34, t2f: 1330, t3: 0.407 },
  5: { t1: 0.636, t2r: 0.357, t2f: 1395, t3: 0.427 },
  6: { t1: 0.665, t2r: 0.374, t2f: 1457, t3: 0.447 },
  7: { t1: 0.697, t2r: 0.394, t2f: 1515, t3: 0.47 },
};

export function cvBracket(cv) {
  const n = Number(cv) || 3;
  if (n <= 3) return 3;
  if (n >= 7) return 7;
  return n;
}

export function calcIndemniteKm(cv, distanceAnnuelleCumulee, distanceTrajet) {
  const b = BAREME_KM[cvBracket(cv)];
  const before = distanceAnnuelleCumulee;
  const after = distanceAnnuelleCumulee + distanceTrajet;
  // Le barème est progressif sur l'année : on calcule le coût cumulé aux deux
  // bornes et on prend la différence, ce qui répartit correctement le trajet
  // entre les tranches déjà consommées.
  return computeKmCumulative(b, after) - computeKmCumulative(b, before);
}

function computeKmCumulative(b, d) {
  if (d <= 0) return 0;
  if (d <= 5000) return d * b.t1;
  if (d <= 20000) return d * b.t2r + b.t2f;
  return d * b.t3;
}

export const MANDAT_TYPES = ['Vente', 'Location', 'Gestion', 'Recherche'];

export const REGIMES_TVA = [
  { id: 'reel_normal', label: 'Réel normal' },
  { id: 'reel_simplifie', label: 'Réel simplifié' },
  { id: 'franchise', label: 'Franchise en base (sans TVA)' },
];

export const STATUTS_FACTURE = ['Brouillon', 'Émise', 'Envoyée', 'Payée', 'En retard'];

export const ROLES = [
  { id: 'gerant', label: 'Gérant', desc: 'Accès complet à tous les modules.' },
  { id: 'comptable', label: 'Comptable', desc: 'Comptabilité, trésorerie, exports — lecture facturation.' },
  { id: 'agent', label: 'Agent / mandataire', desc: 'Ses mandats, notes de frais, data room associée.' },
];
