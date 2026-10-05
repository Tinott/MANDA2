// Mandat de vente — version enrichie, calquée sur la structure des mandats
// professionnels réels (simple / semi-exclusif / exclusif) : identification
// complète des parties (dont agent commercial), désignation avec cadastre et
// état locatif, prix en lettres et chiffres, honoraires HT/TVA/TTC, durée et
// dénonciation (art. 78 décret du 20/07/1972), clauses d'interdiction avec
// indemnité, LRE, actions commerciales, reddition des comptes,
// non-discrimination, RGPD, élection de domicile.
// Le texte reste reformulé (même substance, mots propres) et marqué brouillon
// tant qu'il n'a pas été validé par un professionnel du droit.

export function enLettres(n) {
  // Conversion simplifiée nombre → lettres (euros), suffisante pour des prix.
  const u = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const d = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  function below100(x) {
    if (x < 20) return u[x];
    const dz = Math.floor(x / 10), un = x % 10;
    if (dz === 7 || dz === 9) return d[dz] + (un === 1 && dz === 7 ? ' et ' : '-') + u[10 + un];
    let s = d[dz];
    if (un === 1 && dz !== 8) s += ' et un';
    else if (un) s += '-' + u[un];
    else if (dz === 8) s += 's';
    return s;
  }
  function below1000(x) {
    const c = Math.floor(x / 100), r = x % 100;
    let s = '';
    if (c) s = (c > 1 ? u[c] + ' ' : '') + 'cent' + (c > 1 && !r ? 's' : '');
    if (r) s += (s ? ' ' : '') + below100(r);
    return s;
  }
  n = Math.round(Number(n) || 0);
  if (!n) return 'zéro';
  const millions = Math.floor(n / 1e6), milliers = Math.floor((n % 1e6) / 1000), reste = n % 1000;
  let s = '';
  if (millions) s += (millions > 1 ? below1000(millions) + ' millions' : 'un million');
  // « cent » et « vingt » perdent leur s lorsqu'ils sont suivis de « mille »
  // (deux cent mille, quatre-vingt mille) — mais le gardent devant « millions ».
  if (milliers) s += (s ? ' ' : '') + (milliers > 1 ? below1000(milliers).replace(/(cent|vingt)s$/, '$1') + ' ' : '') + 'mille';
  if (reste) s += (s ? ' ' : '') + below1000(reste);
  return s;
}

