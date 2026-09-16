// Mandat de vente — champs et clauses, structurés à partir de l'organisation
// observée dans les mandats réels de l'agence (mandant/mandataire, objet,
// désignation du bien, prix/honoraires, durée, conditions générales,
// clause d'exclusivité le cas échéant). Le texte des clauses est reformulé
// avec des mots différents de ceux du modèle source — même substance
// juridique, formulation propre — et reste marqué "brouillon" tant qu'il
// n'a pas été validé par un professionnel du droit.

export const FIELDS = [
  // --- Mandant ---
  { id: 'mandantType', section: 'Mandant', label: 'Le mandant est', type: 'select', options: ['Une personne physique', 'Une société'], default: 'Une personne physique' },
  { id: 'mandantNom', section: 'Mandant', label: 'Nom / Raison sociale', type: 'text', required: true },
  { id: 'mandantAdresse', section: 'Mandant', label: 'Adresse', type: 'text', required: true },
  { id: 'mandantRepresentant', section: 'Mandant', label: 'Représenté par (si société)', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantQualite', section: 'Mandant', label: 'En qualité de', type: 'text', showIf: (c) => c.mandantType === 'Une société', placeholder: 'Gérant, Président…' },
  { id: 'mandantRcs', section: 'Mandant', label: 'RCS / SIREN', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantTelephone', section: 'Mandant', label: 'Téléphone', type: 'text' },
  { id: 'mandantEmail', section: 'Mandant', label: 'Email', type: 'text' },

  // --- Bien ---
  { id: 'bienAdresse', section: 'Bien', label: 'Adresse du bien', type: 'text', required: true },
  { id: 'bienDescription', section: 'Bien', label: 'Description du bien', type: 'textarea' },
  { id: 'bienReference', section: 'Bien', label: 'Référence cadastrale', type: 'text' },
  { id: 'bienOccupation', section: 'Bien', label: "État d'occupation", type: 'select', options: ['Libre', 'Loué', 'Occupé par le mandant'], default: 'Libre' },
  { id: 'bienOccupationDetail', section: 'Bien', label: "Détail de l'occupation", type: 'textarea', showIf: (c) => c.bienOccupation === 'Loué' },
  { id: 'bienDpe', section: 'Bien', label: 'DPE disponible', type: 'select', options: ['Oui', 'Non — à établir'], default: 'Non — à établir' },

  // --- Prix et honoraires ---
  { id: 'prixVente', section: 'Prix et honoraires', label: 'Prix de vente (€)', type: 'number', required: true },
  { id: 'honorairesType', section: 'Prix et honoraires', label: 'Honoraires', type: 'select', options: ['Pourcentage du prix', 'Forfait'], default: 'Pourcentage du prix' },
  { id: 'honorairesTaux', section: 'Prix et honoraires', label: 'Taux (%TTC)', type: 'number', showIf: (c) => c.honorairesType === 'Pourcentage du prix' },
  { id: 'honorairesForfait', section: 'Prix et honoraires', label: 'Montant forfaitaire (€ TTC)', type: 'number', showIf: (c) => c.honorairesType === 'Forfait' },
  { id: 'honorairesCharge', section: 'Prix et honoraires', label: 'Honoraires à la charge de', type: 'select', options: ['Vendeur', 'Acquéreur'], default: 'Acquéreur' },

  // --- Durée ---
  { id: 'dureeInitiale', section: 'Durée', label: 'Durée initiale (mois)', type: 'number', default: 3 },
  { id: 'tacite', section: 'Durée', label: 'Reconduction / prorogation', type: 'select', options: ['Aucune — fin automatique', 'Tacite reconduction'], default: 'Aucune — fin automatique' },
  { id: 'dureeMax', section: 'Durée', label: 'Durée totale maximale (mois)', type: 'number', showIf: (c) => c.tacite === 'Tacite reconduction' },

  // --- Divers ---
  { id: 'notaireMandant', section: 'Divers', label: 'Notaire du mandant (facultatif)', type: 'text' },
  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text' },
];

function honorairesTexte(c) {
  if (c.honorairesType === 'Forfait') return `un montant forfaitaire de ${c.honorairesForfait || '…'} € TTC`;
  return `${c.honorairesTaux || '…'} % TTC du prix de vente`;
}

export function buildSections(champs, variante) {
  const exclusif = variante === 'Exclusif';
  const semiExclusif = variante === 'Semi-exclusif';

  const sections = [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        `Le mandant : ${champs.mandantNom || '…'}, domicilié·e ${champs.mandantAdresse || '…'}` +
          (champs.mandantType === 'Une société'
            ? `, représenté·e par ${champs.mandantRepresentant || '…'} en qualité de ${champs.mandantQualite || '…'}, immatriculée ${champs.mandantRcs || '…'}`
            : '') +
          (champs.mandantTelephone ? `, téléphone ${champs.mandantTelephone}` : '') +
          (champs.mandantEmail ? `, email ${champs.mandantEmail}` : '') +
          '. Ci-après « le Mandant ».',
        `Le mandataire : ${champs._agenceRaisonSociale || '…'}, ${champs._agenceAdresse || '…'}, titulaire de la carte professionnelle transaction n° ${champs._agenceCpi || '…'}, garantie financière ${champs._agenceRcp || '…'}. Ci-après « le Mandataire ».`,
      ],
    },
    {
      title: 'Objet du mandat',
      paragraphs: [
        exclusif
          ? "Le Mandant confère au Mandataire, qui l'accepte, un mandat exclusif de rechercher un acquéreur pour le bien ci-après désigné, aux prix, charges et conditions indiqués ci-après. Pendant toute la durée du mandat, le Mandant s'interdit de confier la vente du bien à un autre professionnel et de le vendre lui-même sans en informer le Mandataire dans les conditions prévues plus loin."
          : semiExclusif
          ? "Le Mandant confère au Mandataire, qui l'accepte, un mandat semi-exclusif de rechercher un acquéreur pour le bien ci-après désigné. Pendant la durée du mandat, le Mandant s'interdit de confier la vente à un autre professionnel, mais conserve la faculté de vendre lui-même le bien sans intermédiaire, sous réserve d'en informer immédiatement le Mandataire."
          : "Le Mandant confère au Mandataire, qui l'accepte, un mandat sans exclusivité de rechercher un acquéreur pour le bien ci-après désigné, aux prix, charges et conditions indiqués ci-après. Le Mandant conserve la faculté de confier la vente à d'autres intermédiaires ou de vendre lui-même le bien.",
      ],
    },
    {
      title: 'Désignation du bien',
      paragraphs: [
        `Adresse du bien : ${champs.bienAdresse || '…'}.`,
        champs.bienDescription || null,
        champs.bienReference ? `Référence cadastrale : ${champs.bienReference}.` : null,
        `État d'occupation : ${champs.bienOccupation || '…'}${champs.bienOccupationDetail ? ` — ${champs.bienOccupationDetail}` : ''}.`,
        champs.bienDpe === 'Non — à établir'
          ? "Le Mandant déclare ne pas disposer, à ce jour, d'un diagnostic de performance énergétique conforme à la réglementation en vigueur ; celui-ci sera établi avant toute diffusion publicitaire du bien."
          : null,
      ].filter(Boolean),
    },
    {
      title: 'Prix de vente et honoraires du mandataire',
      paragraphs: [
        `Le bien est proposé au prix de ${champs.prixVente ? Number(champs.prixVente).toLocaleString('fr-FR') : '…'} €. Ce prix a été fixé par le Mandant après avoir pris connaissance de l'estimation réalisée par le Mandataire au regard du marché local.`,
        `En cas de réalisation de la vente par l'entremise du Mandataire, celui-ci percevra des honoraires de ${honorairesTexte(champs)}, à la charge de ${champs.honorairesCharge === 'Vendeur' ? 'le Mandant (vendeur)' : "l'acquéreur"}. Ces honoraires sont exigibles à la signature de l'acte authentique de vente.`,
      ],
    },
    {
      title: 'Durée du mandat',
      paragraphs: [
        `Le présent mandat, qui prend effet à sa signature, est consenti pour une durée initiale de ${champs.dureeInitiale || '…'} mois.` +
          (champs.tacite === 'Tacite reconduction'
            ? ` À l'issue de cette période, il se renouvelle par tacite reconduction, sans que sa durée totale ne puisse excéder ${champs.dureeMax || '…'} mois à compter de sa signature.`
            : " À l'issue de cette période, il prend automatiquement fin, sauf renouvellement exprès entre les parties."),
        (exclusif || semiExclusif)
          ? "Conformément à l'article 78 du décret n° 72-678 du 20 juillet 1972, passé un délai de trois mois à compter de sa signature, le présent mandat — assorti d'une clause d'exclusivité — peut être dénoncé à tout moment par chacune des parties, moyennant un préavis de quinze jours notifié par lettre recommandée avec accusé de réception."
          : null,
        "Par dérogation à l'article 2003 du Code civil, le décès du Mandant n'emporte pas résiliation du mandat, qui se poursuit avec ses ayants droit.",
      ].filter(Boolean),
    },
    {
      title: 'Engagements du mandant',
      paragraphs: [
        "Le Mandant déclare avoir la pleine capacité juridique de disposer du bien et atteste qu'il n'est grevé d'aucune procédure de saisie l'empêchant d'être vendu.",
        "Le Mandant s'engage à remettre au Mandataire, dans les meilleurs délais, l'ensemble des pièces nécessaires à l'exécution du mandat (titre de propriété, diagnostics, justificatifs réglementaires) et à l'informer sans délai de tout élément susceptible d'affecter les conditions de la vente.",
        exclusif
          ? "Pendant la durée du mandat et pendant les douze mois suivant son expiration ou sa révocation, le Mandant s'interdit de traiter, directement ou indirectement, avec toute personne à qui le bien aurait été présenté par le Mandataire, sauf accord de celui-ci. Tout manquement à cette obligation ou à l'exclusivité consentie ouvre droit, au profit du Mandataire, à une indemnité forfaitaire égale au montant des honoraires prévus au présent mandat."
          : semiExclusif
          ? "Pendant la durée du mandat, le Mandant s'interdit de confier la recherche d'un acquéreur à un autre professionnel. S'il vend lui-même le bien sans l'intermédiaire du Mandataire, il s'engage à l'en informer sans délai ; aucune indemnité n'est due dans ce cas au titre de la présente clause."
          : "Le Mandant s'engage à informer le Mandataire de toute offre reçue par un autre canal ainsi que de la conclusion éventuelle de la vente, y compris sans son intermédiaire.",
      ],
    },
    {
      title: 'Engagements du mandataire',
      paragraphs: [
        "Le Mandataire s'engage à mettre en œuvre les moyens de commercialisation qu'il juge utiles (diffusion, visites, dossier de présentation) et à tenir le Mandant informé du suivi de sa mission.",
        "Le Mandataire ne pourra en aucun cas être considéré comme gardien juridique du bien pendant la durée du mandat.",
      ],
    },
    {
      title: 'Protection des données personnelles',
      paragraphs: [
        "Les données à caractère personnel recueillies dans le cadre du présent mandat sont traitées par le Mandataire aux fins de son exécution, de la gestion de la relation commerciale et, sous réserve du consentement du Mandant, de prospection. Le Mandant dispose d'un droit d'accès, de rectification, d'effacement et d'opposition, exerçable auprès du Mandataire, ainsi que d'un droit de réclamation auprès de la CNIL.",
      ],
    },
    {
      title: 'Non-discrimination',
      paragraphs: [
        "Conformément à la loi, aucun refus de vente ne pourra être opposé à un candidat acquéreur sur un fondement discriminatoire. Le Mandataire informe le Mandant que toute discrimination est pénalement répréhensible.",
      ],
    },
    {
      title: 'Fait et signé',
      paragraphs: [
        `Fait à ${champs.lieuSignature || '…'}, et signé par les parties, chacune conservant un exemplaire.`,
      ],
    },
  ];

  return sections;
}

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit (avocat, notaire, ou votre organisation professionnelle) avant toute signature.";
