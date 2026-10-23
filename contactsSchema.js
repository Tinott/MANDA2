// Schéma du carnet de contacts — tout ce que l'application (et le Copilote)
// sait d'un contact, structuré pour pouvoir le filtrer, le rapprocher d'un
// bien et le relancer au bon moment. Tous les champs sont optionnels : les
// contacts existants restent valides tels quels.

export const CLASSES_ACTIFS = ['Bureaux', 'Logistique', 'Activité', 'Commerces', 'Retail park', 'Hôtellerie', 'Résidentiel', 'Terrain', 'Mixte'];
export const VEHICULES = ['SCPI', 'OPCI', 'Foncière cotée', 'Foncière privée', 'Family office', 'Investisseur privé', 'Fonds', 'Promoteur', 'Utilisateur', 'Autre'];
export const STRATEGIES = ['Core', 'Core+', 'Value-add', 'Opportuniste', 'Sale & leaseback', 'Utilisateur'];
export const STATUTS_RELATION = ['Prospect', 'Actif', 'Client', 'Partenaire', 'Inactif'];
export const TYPES_INTERACTION = ['Appel', 'Email', 'RDV', 'Visite', 'Envoi IM', 'Offre reçue', 'Note'];

export const CONTACT_EMPTY = {
  // Identité
  societe: '', nom: '', prenom: '', fonction: '', email: '', telephone: '', adresse: '', linkedin: '', siteWeb: '',
  categorie: '',
  // Profil investisseur / critères de recherche
  vehicule: '', classesActifs: [], zones: [], ticketMin: '', ticketMax: '', rendementCible: '', strategie: '',
  // Pour un propriétaire / vendeur : ce qu'il détient
  patrimoine: '',
  // Suivi de la relation
  statutRelation: 'Prospect', source: '', prochaineRelance: '', notes: '',
  interactions: [], // { id, date, type, note }
};

// Normalise un contact (anciens enregistrements compris) vers le schéma complet.
export function normalizeContact(c) {
  return {
    ...CONTACT_EMPTY,
    ...c,
    classesActifs: Array.isArray(c?.classesActifs) ? c.classesActifs : [],
    zones: Array.isArray(c?.zones) ? c.zones : (c?.zones ? String(c.zones).split(/[;,]/).map((z) => z.trim()).filter(Boolean) : []),
    interactions: Array.isArray(c?.interactions) ? c.interactions : [],
  };
}

export function contactLabel(c) {
  return c?.societe || [c?.prenom, c?.nom].filter(Boolean).join(' ') || 'Contact sans nom';
}

export function dernierContact(c) {
  const dates = (c?.interactions || []).map((i) => i.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : '';
}

// Un contact est considéré « investisseur » s'il a un profil renseigné ou
// une catégorie qui le dit.
export function estInvestisseur(c) {
  return Boolean(
    (c?.classesActifs && c.classesActifs.length) || c?.vehicule || c?.ticketMax || c?.ticketMin ||
    /invest|fonci|scpi|opci|family|fonds/i.test(c?.categorie || '')
  );
}