export const FIELDS = [
  // --- Mandant ---
  { id: 'mandantType', section: 'Mandant', label: 'Le mandant est', type: 'select', options: ['Une personne physique', 'Une société'], default: 'Une société' },
  { id: 'mandantNom', section: 'Mandant', label: 'Nom / Raison sociale', type: 'text', required: true },
  { id: 'mandantForme', section: 'Mandant', label: 'Forme sociale (SNC, SAS, SCI…)', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantCapital', section: 'Mandant', label: 'Capital social (€)', type: 'number', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantAdresse', section: 'Mandant', label: 'Adresse / Siège social', type: 'text', required: true },
  { id: 'mandantRcs', section: 'Mandant', label: 'RCS (ville et numéro)', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantRepresentant', section: 'Mandant', label: 'Représenté par', type: 'text', showIf: (c) => c.mandantType === 'Une société' },
  { id: 'mandantQualite', section: 'Mandant', label: 'En qualité de', type: 'text', showIf: (c) => c.mandantType === 'Une société', placeholder: 'Gérant, Responsable Immobilier…' },
  { id: 'mandantTelephone', section: 'Mandant', label: 'Téléphone', type: 'text' },
  { id: 'mandantEmail', section: 'Mandant', label: 'Adresse électronique', type: 'text' },

  // --- Mandataire (complément agence) ---
  { id: 'agentCommercialNom', section: 'Mandataire', label: 'Agent commercial signataire (facultatif)', type: 'text', placeholder: 'Prénom NOM' },
  { id: 'agentCommercialRsac', section: 'Mandataire', label: 'N° RSAC de l’agent', type: 'text', showIf: (c) => Boolean(c.agentCommercialNom) },
  { id: 'garantieCaisse', section: 'Mandataire', label: 'Caisse de garantie (nom, adresse, n°)', type: 'text', placeholder: 'GALIAN SMABTP, 89 rue de la Boétie 75008 Paris, n° …' },
  { id: 'assuranceRcp', section: 'Mandataire', label: 'Assurance RCP (compagnie, adresse, n° police)', type: 'text' },
  { id: 'tvaIntra', section: 'Mandataire', label: 'N° TVA intracommunautaire', type: 'text' },

  // --- Bien ---
  { id: 'bienAdresse', section: 'Bien', label: 'Adresse des biens', type: 'text', required: true },
  { id: 'bienDescription', section: 'Bien', label: 'Description (surfaces, enseignes, baux…)', type: 'textarea' },
  { id: 'bienCadastre', section: 'Bien', label: 'Cadastre (une parcelle par ligne : Préfixe ; Section ; Numéro ; Lieudit ; Contenance)', type: 'textarea', placeholder: '000 ; AM ; 622 ; LESCAR ; 98a 5ca' },
  { id: 'bienContenanceTotale', section: 'Bien', label: 'Contenance totale', type: 'text', placeholder: '1ha 26a' },
  { id: 'bienOccupation', section: 'Bien', label: "État d'occupation", type: 'select', options: ['Libre', 'Loué', 'Occupé par le mandant'], default: 'Loué' },
  { id: 'bienOccupationDetail', section: 'Bien', label: "Détail de l'occupation (locataire, bail, loyer annuel)", type: 'textarea', showIf: (c) => c.bienOccupation === 'Loué' },
  { id: 'bienDpe', section: 'Bien', label: 'DPE disponible', type: 'select', options: ['Oui', 'Non — à établir'], default: 'Non — à établir' },

  // --- Prix et honoraires ---
  { id: 'prixVente', section: 'Prix et honoraires', label: 'Prix de présentation (€)', type: 'number', required: true },
  { id: 'honorairesType', section: 'Prix et honoraires', label: 'Honoraires', type: 'select', options: ['Pourcentage du prix', 'Forfait'], default: 'Forfait' },
  { id: 'honorairesTaux', section: 'Prix et honoraires', label: 'Taux (% TTC du prix hors honoraires)', type: 'number', showIf: (c) => c.honorairesType === 'Pourcentage du prix' },
  { id: 'honorairesForfaitHT', section: 'Prix et honoraires', label: 'Montant forfaitaire HT (€)', type: 'number', showIf: (c) => c.honorairesType === 'Forfait' },
  { id: 'tauxTva', section: 'Prix et honoraires', label: 'Taux de TVA (%)', type: 'number', default: 20 },
  { id: 'honorairesCharge', section: 'Prix et honoraires', label: 'Honoraires à la charge de', type: 'select', options: ['Vendeur', 'Acquéreur'], default: 'Vendeur' },

  // --- Durée ---
  { id: 'dureeInitiale', section: 'Durée', label: 'Durée initiale (mois)', type: 'number', default: 3 },
  { id: 'prorogation', section: 'Durée', label: 'À l’issue de la période initiale', type: 'select', options: ['Fin automatique', 'Prorogation unique', 'Tacite reconduction'], default: 'Prorogation unique' },
  { id: 'prorogationDuree', section: 'Durée', label: 'Durée de la prorogation / des périodes (mois)', type: 'number', default: 3, showIf: (c) => c.prorogation !== 'Fin automatique' },
  { id: 'dureeMax', section: 'Durée', label: 'Durée totale maximale (mois)', type: 'number', default: 12, showIf: (c) => c.prorogation === 'Tacite reconduction' },

  // --- Divers ---
  { id: 'mandatSignaturePromesse', section: 'Divers', label: 'Autoriser le mandataire à signer la promesse au nom du mandant (exclusif)', type: 'select', options: ['Non', 'Oui'], default: 'Non' },
  { id: 'notaireMandant', section: 'Divers', label: 'Notaire du mandant', type: 'text', placeholder: 'Maître …, notaire à …' },
  { id: 'actionsCommerciales', section: 'Divers', label: 'Actions commerciales à la charge du mandataire', type: 'textarea', default: 'Réaliser un dossier de présentation des biens (IM).' },
  { id: 'redditionModalites', section: 'Divers', label: 'Reddition des comptes — modalités et périodicité', type: 'text', default: 'Un compte-rendu après chaque visite, mentionnant les observations des prospects.' },
  { id: 'lieuSignature', section: 'Divers', label: 'Fait à', type: 'text', default: 'dans les locaux de l’Agence' },
];

function honorairesTexte(c) {
  const tva = Number(c.tauxTva) || 20;
  if (c.honorairesType === 'Forfait') {
    const ht = Number(c.honorairesForfaitHT) || 0;
    const ttc = Math.round(ht * (1 + tva / 100));
    return `d'un montant de ${enLettres(ttc)} euros TTC (${ttc.toLocaleString('fr-FR')} € TTC), soit ${ht.toLocaleString('fr-FR')} € HT majorés de ${tva} % de TVA`;
  }
  return `fixée à ${c.honorairesTaux || '…'} % TTC du prix de vente hors honoraires`;
}

export function buildSections(champs, variante) {
  const exclusif = variante === 'Exclusif';
  const semiExclusif = variante === 'Semi-exclusif';
  const estSociete = champs.mandantType === 'Une société';
  const prix = Number(champs.prixVente) || 0;

  const cadastre = (champs.bienCadastre || '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const [prefixe, section, numero, lieudit, contenance] = l.split(';').map((x) => (x || '').trim());
      return `Préfixe ${prefixe || '—'} · Section ${section || '—'} · N° ${numero || '—'} · Lieudit ${lieudit || '—'} · Contenance ${contenance || '—'}`;
    });

  const sections = [
    {
      title: 'Entre les soussignés',
      paragraphs: [
        estSociete
          ? `La Société ${champs.mandantNom || '…'}${champs.mandantForme ? `, ${champs.mandantForme}` : ''}${champs.mandantCapital ? ` au capital social de ${Number(champs.mandantCapital).toLocaleString('fr-FR')} euros` : ''}, dont le siège social est situé ${champs.mandantAdresse || '…'}${champs.mandantRcs ? `, immatriculée au RCS ${champs.mandantRcs}` : ''}, représentée par ${champs.mandantRepresentant || '…'}, se déclarant habilité(e) à cet effet en qualité de ${champs.mandantQualite || '…'}.` +
            (champs.mandantTelephone ? ` Téléphone : ${champs.mandantTelephone}.` : '') +
            (champs.mandantEmail ? ` Adresse électronique : ${champs.mandantEmail}.` : '')
          : `${champs.mandantNom || '…'}, demeurant ${champs.mandantAdresse || '…'}` +
            (champs.mandantTelephone ? `, téléphone ${champs.mandantTelephone}` : '') +
            (champs.mandantEmail ? `, adresse électronique ${champs.mandantEmail}` : '') + '.',
        'Ci-après « le MANDANT », d\'une part,',
        `La société ${champs._agenceRaisonSociale || '…'}, dont le siège social est situé ${champs._agenceAdresse || '…'}, titulaire de la carte professionnelle « Transaction sur immeubles et fonds de commerce » n° ${champs._agenceCpi || '…'}${champs.tvaIntra ? `, n° de TVA ${champs.tvaIntra}` : ''}${champs.assuranceRcp ? `, assurée en responsabilité civile professionnelle auprès de ${champs.assuranceRcp}` : champs._agenceRcp ? `, garantie/RCP : ${champs._agenceRcp}` : ''}${champs.garantieCaisse ? `, adhérente de la caisse de garantie ${champs.garantieCaisse}` : ''}.`,
        "DÉCLARANT NE POUVOIR NI RECEVOIR NI DÉTENIR D'AUTRES FONDS, EFFETS OU VALEURS QUE CEUX REPRÉSENTATIFS DE SA RÉMUNÉRATION.",
        champs.agentCommercialNom
          ? `Représentée par ${champs.agentCommercialNom}, entrepreneur individuel agissant en qualité d'agent commercial, régulièrement inscrit au Registre spécial des agents commerciaux sous le numéro ${champs.agentCommercialRsac || '…'}, ayant tous pouvoirs à l'effet des présentes.`
          : null,
        'Ci-après « l\'Agence » ou « le MANDATAIRE », d\'autre part.',
      ].filter(Boolean),
    },
    {
      title: 'Objet du mandat',
      paragraphs: [
        exclusif
          ? "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT EXCLUSIF de rechercher un acquéreur pour les biens ci-après désignés, aux prix, charges et conditions convenus."
          : semiExclusif
          ? "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT SEMI-EXCLUSIF de rechercher un acquéreur pour les biens ci-après désignés : il s'interdit de confier la vente à un autre professionnel mais conserve la faculté de vendre lui-même sans intermédiaire, à charge d'en informer immédiatement le MANDATAIRE."
          : "Par les présentes, le MANDANT confère au MANDATAIRE, qui l'accepte, un MANDAT SANS EXCLUSIVITÉ de rechercher un acquéreur pour les biens dont il est propriétaire et désignés ci-après, aux prix, charges et conditions indiqués ci-après.",
      ],
    },
    {
      title: 'Désignation des biens à vendre',
      paragraphs: [
        `Adresse des biens : ${champs.bienAdresse || '…'}.`,
        champs.bienDescription || null,
        cadastre.length ? 'Cet ensemble immobilier est édifié sur les parcelles de terrain cadastrées suivantes :' : null,
        ...cadastre,
        champs.bienContenanceTotale ? `Contenance totale : ${champs.bienContenanceTotale}.` : null,
        champs.bienOccupation === 'Loué'
          ? `État d'occupation — le MANDANT déclare que les biens sont actuellement loués dans les conditions suivantes : ${champs.bienOccupationDetail || '…'}. Les biens seront vendus occupés, sous réserve que le ou les locataires ne délivrent pas de congé.`
          : `État d'occupation : ${champs.bienOccupation || '…'}.`,
        champs.bienDpe === 'Non — à établir'
          ? "Le MANDANT déclare ne pas disposer d'un Diagnostic de performance énergétique pour le bien ; un DPE conforme à la réglementation applicable sera établi."
          : null,
      ].filter(Boolean),
    },
    {
      title: 'Prix de vente — Honoraires du mandataire',
      paragraphs: [
        `1. Prix de vente des biens — Les biens devront être présentés au prix de ${enLettres(prix)} euros (${prix.toLocaleString('fr-FR')} €). Le prix sera réglé comptant au plus tard le jour de la signature de l'acte définitif de vente.`,
        "Le prix de mise en vente a été fixé par le MANDANT après avoir pris connaissance de l'estimation réalisée par le MANDATAIRE à partir de sa connaissance du marché local et des prix pratiqués pour des biens aux caractéristiques similaires. Ce prix s'entend TTC de la TVA immobilière en vigueur, à la charge du MANDANT si elle est due. Le MANDANT est informé qu'il pourra, le cas échéant, être assujetti à l'impôt sur les plus-values immobilières.",
        `2. Honoraires du MANDATAIRE — En cas de réalisation de l'opération, les honoraires du MANDATAIRE, ${honorairesTexte(champs)}, seront supportés par ${champs.honorairesCharge === 'Vendeur' ? 'le MANDANT (vendeur)' : "l'ACQUÉREUR"}.`,
        "Ces honoraires seront payés le jour de la signature de l'acte authentique de vente ; le taux de TVA applicable sera celui en vigueur à la date de leur exigibilité. En cas d'exercice d'un droit de préemption ou d'une faculté de substitution, le bénéficiaire sera subrogé dans tous les droits et obligations de l'acquéreur et tenu, le cas échéant, au règlement des honoraires si leur paiement lui incombe.",
      ],
    },
    {
      title: 'Durée du mandat',
      paragraphs: [
        `Le présent mandat, qui prend effet le jour de sa signature, est consenti pour une durée de ${champs.dureeInitiale || '…'} mois.` +
          (champs.prorogation === 'Prorogation unique'
            ? ` À l'issue de cette période initiale, il sera prorogé pour une durée de ${champs.prorogationDuree || '…'} mois, au terme de laquelle il prendra automatiquement fin.`
            : champs.prorogation === 'Tacite reconduction'
            ? ` À l'issue de sa durée initiale, il se renouvellera par tacite reconduction par périodes de ${champs.prorogationDuree || '…'} mois, sans que la durée totale du mandat ne puisse excéder ${champs.dureeMax || '…'} mois à compter de sa signature.`
            : " À l'issue de cette période, il prendra automatiquement fin."),
        (exclusif || semiExclusif)
          ? "Il est rappelé que, passé un délai de trois mois à compter de sa signature, le mandat assorti d'une clause d'exclusivité ou d'une clause pénale, ou comportant une clause aux termes de laquelle des honoraires seront dus même si l'opération est conclue sans les soins de l'intermédiaire, peut être dénoncé à tout moment par chacune des parties, à charge pour celle qui entend y mettre fin d'en aviser l'autre quinze jours au moins à l'avance par lettre recommandée avec demande d'avis de réception, conformément au deuxième alinéa de l'article 78 du décret n° 72-678 du 20 juillet 1972."
          : "Passé un délai de trois mois à compter de sa signature, le mandat pourra être dénoncé à tout moment par chacune des parties, à charge pour celle qui entend y mettre fin d'en aviser l'autre quinze jours au moins à l'avance par lettre recommandée avec demande d'avis de réception, conformément au deuxième alinéa de l'article 78 du décret n° 72-678 du 20 juillet 1972.",
        "Le présent mandat ne peut être dénoncé que dans sa totalité et en aucun cas de façon partielle. Par dérogation à l'article 2003 du Code civil, le décès du MANDANT n'entraînera pas la résiliation du mandat, lequel se poursuivra avec ses ayants droit.",
      ],
    },
    {
      title: 'Conditions générales du mandat concernant le mandant',
      paragraphs: [
        "Le MANDANT s'engage à exécuter le présent mandat de bonne foi.",
        "Le MANDANT déclare, sous sa propre responsabilité : avoir la capacité juridique de disposer desdits biens et ne faire l'objet d'aucune mesure restreignant sa capacité à agir (tutelle, curatelle…) ; que les biens objets du présent mandat sont librement cessibles et ne font l'objet d'aucune procédure de saisie immobilière.",
        "Le MANDANT s'engage à remettre au MANDATAIRE, dans les meilleurs délais et au plus tard dans les huit (8) jours de la signature des présentes, l'ensemble des documents nécessaires à l'exécution du mandat (titre de propriété, diagnostics, certificats et justificatifs obligatoires), à l'informer de tout élément nouveau susceptible de modifier les conditions de la vente, et à répondre à toute offre d'achat transmise par le MANDATAIRE dans un délai maximum de huit (8) jours.",
        exclusif && champs.mandatSignaturePromesse === 'Oui'
          ? "Le MANDANT s'engage à vendre les biens à tout acquéreur présenté par le MANDATAIRE aux prix, charges et conditions du présent mandat, la vente pouvant être assortie d'une condition suspensive d'obtention de prêt. Le MANDANT autorise expressément le MANDATAIRE à établir et à signer, en son nom et pour son compte, toute promesse de vente aux prix et conditions nécessaires à l'accomplissement des présentes et à recueillir la signature de l'acquéreur. Le MANDATAIRE s'oblige, dans ce cas, à communiquer préalablement au MANDANT, pour information, le projet de compromis ou de promesse unilatérale de vente par lettre recommandée avec demande d'avis de réception ou par envoi recommandé électronique."
          : null,
        "Le MANDANT autorise le MANDATAIRE : à entreprendre toutes actions de communication qu'il jugera utiles et, dans ce cadre, à diffuser des photographies et/ou vidéos des biens ; à réclamer auprès de toute personne publique ou privée les pièces justificatives concernant les biens ; à présenter et faire visiter les biens, étant précisé et accepté que le MANDATAIRE ne pourra en aucun cas être considéré comme gardien juridique des biens ; à établir tout acte sous seing privé aux clauses et conditions nécessaires à l'accomplissement des présentes et à recueillir la signature de l'acquéreur ; en cas d'exercice d'un droit de préemption, à négocier avec le bénéficiaire de ce droit.",
        "Le MANDANT accepte expressément que le MANDATAIRE lui adresse des offres d'achat par lettres recommandées électroniques avec accusé de réception aux adresses indiquées en tête des présentes, conformément à l'article 1126 du Code civil et à l'article L.100 du Code des postes et des communications électroniques. Il reconnaît avoir été informé que ces lettres seront envoyées par l'intermédiaire d'un tiers de confiance agréé et qu'il lui appartient de vérifier son dossier de courriers indésirables. Il garantit disposer de la maîtrise exclusive du compte e-mail indiqué et accepte que toute action effectuée au travers de ce compte soit réputée effectuée par lui.",
      ].filter(Boolean),
    },
    {
      title: exclusif ? "Conditions particulières — exclusivité consentie par le mandant" : 'Interdictions et obligations du mandant',
      paragraphs: [
        exclusif
          ? "Le MANDANT déclare ne pas avoir déjà consenti de mandat de vente non expiré ou dénoncé et s'interdit d'en consentir un sans avoir préalablement dénoncé le présent mandat. Pendant toute la durée du mandat, il s'engage à transmettre sans délai au MANDATAIRE toutes les demandes qui lui seraient faites personnellement."
          : "S'il consent un mandat de vente portant sur les biens à un autre intermédiaire, le MANDANT s'engage à ce que le prix de vente affiché dans les publicités soit identique à celui prévu au présent mandat.",
        exclusif
          ? "Le MANDANT s'interdit : pendant la durée du mandat, de vendre les biens directement ou par l'intermédiaire d'un autre mandataire ; pendant la durée du présent mandat et durant les douze (12) mois suivant sa révocation ou son expiration, de traiter, directement ou indirectement, avec une personne à qui les biens auront été présentés par le MANDATAIRE (ou un mandataire substitué) et dont l'identité lui aura été communiquée — cette interdiction visant l'acheteur, son conjoint, concubin ou partenaire de PACS, ainsi que toute société dans laquelle il aurait la qualité d'associé."
          : "Le MANDANT s'interdit : pendant la durée du mandat, de négocier directement ou indirectement la vente des biens avec une personne présentée par le MANDATAIRE ; pendant la durée du présent mandat et durant les douze (12) mois suivant sa révocation ou son expiration, de traiter, directement ou indirectement, avec une personne à qui les biens auront été présentés par le MANDATAIRE et dont l'identité lui aura été communiquée — cette interdiction visant l'acheteur, son conjoint, concubin ou partenaire de PACS, ainsi que toute société dans laquelle il aurait la qualité d'associé.",
        "Le MANDANT s'interdit également de refuser de réaliser l'opération aux conditions convenues au présent mandat puis de conclure l'opération en privant le MANDATAIRE de la rémunération à laquelle il aurait pu légitimement prétendre. S'il vend les biens pendant la durée du mandat ou durant le délai de douze (12) mois suivant sa révocation ou son expiration, il s'oblige à communiquer immédiatement au MANDATAIRE la date et le prix de la vente, les nom et adresse de l'acquéreur et, le cas échéant, de l'intermédiaire ayant permis sa conclusion, ainsi que les coordonnées du notaire rédacteur de l'acte.",
        "EN CAS DE MANQUEMENT À L'UNE OU L'AUTRE DE CES INTERDICTIONS OU OBLIGATIONS, LE MANDANT S'OBLIGE EXPRESSÉMENT ET DE MANIÈRE IRRÉVOCABLE À VERSER AU MANDATAIRE UNE SOMME ÉGALE AU MONTANT TOTAL, TVA INCLUSE, DE LA RÉMUNÉRATION PRÉVUE AUX PRÉSENTES, À TITRE D'INDEMNITÉ FORFAITAIRE ET DÉFINITIVE.",
      ],
    },
    champs.notaireMandant ? {
      title: 'Acte authentique',
      paragraphs: [`Le notaire du MANDANT est ${champs.notaireMandant}.`],
    } : null,
    {
      title: "Actions commerciales que le mandataire s'engage à réaliser",
      paragraphs: [
        `Le MANDATAIRE s'engage à réaliser à ses frais les actions de communication suivantes : ${champs.actionsCommerciales || 'réaliser un dossier de présentation des biens.'}`,
      ],
    },
    {
      title: 'Reddition des comptes',
      paragraphs: [
        `Le MANDATAIRE s'engage à tenir le MANDANT informé du suivi de ses actions selon les modalités et la périodicité suivantes : ${champs.redditionModalites || 'un compte-rendu après chaque visite des biens, mentionnant les observations éventuelles des prospects.'}`,
      ],
    },
    {
      title: 'Engagement de non-discrimination',
      paragraphs: [
        "Constitue une discrimination toute distinction opérée entre les personnes sur le fondement, notamment, de leur origine, sexe, situation de famille, grossesse, apparence physique, particulière vulnérabilité économique, patronyme, lieu de résidence, état de santé, perte d'autonomie, handicap, caractéristiques génétiques, mœurs, orientation sexuelle, identité de genre, âge, opinions politiques, activités syndicales, qualité de lanceur d'alerte, capacité à s'exprimer dans une langue autre que le français, ou de leur appartenance ou non-appartenance, vraie ou supposée, à une ethnie, une Nation, une prétendue race ou une religion déterminée.",
        "Le MANDATAIRE informe le MANDANT que toute discrimination commise à l'égard d'une personne est punie pénalement. Les parties s'engagent expressément à n'opposer à aucun candidat à l'acquisition un refus fondé sur un motif discriminatoire, et le MANDANT s'interdit de donner au MANDATAIRE toute directive, verbale ou écrite, tendant à refuser la vente pour de tels motifs.",
      ],
    },
    {
      title: 'Collecte et exploitation des données personnelles',
      paragraphs: [
        "Le MANDANT est informé que les données à caractère personnel le concernant, collectées par le MANDATAIRE à l'occasion des présentes, font l'objet de traitements informatiques nécessaires à leur exécution, fondés sur le présent contrat, le respect d'obligations légales ou la poursuite d'intérêts légitimes. Elles sont conservées pendant la durée d'exécution du contrat, augmentée des délais légaux de prescription. Elles peuvent être transmises, à des fins exclusivement techniques, à des prestataires informatiques assurant leur traitement, hébergement et archivage, ainsi qu'aux intervenants participant à la réalisation de l'opération (notaires, diagnostiqueurs, prestataires de signature électronique et de LRE, professionnels intervenant au titre d'une délégation de mandat), et peuvent être utilisées pour la gestion des fichiers prospects et clients, la prospection, ainsi que dans le cadre de la lutte contre le blanchiment de capitaux et le financement du terrorisme.",
        `Le MANDANT dispose des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de ses données, exerçables par courriel ou courrier auprès du MANDATAIRE à l'adresse indiquée en tête des présentes. Toute réclamation peut être introduite auprès de la CNIL (www.cnil.fr).`,
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

export const DRAFT_NOTICE =
  "Document généré automatiquement à partir des informations saisies — brouillon à faire valider par un professionnel du droit (avocat, notaire ou votre organisation professionnelle) avant toute signature.";
