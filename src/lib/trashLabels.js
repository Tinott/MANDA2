export const TRASH_TYPE_LABEL = {
  mandat: 'Mandat',
  facture: 'Facture',
  frais: 'Note de frais',
  promesse: 'Promesse de vente',
  contact: 'Contact',
  prospect: 'Prospect',
  courrier: 'Courrier / mail',
  dossier: 'Dossier',
};

export const TRASH_TYPE_TONE = {
  mandat: 'teal',
  facture: 'brass',
  frais: 'default',
  promesse: 'rust',
  contact: 'default',
  prospect: 'brass',
  courrier: 'default',
  dossier: 'teal',
};

// Titre + sous-titre lisibles pour un élément de la corbeille — utilisé
// dans la liste complète (Corbeille) comme dans le toast d'annulation.
export function describeTrashEntry(type, d) {
  switch (type) {
    case 'mandat':
      return { title: d.adresse || 'Mandat sans adresse', sub: [d.typeMandat, d.client].filter(Boolean).join(' · ') };
    case 'facture':
      return { title: `${d.numero || 'Facture'} — ${d.client || 'Client'}`, sub: '' };
    case 'frais':
      return { title: d.commercant || d.categorieLabel || 'Dépense', sub: '' };
    case 'promesse':
      return { title: d.bienAdresse || 'Promesse de vente', sub: [d.vendeur, d.acquereur].filter(Boolean).join(' → ') };
    case 'contact':
      return { title: d.societe || [d.prenom, d.nom].filter(Boolean).join(' ') || 'Contact', sub: d.email || d.telephone || '' };
    case 'prospect':
      return { title: d.prospect || 'Prospect', sub: [d.type, d.statut].filter(Boolean).join(' · ') };
    case 'courrier':
      return { title: d.societe || d.nomContact || 'Courrier', sub: [d.typeAction, d.statut].filter(Boolean).join(' · ') };
    case 'dossier':
      return { title: d.nom || 'Dossier', sub: d.type === 'IM' ? 'Memorandum' : 'Dossier de classement' };
    default:
      return { title: 'Élément', sub: '' };
  }
}

// Version courte, pour le toast ("Contact « Julien Vasseur » supprimé").
export function trashEntryLabel(type, d) {
  const { title } = describeTrashEntry(type, d);
  const typeLabel = TRASH_TYPE_LABEL[type] || 'Élément';
  return `${typeLabel} « ${title} »`;
}
