// Avenant — modifie une clause précise d'un mandat existant sans en
// bouleverser le reste. Champ libre pour la modification, le reste du
// mandat étant réputé inchangé.

export const FIELDS = [
  { id: 'mandatNumero', section: 'Mandat concerné', label: 'Numéro du mandat modifié', type: 'text', required: true },
  { id: 'mandatType', section: 'Mandat concerné', label: 'Type de mandat', type: 'select', options: ['Mandat de vente', 'Mandat de recherche'], default: 'Mandat de vente' },
  { id: 'avenantNumero', section: 'Mandat concerné', label: "Numéro de l'avenant", type: 'number', default: 1 },

  { id: 'mandantNom', section: 'Parties', label: 'Nom du mandant', type: 'text', required: true },
  { id: 'mandantAdresse', section: 'Parties', label: 'Adresse du mandant', type: 'text' },

  { id: 'objetModification', section: 'Modification', label: 'Objet de la modification', type: 'textarea', required: true, placeholder: 'Décrire précisément la clause modifiée et sa nouvelle rédaction…' },

  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text' },
];

export function buildSections(champs) {
  return [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        `Le mandant : ${champs.mandantNom || '…'}${champs.mandantAdresse ? `, domicilié·e ${champs.mandantAdresse}` : ''}. Ci-après « le Mandant ».`,
        `Le mandataire : ${champs._agenceRaisonSociale || '…'}, ${champs._agenceAdresse || '…'}, titulaire de la carte professionnelle transaction n° ${champs._agenceCpi || '…'}. Ci-après « le Mandataire ».`,
      ],
    },
    {
      title: 'Rappel',
      paragraphs: [
        `Le Mandant et le Mandataire ont conclu un ${champs.mandatType || 'mandat'} n° ${champs.mandatNumero || '…'}, ci-après « le Mandat ».`,
        `Les parties conviennent, par le présent avenant n° ${champs.avenantNumero || 1}, de modifier le Mandat dans les conditions ci-après.`,
      ],
    },
    {
      title: 'Objet de la modification',
      paragraphs: [champs.objetModification || '…'],
    },
    {
      title: 'Maintien des autres dispositions',
      paragraphs: [
        "Toutes les autres clauses et conditions du Mandat, non modifiées par le présent avenant, demeurent inchangées et continuent de produire leurs effets.",
        "Les dispositions du présent avenant entrent en vigueur à la date de sa signature par l'ensemble des parties.",
      ],
    },
    {
      title: 'Fait et signé',
      paragraphs: [
        `Fait à ${champs.lieuSignature || '…'}, et signé par les parties, chacune conservant un exemplaire.`,
      ],
    },
  ];
}

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit avant toute signature.";
