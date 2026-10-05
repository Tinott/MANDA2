// Mandat de recherche — version enrichie, calquée sur la structure des mandats
// de recherche professionnels réels (simple / semi-exclusif / exclusif) :
// identification complète du mandant (personne physique avec état civil,
// profession, régime matrimonial, résidence fiscale et faculté de
// substitution, ou société), mandataire avec agent commercial, bien recherché,
// prix d'acquisition maximum en lettres et chiffres, honoraires TTC non
// compris dans le prix, durée avec tacite reconduction plafonnée et
// reproduction des articles L. 215-1 à L. 215-3 et L. 241-3 du Code de la
// consommation, déclaration de non-condamnation, pouvoirs du mandataire,
// exclusivité et interdictions avec indemnité, démarchage téléphonique,
// médiation de la consommation, RGPD, élection de domicile.
// Le texte reste reformulé (même substance, mots propres) et marqué brouillon
// tant qu'il n'a pas été validé par un professionnel du droit.

import { enLettres } from './mandatVente.js';

export const FIELDS = [
  { id: 'mandantType', section: 'Mandant', label: 'Le mandant est', type: 'select', options: ['Une personne physique', 'Une société'], default: 'Une société' },
  // — Société
  { id: 'mandantNom', section: 'Mandant', label: 'Nom / Raison sociale', type: 'text', required: true },
  { id: 'mandantForme', section: 'Mandant', label: 'Forme sociale', type: 'text', placeholder: 'SAS, SARL, SCI, SCPI…', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantCapital', section: 'Mandant', label: 'Capital social (€)', type: 'number', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantAdresse', section: 'Mandant', label: 'Adresse / Siège social', type: 'text', required: true },
  { id: 'mandantRcs', section: 'Mandant', label: 'RCS (ville et numéro)', type: 'text', placeholder: 'Paris 123 456 789', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantRepresentant', section: 'Mandant', label: 'Représentée par', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantQualite', section: 'Mandant', label: 'En qualité de', type: 'text', placeholder: 'Président, Gérant…', showIf: (c) => c.mandantType === 'Une société' },
  // — Personne physique
  { id: 'mandantNaissance', section: 'Mandant', label: 'Né(e) le … à …', type: 'text', placeholder: '12/05/1980 à Bordeaux (33)', showIf: (c) => c.mandantType === 'Une personne physique' },
  { id: 'mandantProfession', section: 'Mandant', label: 'Profession', type: 'text', showIf: (c) => c.mandantType === 'Une personne physique' },
  { id: 'mandantSituation', section: 'Mandant', label: 'Situation matrimoniale', type: 'select', options: ['Célibataire', 'Marié(e) — communauté réduite aux acquêts', 'Marié(e) — communauté universelle', 'Marié(e) — séparation de biens', 'Pacsé(e)', 'Divorcé(e)', 'Veuf(ve)'], default: 'Célibataire', showIf: (c) => c.mandantType === 'Une personne physique' },
  { id: 'mandantConjoint', section: 'Mandant', label: 'Nom du conjoint', type: 'text', showIf: (c) => c.mandantType === 'Une personne physique' && String(c.mandantSituation || '').startsWith('Marié') },
  { id: 'mandantResidentFiscal', section: 'Mandant', label: 'Résident fiscal français', type: 'select', options: ['Oui', 'Non'], default: 'Oui', showIf: (c) => c.mandantType === 'Une personne physique' },
  { id: 'faculteSubstitution', section: 'Mandant', label: 'Faculté de substitution (personne morale à constituer ou désigner)', type: 'select', options: ['Oui', 'Non'], default: 'Oui' },
  { id: 'mandantTelephone', section: 'Mandant', label: 'Téléphone', type: 'text' },
  { id: 'mandantEmail', section: 'Mandant', label: 'Adresse électronique', type: 'text' },

  { id: 'agentCommercialNom', section: 'Mandataire', label: "Agent commercial (représentant l'Agence)", type: 'text', placeholder: 'Prénom NOM' },
  { id: 'agentCommercialRsac', section: 'Mandataire', label: 'N° RSAC de l\u2019agent commercial', type: 'text', placeholder: '2025AC00420' },
  { id: 'garantieCaisse', section: 'Mandataire', label: 'Caisse de garantie (nom et n°)', type: 'text', placeholder: 'GALIAN SMABTP n° …' },
  { id: 'assuranceRcp', section: 'Mandataire', label: 'Assurance RCP (compagnie et n° de police)', type: 'text', placeholder: 'MMA IARD n° …' },
  { id: 'tvaIntra', section: 'Mandataire', label: 'N° TVA intracommunautaire', type: 'text', placeholder: 'FR…' },

  { id: 'bienDescription', section: 'Bien recherché', label: 'Désignation du bien recherché', type: 'textarea', required: true, placeholder: 'Nature (local commercial, entrepôt, bureaux…), localisation recherchée, surface, état locatif attendu…' },
  { id: 'bienAdresseCible', section: 'Bien recherché', label: 'Bien d\u2019ores et déjà identifié (le cas échéant)', type: 'text', placeholder: 'Ensemble immobilier commercial sis …' },
  { id: 'bienReference', section: 'Bien recherché', label: 'Référence du dossier / de l\u2019IM', type: 'text', placeholder: 'Réf. interne' },

  { id: 'prixMax', section: 'Prix et honoraires', label: 'Prix d\u2019acquisition maximum (€)', type: 'number', required: true },
  { id: 'prixRegime', section: 'Prix et honoraires', label: 'Le prix s\u2019entend', type: 'select', options: ['Hors taxes et hors droits', 'TTC', 'Net vendeur'], default: 'Hors taxes et hors droits' },
  { id: 'honorairesType', section: 'Prix et honoraires', label: 'Honoraires du mandataire', type: 'select', options: ['Pourcentage du prix', 'Forfait'], default: 'Pourcentage du prix' },
  { id: 'honorairesTaux', section: 'Prix et honoraires', label: 'Taux (% TTC du prix d\u2019acquisition)', type: 'number', showIf: (c) => c.honorairesType !== 'Forfait' },
  { id: 'honorairesForfaitHT', section: 'Prix et honoraires', label: 'Forfait HT (€)', type: 'number', showIf: (c) => c.honorairesType === 'Forfait' },
  { id: 'tauxTva', section: 'Prix et honoraires', label: 'Taux de TVA (%)', type: 'number', default: 20, showIf: (c) => c.honorairesType === 'Forfait' },
  { id: 'honorairesCharge', section: 'Prix et honoraires', label: 'Honoraires à la charge de', type: 'select', options: ['Acquéreur (le mandant)', 'Vendeur'], default: 'Acquéreur (le mandant)' },

  { id: 'dureeInitiale', section: 'Durée', label: 'Durée initiale (mois)', type: 'number', default: 3 },
  { id: 'tacite', section: 'Durée', label: 'Reconduction', type: 'select', options: ['Aucune — fin automatique', 'Tacite reconduction'], default: 'Tacite reconduction' },
  { id: 'taciteDuree', section: 'Durée', label: 'Périodes de reconduction (mois)', type: 'number', default: 6, showIf: (c) => c.tacite === 'Tacite reconduction' },
  { id: 'dureeMax', section: 'Durée', label: 'Durée totale maximale (mois)', type: 'number', default: 12, showIf: (c) => c.tacite === 'Tacite reconduction' },

  { id: 'depotGarantiePct', section: 'Clauses', label: 'Dépôt de garantie maximal (% du prix)', type: 'number', default: 10 },
  { id: 'notaireMandant', section: 'Clauses', label: 'Notaire du mandant (le cas échéant)', type: 'text', placeholder: 'Maître …, notaire à …' },
  { id: 'mediateurNom', section: 'Clauses', label: 'Médiateur de la consommation (si mandant particulier)', type: 'text', placeholder: 'Nom du médiateur', showIf: (c) => c.mandantType === 'Une personne physique' },
  { id: 'mediateurCoordonnees', section: 'Clauses', label: 'Coordonnées / site du médiateur', type: 'text', placeholder: 'www.…', showIf: (c) => c.mandantType === 'Une personne physique' },

  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text', default: "dans les locaux de l'Agence" },
];

