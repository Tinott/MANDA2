// Mandat de recherche — même logique que le mandat de vente, objet inversé
// (le mandataire recherche un bien à acquérir pour le compte du mandant,
// qui est ici un acquéreur potentiel). Texte reformulé, brouillon à valider.

export const FIELDS = [
  { id: 'mandantType', section: 'Mandant', label: 'Le mandant est', type: 'select', options: ['Une personne physique', 'Une société'], default: 'Une personne physique' },
  { id: 'mandantNom', section: 'Mandant', label: 'Nom / Raison sociale', type: 'text', required: true },
  { id: 'mandantAdresse', section: 'Mandant', label: 'Adresse', type: 'text', required: true },
  { id: 'mandantRepresentant', section: 'Mandant', label: 'Représenté par (si société)', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantQualite', section: 'Mandant', label: 'En qualité de', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantTelephone', section: 'Mandant', label: 'Téléphone', type: 'text' },
  { id: 'mandantEmail', section: 'Mandant', label: 'Email', type: 'text' },

  { id: 'bienDescription', section: 'Bien recherché', label: 'Critères du bien recherché', type: 'textarea', required: true, placeholder: 'Type de bien, secteur, surface, budget…' },
  { id: 'bienAdresseCible', section: 'Bien recherché', label: 'Bien identifié (le cas échéant)', type: 'text' },

  { id: 'prixMax', section: 'Prix et honoraires', label: "Prix d'acquisition maximum (€)", type: 'number', required: true },
  { id: 'honorairesTaux', section: 'Prix et honoraires', label: 'Honoraires (%TTC du prix)', type: 'number' },
  { id: 'honorairesCharge', section: 'Prix et honoraires', label: 'Honoraires à la charge de', type: 'select', options: ['Acquéreur (le mandant)', 'Vendeur'], default: 'Acquéreur (le mandant)' },

  { id: 'dureeInitiale', section: 'Durée', label: 'Durée initiale (mois)', type: 'number', default: 3 },
  { id: 'tacite', section: 'Durée', label: 'Reconduction / prorogation', type: 'select', options: ['Aucune — fin automatique', 'Tacite reconduction'], default: 'Aucune — fin automatique' },
  { id: 'dureeMax', section: 'Durée', label: 'Durée totale maximale (mois)', type: 'number', showIf: (c) => c.tacite === 'Tacite reconduction' },

  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text' },
];

export function buildSections(champs, variante) {
  const exclusif = variante === 'Exclusif';
  const semiExclusif = variante === 'Semi-exclusif';

  return [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        `Le mandant : ${champs.mandantNom || '…'}, domicilié·e ${champs.mandantAdresse || '…'}` +
          (champs.mandantType === 'Une société'
            ? `, représenté·e par ${champs.mandantRepresentant || '…'} en qualité de ${champs.mandantQualite || '…'}`
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
          ? "Le Mandant confère au Mandataire, qui l'accepte, un mandat exclusif de rechercher un bien correspondant à la description ci-après. Pendant toute la durée du mandat, le Mandant s'interdit de mener personnellement ou par un autre intermédiaire des démarches d'acquisition portant sur un bien correspondant à cette description."
          : semiExclusif
          ? "Le Mandant confère au Mandataire, qui l'accepte, un mandat semi-exclusif de rechercher un bien correspondant à la description ci-après. Le Mandant s'interdit de confier cette recherche à un autre professionnel, mais conserve la faculté de mener personnellement des démarches, sous réserve d'en informer le Mandataire."
          : "Le Mandant confère au Mandataire, qui l'accepte, un mandat sans exclusivité de rechercher un bien correspondant à la description ci-après. Le Mandant conserve toute liberté de recourir à d'autres intermédiaires ou de mener personnellement sa recherche.",
      ],
    },
    {
      title: 'Bien recherché',
      paragraphs: [
        champs.bienDescription || '…',
        champs.bienAdresseCible ? `Bien déjà identifié à ce jour : ${champs.bienAdresseCible}.` : null,
      ].filter(Boolean),
    },
    {
      title: 'Prix et honoraires du mandataire',
      paragraphs: [
        `Le prix d'acquisition ne pourra excéder ${champs.prixMax ? Number(champs.prixMax).toLocaleString('fr-FR') : '…'} €.`,
        `En cas de réalisation de l'opération, le Mandataire percevra des honoraires de ${champs.honorairesTaux || '…'} % TTC du prix de vente, à la charge de ${champs.honorairesCharge === 'Vendeur' ? 'le vendeur' : "l'acquéreur (le Mandant)"}, exigibles à la signature de l'acte authentique.`,
      ],
    },
    {
      title: 'Durée du mandat',
      paragraphs: [
        `Le présent mandat, qui prend effet à sa signature, est consenti pour une durée initiale de ${champs.dureeInitiale || '…'} mois.` +
          (champs.tacite === 'Tacite reconduction'
            ? ` Il se renouvelle ensuite par tacite reconduction, sans que sa durée totale ne puisse excéder ${champs.dureeMax || '…'} mois à compter de sa signature.`
            : " À l'issue de cette période, il prend automatiquement fin, sauf renouvellement exprès entre les parties."),
        (exclusif || semiExclusif)
          ? "Conformément à l'article 78 du décret n° 72-678 du 20 juillet 1972, passé un délai de trois mois à compter de sa signature, le présent mandat — assorti d'une clause d'exclusivité — peut être dénoncé à tout moment par chacune des parties, moyennant un préavis de quinze jours notifié par lettre recommandée avec accusé de réception."
          : null,
      ].filter(Boolean),
    },
    {
      title: 'Engagements du mandant',
      paragraphs: [
        "Le Mandant déclare avoir la capacité juridique d'acquérir le bien recherché.",
        exclusif
          ? "Pendant la durée du mandat et pendant les douze mois suivant son expiration ou sa révocation, le Mandant s'interdit de traiter, directement ou indirectement, avec un vendeur dont le bien lui aurait été présenté par le Mandataire. Tout manquement ouvre droit, au profit du Mandataire, à une indemnité forfaitaire égale au montant des honoraires prévus au présent mandat."
          : "Le Mandant s'engage à informer le Mandataire de toute acquisition réalisée pendant la durée du mandat, y compris sans son intermédiaire.",
        "Le Mandant autorise le Mandataire à établir tout acte sous seing privé nécessaire à l'accomplissement de sa mission et s'engage, en cas de signature d'une promesse de vente, à verser le dépôt de garantie usuel.",
      ],
    },
    {
      title: 'Protection des données personnelles',
      paragraphs: [
        "Les données à caractère personnel recueillies dans le cadre du présent mandat sont traitées par le Mandataire aux fins de son exécution et de la gestion de la relation commerciale. Le Mandant dispose d'un droit d'accès, de rectification, d'effacement et d'opposition, ainsi que d'un droit de réclamation auprès de la CNIL.",
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
