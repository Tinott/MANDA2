// Avenant à un mandat — version enrichie, calquée sur la structure des
// avenants professionnels réels : identification complète des parties (même
// niveau de détail que le mandat d'origine, agent commercial compris), rappel
// du mandat modifié, objet de la modification (saisie libre ou clause type
// « prise en charge de frais déduits des honoraires »), maintien des autres
// dispositions, entrée en vigueur, élection de domicile et signatures.
// Le texte reste reformulé (même substance, mots propres) et marqué brouillon
// tant qu'il n'a pas été validé par un professionnel du droit.

export const FIELDS = [
  { id: 'mandatNumero', section: 'Mandat concerné', label: 'Numéro du mandat modifié', type: 'text', required: true, placeholder: 'AO-719' },
  { id: 'mandatType', section: 'Mandat concerné', label: 'Type de mandat', type: 'select', options: ['Mandat de vente', 'Mandat de recherche'], default: 'Mandat de vente' },
  { id: 'mandatDate', section: 'Mandat concerné', label: 'Date de signature du mandat', type: 'text', placeholder: 'JJ/MM/AAAA' },
  { id: 'mandatObjet', section: 'Mandat concerné', label: 'Bien / opération concernée', type: 'text', placeholder: 'Ensemble immobilier sis …' },
  { id: 'avenantNumero', section: 'Mandat concerné', label: "Numéro de l'avenant", type: 'number', default: 1 },

  { id: 'mandantType', section: 'Mandant', label: 'Le mandant est', type: 'select', options: ['Une personne physique', 'Une société'], default: 'Une société' },
  { id: 'mandantNom', section: 'Mandant', label: 'Nom / Raison sociale', type: 'text', required: true },
  { id: 'mandantForme', section: 'Mandant', label: 'Forme sociale', type: 'text', placeholder: 'SAS, SARL, SCI, SCPI…', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantCapital', section: 'Mandant', label: 'Capital social (€)', type: 'number', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantAdresse', section: 'Mandant', label: 'Adresse / Siège social', type: 'text', required: true },
  { id: 'mandantRcs', section: 'Mandant', label: 'RCS (ville et numéro)', type: 'text', placeholder: 'Paris 123 456 789', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantRepresentant', section: 'Mandant', label: 'Représentée par', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantQualite', section: 'Mandant', label: 'En qualité de', type: 'text', placeholder: 'Président, Gérant…', showIf: (c) => c.mandantType === 'Une société' },

  { id: 'agentCommercialNom', section: 'Mandataire', label: "Agent commercial (représentant l'Agence)", type: 'text', placeholder: 'Prénom NOM' },
  { id: 'agentCommercialRsac', section: 'Mandataire', label: 'N° RSAC de l\u2019agent commercial', type: 'text', placeholder: '2025AC00420' },
  { id: 'garantieCaisse', section: 'Mandataire', label: 'Caisse de garantie (nom et n°)', type: 'text', placeholder: 'GALIAN SMABTP n° …' },
  { id: 'assuranceRcp', section: 'Mandataire', label: 'Assurance RCP (compagnie et n° de police)', type: 'text', placeholder: 'MMA IARD n° …' },
  { id: 'tvaIntra', section: 'Mandataire', label: 'N° TVA intracommunautaire', type: 'text', placeholder: 'FR…' },

  { id: 'clauseType', section: 'Modification', label: 'Nature de la modification', type: 'select', options: ['Rédaction libre', 'Prise en charge de frais par le mandataire (déduits des honoraires)'], default: 'Rédaction libre' },
  { id: 'objetModification', section: 'Modification', label: 'Objet de la modification', type: 'textarea', required: true, placeholder: 'Décrire précisément la clause modifiée et sa nouvelle rédaction…', showIf: (c) => c.clauseType !== 'Prise en charge de frais par le mandataire (déduits des honoraires)' },
  { id: 'fraisNature', section: 'Modification', label: 'Nature des frais pris en charge', type: 'text', placeholder: 'frais de géomètre-expert', showIf: (c) => c.clauseType === 'Prise en charge de frais par le mandataire (déduits des honoraires)' },
  { id: 'fraisPlafond', section: 'Modification', label: 'Plafond de prise en charge (€ TTC, optionnel)', type: 'number', showIf: (c) => c.clauseType === 'Prise en charge de frais par le mandataire (déduits des honoraires)' },
  { id: 'fraisDelaiFacture', section: 'Modification', label: 'Facture communiquée au plus tard (jours avant l\u2019acte)', type: 'number', default: 15, showIf: (c) => c.clauseType === 'Prise en charge de frais par le mandataire (déduits des honoraires)' },

  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text', default: "dans les locaux de l'Agence" },
];