function honorairesTexte(champs) {
  if (champs.honorairesType === 'Forfait') {
    const ht = Number(champs.honorairesForfaitHT) || 0;
    const taux = Number(champs.tauxTva) || 20;
    const tva = Math.round(ht * taux) / 100;
    const ttc = ht + tva;
    return `fixés forfaitairement à ${ttc.toLocaleString('fr-FR')} € TTC (soit ${ht.toLocaleString('fr-FR')} € HT et ${tva.toLocaleString('fr-FR')} € de TVA au taux de ${String(taux).replace('.', ',')} %)`;
  }
  const taux = champs.honorairesTaux ? String(champs.honorairesTaux).replace('.', ',') : '…';
  return `fixés à ${taux} % TTC du prix d'acquisition`;
}

export function buildSections(champs, variante) {
  const exclusif = variante === 'Exclusif';
  const semiExclusif = variante === 'Semi-exclusif';
  const estSociete = champs.mandantType === 'Une société';
  const estParticulier = !estSociete;
  const prixMax = Number(champs.prixMax) || 0;
  const regime =
    champs.prixRegime === 'TTC' ? 'toutes taxes comprises'
    : champs.prixRegime === 'Net vendeur' ? 'net vendeur'
    : 'hors taxes et hors droits et frais d\u2019acquisition';
  const chargeAcquereur = champs.honorairesCharge !== 'Vendeur';

  const sections = [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        estSociete
          ? `La Société ${champs.mandantNom || '…'}${champs.mandantForme ? `, ${champs.mandantForme}` : ''}${champs.mandantCapital ? ` au capital social de ${Number(champs.mandantCapital).toLocaleString('fr-FR')} euros` : ''}, dont le siège social est situé ${champs.mandantAdresse || '…'}${champs.mandantRcs ? `, immatriculée au RCS ${champs.mandantRcs}` : ''}, représentée par ${champs.mandantRepresentant || '…'}, se déclarant habilité(e) à cet effet en qualité de ${champs.mandantQualite || '…'}.` +
            (champs.mandantTelephone ? ` Téléphone : ${champs.mandantTelephone}.` : '') +
            (champs.mandantEmail ? ` Adresse électronique : ${champs.mandantEmail}.` : '')
          : `${champs.mandantNom || '…'}${champs.mandantNaissance ? `, né(e) le ${champs.mandantNaissance}` : ''}${champs.mandantProfession ? `, exerçant la profession de ${champs.mandantProfession}` : ''}, demeurant ${champs.mandantAdresse || '…'}` +
            (champs.mandantSituation && champs.mandantSituation !== 'Célibataire'
              ? `, ${situationTexte(champs)}`
              : ', célibataire') +
            (champs.mandantResidentFiscal === 'Non'
              ? ', déclarant ne pas être résident français au sens de la réglementation fiscale'
              : ', déclarant être résident français au sens de la réglementation fiscale') +
            (champs.mandantTelephone ? `. Téléphone : ${champs.mandantTelephone}` : '') +
            (champs.mandantEmail ? `. Adresse électronique : ${champs.mandantEmail}` : '') + '.',
        champs.faculteSubstitution === 'Oui'
          ? 'Le MANDANT se réserve expressément la faculté de se substituer, pour l\u2019acquisition projetée, toute personne morale constituée ou à constituer dans laquelle il détiendrait une participation directe ou indirecte, sans que cette substitution n\u2019emporte novation ni ne le libère de ses obligations au titre du présent mandat.'
          : null,
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
      title: 'Objet du mandat',
      paragraphs: [
        exclusif
          ? "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT EXCLUSIF DE RECHERCHE d'un bien immobilier en vue de son acquisition, répondant à la désignation ci-après, aux prix, charges et conditions convenus."
          : semiExclusif
          ? "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT SEMI-EXCLUSIF DE RECHERCHE d'un bien immobilier en vue de son acquisition, répondant à la désignation ci-après : il s'interdit de confier cette recherche à un autre professionnel mais conserve la faculté de rechercher lui-même, sans intermédiaire, à charge d'en informer immédiatement le MANDATAIRE."
          : "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT SANS EXCLUSIVITÉ DE RECHERCHE d'un bien immobilier en vue de son acquisition, répondant à la désignation ci-après, aux prix, charges et conditions indiqués ci-après.",
      ],
    },
    {
      title: 'Désignation du bien recherché',
      paragraphs: [
        champs.bienDescription || '…',
        champs.bienAdresseCible ? `Le MANDANT déclare avoir d'ores et déjà identifié, avec le concours du MANDATAIRE, le bien suivant, qui entre dans le champ du présent mandat : ${champs.bienAdresseCible}.` : null,
        champs.bienReference ? `Référence du dossier : ${champs.bienReference}.` : null,
      ].filter(Boolean),
    },
    {
      title: "Prix d'acquisition maximum",
      paragraphs: [
        `Le prix d'acquisition du bien recherché ne pourra excéder la somme de ${enLettres(prixMax)} euros (${prixMax.toLocaleString('fr-FR')} €), ${regime}${chargeAcquereur ? ", honoraires du MANDATAIRE non compris" : ''}.`,
        "Ce montant constitue un plafond fixé par le MANDANT après échanges avec le MANDATAIRE sur l'état du marché et les prix pratiqués pour des biens comparables ; toute offre d'un montant supérieur requerra l'accord exprès et préalable du MANDANT.",
      ],
    },
    {
      title: 'Honoraires du mandataire',
      paragraphs: [
        `En cas de réalisation de l'opération, c'est-à-dire en cas d'acquisition, par le MANDANT ou par toute personne qu'il se serait substituée, d'un bien présenté par le MANDATAIRE ou visité avec son concours, les honoraires du MANDATAIRE, ${honorairesTexte(champs)}, seront supportés par ${chargeAcquereur ? "le MANDANT (acquéreur)" : 'le VENDEUR'}.`,
        chargeAcquereur
          ? "Ces honoraires s'ajoutent au prix d'acquisition, dans lequel ils ne sont pas compris."
          : null,
        "Ils seront exigibles et payés le jour de la signature de l'acte authentique constatant la réalisation de l'opération ; le taux de TVA applicable sera celui en vigueur à la date de leur exigibilité. En cas de substitution du MANDANT par une personne morale, le substitué sera tenu solidairement avec elle au paiement des honoraires.",
      ].filter(Boolean),
    },
    {
      title: 'Durée du mandat',
      paragraphs: [
        `Le présent mandat, qui prend effet le jour de sa signature, est consenti pour une durée initiale de ${champs.dureeInitiale || '…'} mois.` +
          (champs.tacite === 'Tacite reconduction'
            ? ` À l'issue de cette période initiale, il se renouvellera par tacite reconduction par périodes de ${champs.taciteDuree || '…'} mois, sans que la durée totale du mandat ne puisse excéder ${champs.dureeMax || '…'} mois à compter de sa signature, terme auquel il prendra automatiquement fin.`
            : " À l'issue de cette période, il prendra automatiquement fin."),
        (exclusif || semiExclusif)
          ? "Il est rappelé que, passé un délai de trois mois à compter de sa signature, le mandat assorti d'une clause d'exclusivité ou d'une clause pénale, ou comportant une clause aux termes de laquelle des honoraires seront dus même si l'opération est conclue sans les soins de l'intermédiaire, peut être dénoncé à tout moment par chacune des parties, à charge pour celle qui entend y mettre fin d'en aviser l'autre quinze jours au moins à l'avance par lettre recommandée avec demande d'avis de réception, conformément au deuxième alinéa de l'article 78 du décret n° 72-678 du 20 juillet 1972."
          : "Passé un délai de trois mois à compter de sa signature, le mandat pourra être dénoncé à tout moment par chacune des parties, à charge pour celle qui entend y mettre fin d'en aviser l'autre quinze jours au moins à l'avance par lettre recommandée avec demande d'avis de réception, conformément au deuxième alinéa de l'article 78 du décret n° 72-678 du 20 juillet 1972.",
        "Le présent mandat ne peut être dénoncé que dans sa totalité et en aucun cas de façon partielle.",
      ],
    },
    estParticulier && champs.tacite === 'Tacite reconduction'
      ? {
          title: 'Reconduction tacite — information du consommateur',
          paragraphs: [
            "Le MANDANT, consommateur au sens du Code de la consommation, est informé des dispositions suivantes, reproduites conformément à la loi :",
            "Article L. 215-1 du Code de la consommation : « Pour les contrats de prestations de services conclus pour une durée déterminée avec une clause de reconduction tacite, le professionnel prestataire de services informe le consommateur par écrit, par lettre nominative ou courrier électronique dédiés, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu'il a conclu avec une clause de reconduction tacite. Cette information, délivrée dans des termes clairs et compréhensibles, mentionne, dans un encadré apparent, la date limite de non-reconduction. Lorsque cette information ne lui a pas été adressée conformément aux dispositions du premier alinéa, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction. Les avances effectuées après la dernière date de reconduction ou, s'agissant des contrats à durée indéterminée, après la date de transformation du contrat initial à durée déterminée, sont dans ce cas remboursées dans un délai de trente jours à compter de la date de résiliation, déduction faite des sommes correspondant, jusqu'à celle-ci, à l'exécution du contrat. Les dispositions du présent article s'appliquent sans préjudice de celles qui soumettent légalement certains contrats à des règles particulières en ce qui concerne l'information du consommateur. »",
            "Article L. 215-2 du Code de la consommation : « Les dispositions du présent chapitre ne sont pas applicables aux exploitants des services d'eau potable et d'assainissement. »",
            "Article L. 215-3 du Code de la consommation : « Les dispositions du présent chapitre sont également applicables aux contrats conclus entre des professionnels et des non-professionnels. »",
            "Article L. 241-3 du Code de la consommation : « Lorsque le professionnel n'a pas procédé au remboursement dans les conditions prévues à l'article L. 215-1, les sommes dues sont productives d'intérêts au taux légal. »",
          ],
        }
      : null,
    {
      title: 'Déclarations et engagements du mandant',
      paragraphs: [
        "Le MANDANT s'engage à exécuter le présent mandat de bonne foi.",
        "Le MANDANT déclare, sous sa propre responsabilité : avoir la capacité juridique d'acquérir le bien recherché et ne faire l'objet d'aucune mesure restreignant sa capacité à agir (tutelle, curatelle…) ; disposer, ou être en mesure de réunir, les fonds nécessaires à l'acquisition projetée.",
        "Le MANDANT déclare n'avoir fait l'objet d'aucune condamnation définitive emportant la peine complémentaire d'interdiction d'acheter un bien immobilier prévue par les articles 225-19 du Code pénal, L. 511-6 du Code de la construction et de l'habitation et L. 1337-4 du Code de la santé publique.",
        "Le MANDANT s'engage à communiquer au MANDATAIRE, dans les meilleurs délais et au plus tard dans les huit (8) jours de sa demande, toute pièce ou information nécessaire à l'exécution du mandat (justificatifs d'identité et, le cas échéant, de la personne morale substituée, attestation de capacité de financement…), à l'informer de tout élément nouveau susceptible de modifier les conditions de la recherche, et à se prononcer sur tout bien présenté par le MANDATAIRE dans un délai maximum de huit (8) jours.",
        "Le MANDANT accepte expressément que le MANDATAIRE lui adresse toute information, proposition ou projet d'acte par lettres recommandées électroniques avec accusé de réception aux adresses indiquées en tête des présentes, conformément à l'article 1126 du Code civil et à l'article L.100 du Code des postes et des communications électroniques. Il reconnaît avoir été informé que ces lettres seront envoyées par l'intermédiaire d'un tiers de confiance agréé et qu'il lui appartient de vérifier son dossier de courriers indésirables. Il garantit disposer de la maîtrise exclusive du compte e-mail indiqué et accepte que toute action effectuée au travers de ce compte soit réputée effectuée par lui.",
      ],
    },
    {
      title: exclusif ? 'Conditions particulières — exclusivité consentie par le mandant' : 'Interdictions et obligations du mandant',
      paragraphs: [
        exclusif
          ? "Pendant toute la durée du présent mandat, le MANDANT s'interdit : de confier la recherche d'un bien répondant à la désignation ci-dessus à un autre professionnel ; de rechercher, visiter ou négocier directement, sans le concours du MANDATAIRE, un tel bien ; et s'engage à transmettre sans délai au MANDATAIRE toute proposition, offre ou mise en relation qui lui parviendrait directement, afin que celui-ci poursuive la négociation."
          : semiExclusif
          ? "Pendant toute la durée du présent mandat, le MANDANT s'interdit de confier la recherche d'un bien répondant à la désignation ci-dessus à un autre professionnel. Il conserve la faculté de mener personnellement sa recherche, à charge d'informer immédiatement le MANDATAIRE de toute négociation engagée sans son concours."
          : "Le MANDANT s'engage à informer le MANDATAIRE de toute acquisition réalisée pendant la durée du mandat, y compris sans son concours, cette information mettant fin au présent mandat.",
        "PENDANT TOUTE LA DURÉE DU PRÉSENT MANDAT ET PENDANT LES DOUZE (12) MOIS SUIVANT SON EXPIRATION OU SA RÉVOCATION, LE MANDANT S'INTERDIT DE TRAITER, DIRECTEMENT OU INDIRECTEMENT, Y COMPRIS PAR PERSONNE MORALE INTERPOSÉE, AVEC UN VENDEUR DONT LE BIEN LUI AURA ÉTÉ PRÉSENTÉ PAR LE MANDATAIRE OU VISITÉ AVEC SON CONCOURS, SANS L'INTERMÉDIAIRE DE CE DERNIER. EN CAS DE MANQUEMENT À CETTE INTERDICTION, LE MANDANT S'OBLIGE EXPRESSÉMENT À VERSER AU MANDATAIRE UNE INDEMNITÉ FORFAITAIRE ET DÉFINITIVE D'UN MONTANT ÉGAL À CELUI DES HONORAIRES, TOUTES TAXES COMPRISES, QUI AURAIENT ÉTÉ DUS EN APPLICATION DU PRÉSENT MANDAT.",
      ],
    },
    {
      title: 'Exécution du mandat — pouvoirs du mandataire',
      paragraphs: [
        "Pour l'exécution de sa mission, le MANDANT autorise le MANDATAIRE : à rechercher, sélectionner et lui présenter tout bien répondant à la désignation ci-dessus ; à organiser les visites et à se faire communiquer, auprès de toute personne publique ou privée, les pièces et renseignements concernant les biens présentés (titres, baux, états locatifs, diagnostics, urbanisme…) ; à négocier avec tout vendeur ou son conseil aux conditions du présent mandat ; à établir tout acte sous seing privé (offre d'achat, promesse ou compromis de vente) aux clauses et conditions nécessaires à l'accomplissement des présentes.",
        `En cas de signature d'un avant-contrat, le dépôt de garantie, qui sera versé entre les mains du notaire ou du séquestre désigné, ne pourra excéder ${champs.depotGarantiePct ? String(champs.depotGarantiePct).replace('.', ',') : '10'} % du prix d'acquisition.`,
        "Le MANDATAIRE pourra déléguer tout ou partie du présent mandat à tout professionnel titulaire de la carte professionnelle « Transaction sur immeubles et fonds de commerce », et s'adjoindre le concours de tout sachant (géomètre, diagnostiqueur, avocat, notaire…), en demeurant seul interlocuteur du MANDANT.",
        champs.notaireMandant
          ? `Le MANDANT déclare vouloir confier ses intérêts, pour la rédaction des actes, à ${champs.notaireMandant}.`
          : null,
      ].filter(Boolean),
    },
    {
      title: 'Reddition des comptes',
      paragraphs: [
        "Conformément à l'article 1993 du Code civil, le MANDATAIRE rendra compte au MANDANT de l'exécution de sa mission : il l'informera régulièrement des recherches engagées, des biens identifiés et des suites données à chaque présentation ou visite.",
      ],
    },
    {
      title: 'Démarchage téléphonique',
      paragraphs: [
        "Le MANDANT est informé qu'il dispose du droit de s'inscrire gratuitement sur la liste d'opposition au démarchage téléphonique Bloctel (www.bloctel.gouv.fr). Il est toutefois rappelé que cette inscription ne fait pas obstacle aux appels passés dans le cadre de l'exécution d'un contrat en cours, tel que le présent mandat.",
      ],
    },
    estParticulier
      ? {
          title: 'Médiation de la consommation — information précontractuelle',
          paragraphs: [
            "Le MANDANT reconnaît avoir reçu du MANDATAIRE, préalablement à la signature des présentes, l'ensemble des informations précontractuelles prévues aux articles L. 111-1 et suivants du Code de la consommation, notamment les caractéristiques essentielles de la prestation, son prix et les conditions de son exécution.",
            `Conformément aux articles L. 611-1 et suivants et R. 612-1 et suivants du Code de la consommation, le MANDANT peut, en cas de litige non résolu directement avec le MANDATAIRE, recourir gratuitement au médiateur de la consommation dont relève le MANDATAIRE${champs.mediateurNom ? ` : ${champs.mediateurNom}${champs.mediateurCoordonnees ? ` (${champs.mediateurCoordonnees})` : ''}` : ''}. La saisine du médiateur doit intervenir dans le délai d'un an à compter de la réclamation écrite adressée au MANDATAIRE.`,
          ],
        }
      : null,
    {
      title: 'Collecte et exploitation des données personnelles',
      paragraphs: [
        "Le MANDANT est informé que les données à caractère personnel le concernant, collectées par le MANDATAIRE à l'occasion des présentes, font l'objet de traitements informatiques nécessaires à leur exécution, fondés sur le présent contrat, le respect d'obligations légales ou la poursuite d'intérêts légitimes. Elles sont conservées pendant la durée d'exécution du contrat, augmentée des délais légaux de prescription. Elles peuvent être transmises, à des fins exclusivement techniques, à des prestataires informatiques assurant leur traitement, hébergement et archivage, ainsi qu'aux intervenants participant à la réalisation de l'opération (notaires, diagnostiqueurs, prestataires de signature électronique et de LRE, professionnels intervenant au titre d'une délégation de mandat), et peuvent être utilisées pour la gestion des fichiers prospects et clients, la prospection, ainsi que dans le cadre de la lutte contre le blanchiment de capitaux et le financement du terrorisme.",
        "Le MANDANT dispose des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de ses données, exerçables par courriel ou courrier auprès du MANDATAIRE à l'adresse indiquée en tête des présentes. Toute réclamation peut être introduite auprès de la CNIL (www.cnil.fr).",
      ],
    },
    {
      title: 'Élection de domicile',
      paragraphs: [
        'Les parties soussignées font élection de domicile chacune à leur adresse respective stipulée en tête du présent mandat.',
      ],
    },
    {
      title: 'Date et signatures',
      paragraphs: [
        `Fait à ${champs.lieuSignature || "dans les locaux de l'Agence"} et signé par l'ensemble des Parties, chacune d'elles en conservant un exemplaire original sur un support durable garantissant l'intégrité de l'acte.`,
      ],
    },
  ].filter(Boolean);

  return sections;
}

function situationTexte(champs) {
  const s = champs.mandantSituation || '';
  if (s.startsWith('Marié')) {
    const regime =
      s.includes('universelle') ? 'de la communauté universelle'
      : s.includes('séparation') ? 'de la séparation de biens'
      : 'de la communauté réduite aux acquêts';
    return `marié(e)${champs.mandantConjoint ? ` avec ${champs.mandantConjoint}` : ''} sous le régime ${regime}`;
  }
  if (s === 'Pacsé(e)') return 'lié(e) par un pacte civil de solidarité';
  if (s === 'Divorcé(e)') return 'divorcé(e)';
  if (s === 'Veuf(ve)') return 'veuf(ve)';
  return 'célibataire';
}

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit (avocat, notaire ou votre organisation professionnelle) avant toute signature.";
