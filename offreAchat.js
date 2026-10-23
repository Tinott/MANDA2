// Offre d'achat — engagement unilatéral et écrit d'un acquéreur potentiel,
// à prix et conditions déterminés, valable pendant une durée limitée.

export const FIELDS = [
  { id: 'offrantNom', section: 'Offrant', label: "Nom de l'offrant (acquéreur potentiel)", type: 'text', required: true },
  { id: 'offrantAdresse', section: 'Offrant', label: 'Adresse', type: 'text' },
  { id: 'offrantTelephone', section: 'Offrant', label: 'Téléphone', type: 'text' },
  { id: 'offrantEmail', section: 'Offrant', label: 'Email', type: 'text' },

  { id: 'bienAdresse', section: 'Bien concerné', label: 'Adresse du bien', type: 'text', required: true },
  { id: 'mandatNumero', section: 'Bien concerné', label: 'Mandat de vente associé (n°)', type: 'text' },

  { id: 'prixOffert', section: 'Offre', label: 'Prix offert (€)', type: 'number', required: true },
  { id: 'dureeValidite', section: 'Offre', label: 'Durée de validité de l\u2019offre (jours)', type: 'number', default: 7 },
  { id: 'conditionFinancement', section: 'Offre', label: "Offre conditionnée à l'obtention d'un prêt", type: 'select', options: ['Oui', 'Non — achat comptant'], default: 'Oui' },
  { id: 'apportPersonnel', section: 'Offre', label: 'Apport personnel envisagé (€)', type: 'number', showIf: (c) => c.conditionFinancement === 'Oui' },
  { id: 'autresConditions', section: 'Offre', label: 'Autres conditions particulières', type: 'textarea' },

  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text' },
];

export function buildSections(champs) {
  return [
    {
      title: "Identification de l'offrant",
      paragraphs: [
        `${champs.offrantNom || '…'}${champs.offrantAdresse ? `, domicilié·e ${champs.offrantAdresse}` : ''}` +
          (champs.offrantTelephone ? `, téléphone ${champs.offrantTelephone}` : '') +
          (champs.offrantEmail ? `, email ${champs.offrantEmail}` : '') +
          ', ci-après « l\'Offrant ».',
      ],
    },
    {
      title: 'Bien concerné',
      paragraphs: [
        `L'Offrant présente la présente offre d'achat pour le bien situé ${champs.bienAdresse || '…'}` +
          (champs.mandatNumero ? `, commercialisé dans le cadre du mandat de vente n° ${champs.mandatNumero}` : '') +
          '.',
      ],
    },
    {
      title: "Montant de l'offre",
      paragraphs: [
        `L'Offrant propose d'acquérir le bien décrit ci-dessus au prix de ${champs.prixOffert ? Number(champs.prixOffert).toLocaleString('fr-FR') : '…'} €.`,
        champs.conditionFinancement === 'Oui'
          ? `Cette offre est faite sous réserve de l'obtention d'un ou plusieurs prêts bancaires, l'Offrant prévoyant un apport personnel de ${champs.apportPersonnel ? Number(champs.apportPersonnel).toLocaleString('fr-FR') : '…'} €.`
          : "Cette offre est faite pour un achat sans recours à un financement bancaire.",
        champs.autresConditions || null,
      ].filter(Boolean),
    },
    {
      title: 'Durée de validité',
      paragraphs: [
        `La présente offre est valable ${champs.dureeValidite || '…'} jours à compter de sa réception par le vendeur ou son mandataire. Passé ce délai, elle sera réputée caduque si elle n'a pas été acceptée.`,
        "L'acceptation de la présente offre par le vendeur engage les parties à régulariser un compromis ou une promesse de vente dans les meilleurs délais.",
      ],
    },
    {
      title: 'Fait et signé',
      paragraphs: [
        `Fait à ${champs.lieuSignature || '…'}, et signé par l'Offrant.`,
      ],
    },
  ];
}

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit avant toute signature.";