export function buildSections(champs) {
  const estSociete = champs.mandantType === 'Une société';
  const estFrais = champs.clauseType === 'Prise en charge de frais par le mandataire (déduits des honoraires)';
  const nature = champs.fraisNature || 'frais de géomètre-expert';

  return [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        estSociete
          ? `La Société ${champs.mandantNom || '…'}${champs.mandantForme ? `, ${champs.mandantForme}` : ''}${champs.mandantCapital ? ` au capital social de ${Number(champs.mandantCapital).toLocaleString('fr-FR')} euros` : ''}, dont le siège social est situé ${champs.mandantAdresse || '…'}${champs.mandantRcs ? `, immatriculée au RCS ${champs.mandantRcs}` : ''}, représentée par ${champs.mandantRepresentant || '…'}, se déclarant habilité(e) à cet effet en qualité de ${champs.mandantQualite || '…'}.`
          : `${champs.mandantNom || '…'}, demeurant ${champs.mandantAdresse || '…'}.`,
        'Ci-après « le MANDANT », d\u2019une part,',
        `La société ${champs._agenceRaisonSociale || '…'}, dont le siège social est situé ${champs._agenceAdresse || '…'}, titulaire de la carte professionnelle « Transaction sur immeubles et fonds de commerce » n° ${champs._agenceCpi || '…'}${champs.tvaIntra ? `, n° de TVA ${champs.tvaIntra}` : ''}${champs.assuranceRcp ? `, assurée en responsabilité civile professionnelle auprès de ${champs.assuranceRcp}` : champs._agenceRcp ? `, garantie/RCP : ${champs._agenceRcp}` : ''}${champs.garantieCaisse ? `, adhérente de la caisse de garantie ${champs.garantieCaisse}` : ''}.`,
        "DÉCLARANT NE POUVOIR NI RECEVOIR NI DÉTENIR D'AUTRES FONDS, EFFETS OU VALEURS QUE CEUX REPRÉSENTATIFS DE SA RÉMUNÉRATION.",
        champs.agentCommercialNom
          ? `Représentée par ${champs.agentCommercialNom}, entrepreneur individuel agissant en qualité d'agent commercial, régulièrement inscrit au Registre spécial des agents commerciaux sous le numéro ${champs.agentCommercialRsac || '…'}, ayant tous pouvoirs à l'effet des présentes.`
          : null,
        'Ci-après « l\u2019Agence » ou « le MANDATAIRE », d\u2019autre part.',
      ].filter(Boolean),
    },
    {
      title: 'Rappel',
      paragraphs: [
        `Le MANDANT et le MANDATAIRE ont conclu un ${(champs.mandatType || 'mandat').toLowerCase()} enregistré sous le numéro ${champs.mandatNumero || '…'}${champs.mandatDate ? `, signé le ${champs.mandatDate}` : ''}${champs.mandatObjet ? `, portant sur ${champs.mandatObjet}` : ''}, ci-après « le Mandat ».`,
        `Les parties sont convenues d'apporter au Mandat les modifications ci-après, formalisées par le présent avenant n° ${champs.avenantNumero || 1}, lequel en fait partie intégrante.`,
      ],
    },
    {
      title: 'Objet de la modification',
      paragraphs: estFrais
        ? [
            `Le MANDATAIRE accepte de supporter les ${nature} exposés dans le cadre de l'opération objet du Mandat${champs.fraisPlafond ? `, dans la limite d'un montant de ${Number(champs.fraisPlafond).toLocaleString('fr-FR')} € TTC` : ''}.`,
            "Le montant correspondant, justifié par facture, viendra en déduction du montant TTC des honoraires dus au MANDATAIRE, tel que stipulé au Mandat, lors de la réitération de la vente par acte authentique.",
            `La facture correspondante sera communiquée au notaire chargé de la rédaction de l'acte authentique au plus tard ${champs.fraisDelaiFacture || 15} jours avant la date prévue pour sa signature.`,
          ]
        : [champs.objetModification || '…'],
    },
    {
      title: 'Maintien des autres dispositions',
      paragraphs: [
        "Toutes les clauses et conditions du Mandat non modifiées par le présent avenant demeurent inchangées et continuent de produire l'intégralité de leurs effets entre les parties.",
        "Le présent avenant entre en vigueur à la date de sa signature par l'ensemble des parties.",
      ],
    },
    {
      title: 'Élection de domicile',
      paragraphs: [
        'Les parties soussignées font élection de domicile chacune à leur adresse respective stipulée en tête du présent avenant.',
      ],
    },
    {
      title: 'Date et signatures',
      paragraphs: [
        `Fait à ${champs.lieuSignature || "dans les locaux de l'Agence"} et signé par l'ensemble des Parties, chacune d'elles en conservant un exemplaire original sur un support durable garantissant l'intégrité de l'acte.`,
      ],
    },
  ];
}

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit (avocat, notaire ou votre organisation professionnelle) avant toute signature.";
