// Outils du Copilote — ce que l'IA peut FAIRE dans l'application, pas
// seulement dire. Chaque outil est déclaré (schéma lu par le modèle) et
// exécuté ici, dans le navigateur, sur les données de l'utilisateur
// connecté. Aucun outil ne supprime quoi que ce soit ; les envois d'emails
// se font toujours via le composer, après validation humaine.

import { calcHonoraires, nextInvoiceNumber, clientNumero, tvaMontant, formatEUR } from './calc';
import { uid } from './storage';
import { DEPENSE_CATEGORIES } from './seed';
import { matcherInvestisseurs, matcherBiens } from './matching';
import { CLASSES_ACTIFS, VEHICULES, STRATEGIES, STATUTS_RELATION, TYPES_INTERACTION, contactLabel, normalizeContact } from './contactsSchema';

const str = (d) => ({ type: 'string', description: d });
const num = (d) => ({ type: 'number', description: d });
const arr = (items, d) => ({ type: 'array', items, description: d });
const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });

export const TOOLS = [
  {
    name: 'lister_donnees',
    description: "Liste les enregistrements d'un module de l'application (complets, au-delà de l'instantané), avec un filtre texte optionnel. À utiliser avant de modifier un élément dont tu n'as pas l'identifiant.",
    input_schema: obj({
      type: { type: 'string', enum: ['mandats', 'promesses', 'factures', 'notesFrais', 'contacts', 'prospects', 'courriers', 'documents', 'dossiers'], description: 'Module à lister' },
      recherche: str('Texte à chercher dans les enregistrements (optionnel)'),
      limite: num('Nombre maximum (défaut 40)'),
    }, ['type']),
  },
  {
    name: 'rechercher_contacts',
    description: "Recherche des contacts par texte et/ou critères d'investisseur (classe d'actif, zone, ticket, statut).",
    input_schema: obj({
      texte: str('Nom, société, fonction, note…'),
      categorie: str('Catégorie (Investisseur, Propriétaire, Notaire…)'),
      classeActif: { type: 'string', enum: CLASSES_ACTIFS, description: "Classe d'actif recherchée par le contact" },
      zone: str('Zone géographique (ville, département, région)'),
      statutRelation: { type: 'string', enum: STATUTS_RELATION },
      aRelancer: { type: 'boolean', description: 'Seulement ceux dont la relance est due' },
    }),
  },
  {
    name: 'creer_contact',
    description: 'Crée un contact dans le carnet (investisseur, propriétaire, notaire…). Vérifie d’abord avec rechercher_contacts qu’il n’existe pas déjà.',
    input_schema: obj({
      societe: str('Société'), nom: str('Nom'), prenom: str('Prénom'), fonction: str('Fonction'), email: str('Email'), telephone: str('Téléphone'),
      adresse: str('Adresse'), linkedin: str('URL LinkedIn'), categorie: str('Catégorie : Investisseur, Propriétaire, Notaire, Banque, Avocat, Confrère, Promoteur, Locataire…'),
      vehicule: { type: 'string', enum: VEHICULES }, classesActifs: arr({ type: 'string', enum: CLASSES_ACTIFS }), zones: arr({ type: 'string' }, 'Villes, départements, régions ou « National »'),
      ticketMin: num('€'), ticketMax: num('€'), rendementCible: num('%'), strategie: { type: 'string', enum: STRATEGIES },
      patrimoine: str('Biens détenus (propriétaire)'), statutRelation: { type: 'string', enum: STATUTS_RELATION }, source: str('Origine du contact'),
      prochaineRelance: str('YYYY-MM-DD'), notes: str('Notes'),
    }),
  },
  {
    name: 'modifier_contact',
    description: 'Modifie un contact existant (identifiant ou nom/société). Ne fournis que les champs à changer.',
    input_schema: obj({
      contact: str('Identifiant, ou nom / société du contact'),
      modifications: obj({
        societe: str(''), nom: str(''), prenom: str(''), fonction: str(''), email: str(''), telephone: str(''), adresse: str(''), linkedin: str(''), categorie: str(''),
        vehicule: { type: 'string', enum: VEHICULES }, classesActifs: arr({ type: 'string', enum: CLASSES_ACTIFS }), zones: arr({ type: 'string' }),
        ticketMin: num(''), ticketMax: num(''), rendementCible: num(''), strategie: { type: 'string', enum: STRATEGIES },
        patrimoine: str(''), statutRelation: { type: 'string', enum: STATUTS_RELATION }, source: str(''), prochaineRelance: str('YYYY-MM-DD'), notes: str(''),
      }),
    }, ['contact', 'modifications']),
  },
  {
    name: 'ajouter_interaction',
    description: "Note un échange (appel, email, RDV, visite, envoi d'IM, offre) dans l'historique d'un contact, et programme éventuellement la prochaine relance.",
    input_schema: obj({
      contact: str('Identifiant, ou nom / société du contact'),
      type: { type: 'string', enum: TYPES_INTERACTION },
      note: str('Contenu de l’échange, suite à donner'),
      date: str('YYYY-MM-DD (défaut : aujourd’hui)'),
      prochaineRelance: str('YYYY-MM-DD (optionnel)'),
    }, ['contact', 'type', 'note']),
  },
  {
    name: 'matcher_investisseurs',
    description: "Rapproche les investisseurs du carnet d'un bien (mandat existant ou bien décrit) : score, raisons, coordonnées. Base de toute campagne de commercialisation.",
    input_schema: obj({
      mandatId: str('Identifiant du mandat (sinon décrire le bien)'),
      bien: obj({ typeBien: str('Bureaux, logistique, activité, commerce…'), adresse: str('Adresse / ville'), prix: num('€'), loyerAnnuel: num('€ HT/an'), description: str('') }),
      limite: num('Nombre de résultats (défaut 12)'),
    }),
  },
  {
    name: 'biens_pour_contact',
    description: 'Quels mandats en cours correspondent aux critères d’un contact investisseur.',
    input_schema: obj({ contact: str('Identifiant, ou nom / société') }, ['contact']),
  },
  {
    name: 'creer_prospect',
    description: "Ajoute une ligne au Suivi commercial (prospect sollicité sur un dossier) — à utiliser pour tracer un envoi d'IM, une relance, un retour, une offre.",
    input_schema: obj({
      prospect: str('Société / investisseur'), contact: str('Interlocuteur'), type: { type: 'string', enum: ['Foncière', 'Family Office', 'Privé', 'SCPI', 'Autre'] },
      dossierId: str('Identifiant du dossier (IM / dossier libre) si connu'), statut: { type: 'string', enum: ['À contacter', 'Envoyé', 'Relancé', 'Intéressé', 'Offre'] },
      niveauInteret: { type: 'string', enum: ['Faible', 'Moyen', 'Fort'] }, dateEnvoi: str('YYYY-MM-DD'), prochaineRelance: str('YYYY-MM-DD'),
      prochaineAction: str(''), retour: str('Retour du prospect'), prixPropose: num('€'),
    }, ['prospect']),
  },
  {
    name: 'modifier_prospect',
    description: 'Met à jour une ligne du Suivi commercial (statut, relance, retour, offre).',
    input_schema: obj({
      id: str('Identifiant du prospect (via lister_donnees)'),
      modifications: obj({ statut: str(''), niveauInteret: str(''), prochaineRelance: str('YYYY-MM-DD'), prochaineAction: str(''), retour: str(''), prixPropose: num(''), rendementPropose: num(''), dernierEchange: str('YYYY-MM-DD') }),
    }, ['id', 'modifications']),
  },
  {
    name: 'creer_mandat',
    description: 'Crée un mandat / bien dans le portefeuille.',
    input_schema: obj({
      adresse: str('Adresse du bien'), typeBien: str('Bureaux, Local commercial, Entrepôt…'), typeMandat: { type: 'string', enum: ['Vente', 'Location', 'Gestion', 'Recherche'] },
      client: str('Mandant'), prixVente: num('€'), loyerAnnuel: num('€ HT/an'), surface: num('m²'), dpe: str(''), dateDebutMandat: str('YYYY-MM-DD'), dateFinMandat: str('YYYY-MM-DD'), description: str(''),
    }, ['adresse']),
  },
  {
    name: 'modifier_mandat',
    description: 'Modifie un mandat existant.',
    input_schema: obj({ id: str('Identifiant'), modifications: obj({ adresse: str(''), typeBien: str(''), typeMandat: str(''), client: str(''), prixVente: num(''), loyerAnnuel: num(''), surface: num(''), statut: str(''), dateFinMandat: str(''), description: str('') }) }, ['id', 'modifications']),
  },
  {
    name: 'creer_promesse',
    description: 'Enregistre une promesse / un compromis de vente à suivre (dates, honoraires).',
    input_schema: obj({
      bienAdresse: str(''), vendeur: str(''), acquereur: str(''), prixVente: num('€'), honorairesHT: num('€ HT'), redevable: { type: 'string', enum: ['vendeur', 'acquereur'] },
      notaire: str(''), dateSignature: str('YYYY-MM-DD'), dateLimiteConditionsSuspensives: str('YYYY-MM-DD'), dateReiteration: str('YYYY-MM-DD'), dateProchaineRelance: str('YYYY-MM-DD'), depotGarantie: num('€'),
    }, ['bienAdresse']),
  },
  {
    name: 'modifier_promesse',
    description: 'Met à jour une promesse (dates, statut, honoraires).',
    input_schema: obj({ id: str('Identifiant'), modifications: obj({ statut: { type: 'string', enum: ['En cours', 'Conditions levées', 'Réitérée', 'Caduque'] }, dateLimiteConditionsSuspensives: str(''), dateReiteration: str(''), dateProchaineRelance: str(''), honorairesHT: num(''), notaire: str(''), acquereur: str(''), vendeur: str('') }) }, ['id', 'modifications']),
  },
  {
    name: 'calculer_honoraires',
    description: 'Calcule les honoraires selon le barème de l’agence pour un prix donné.',
    input_schema: obj({ prix: num('Prix de vente €') }, ['prix']),
  },
  {
    name: 'creer_facture_brouillon',
    description: 'Crée une facture d’honoraires en BROUILLON (numérotée, modifiable ensuite dans Facturation). Si les lignes ne sont pas données, calcule au barème à partir du prix.',
    input_schema: obj({
      client: str('Client facturé'), bienAdresse: str(''), mandatRef: str('Référence du mandat'), notaire: str(''), prixVente: num('Prix de vente pour calcul au barème'),
      lignes: arr(obj({ libelle: str(''), montantHT: num('€ HT, négatif pour une déduction') }), 'Lignes de facture'),
      tauxTva: num('Défaut : taux de l’agence'), redevable: str('vendeur / acquereur'), refTitre: str('Référence affichée'),
    }, ['client']),
  },
  {
    name: 'creer_note_de_frais',
    description: 'Enregistre une dépense / note de frais (TTC → HT et TVA calculés).',
    input_schema: obj({
      date: str('YYYY-MM-DD'), montantTTC: num('€ TTC'), tauxTva: num('20, 10, 5.5, 2.1 ou 0'), commercant: str('Commerçant / fournisseur'),
      categorie: { type: 'string', enum: DEPENSE_CATEGORIES.map((c) => c.id), description: DEPENSE_CATEGORIES.map((c) => `${c.id} = ${c.label}`).join(' ; ') },
    }, ['montantTTC']),
  },
  {
    name: 'preparer_email',
    description: "Ouvre le composer de la Boîte mail avec destinataires, objet et corps pré-remplis — l'utilisateur relit et envoie lui-même. Utilise les emails des contacts du carnet.",
    input_schema: obj({ to: arr({ type: 'string' }, 'Adresses email'), subject: str(''), body: str('Corps complet, prêt à envoyer, avec signature') }, ['to', 'subject', 'body']),
  },
  {
    name: 'preparer_im',
    description: "Ouvre l'assistant IM (mémorandum) pré-rempli avec les données du bien pour générer le PowerPoint.",
    input_schema: obj({
      mandatId: str('Identifiant du mandat (recommandé)'),
      bien: obj({ adresse: str(''), typeBien: str(''), prix: num(''), surface: num(''), loyerAnnuel: num(''), locataire: str(''), dureeBail: str('3/6/9'), indexation: str(''), dateEffetBail: str('YYYY-MM-DD'), activiteLocataire: str(''), description: str(''), environnement: str(''), prixRecommande: num(''), modaliteVente: str(''), honorairesPct: num('') }),
    }),
  },
  {
    name: 'generer_document',
    description: "Génère et télécharge un document juridique PDF (brouillon à valider) à partir des modèles de l'application : mandat de vente, mandat de recherche, offre d'achat, avenant. Renseigne un maximum de champs à partir des données connues.",
    input_schema: obj({
      typeId: { type: 'string', enum: ['mandat_vente', 'mandat_recherche', 'offre_achat', 'avenant'] },
      variante: { type: 'string', enum: ['Simple', 'Semi-exclusif', 'Exclusif'], description: 'Pour les mandats' },
      champs: { type: 'object', description: 'Champs du modèle (mandantNom, mandantAdresse, bienAdresse, prixVente, honorairesTaux, dureeInitiale… ; voir lister_champs_document)', additionalProperties: true },
    }, ['typeId', 'champs']),
  },
  {
    name: 'lister_champs_document',
    description: 'Donne la liste des champs attendus par un modèle de document (identifiant, libellé, options), à appeler avant generer_document.',
    input_schema: obj({ typeId: { type: 'string', enum: ['mandat_vente', 'mandat_recherche', 'offre_achat', 'avenant'] } }, ['typeId']),
  },
  {
    name: 'enregistrer_dans_bibliotheque',
    description: "Mémorise durablement une synthèse dans la bibliothèque de l'application (compte rendu de visite, analyse d'un document, note de marché) : elle sera disponible dans toutes les futures conversations.",
    input_schema: obj({ nom: str('Titre'), resume: str('Synthèse (max ~1500 caractères)'), tags: arr({ type: 'string' }) }, ['nom', 'resume']),
  },
  {
    name: 'ouvrir_page',
    description: "Ouvre une page de l'application pour l'utilisateur.",
    input_schema: obj({ route: { type: 'string', enum: ['/', '/mandats', '/contacts', '/suivi', '/documents', '/facturation', '/frais', '/comptabilite', '/tresorerie', '/im', '/mail', '/promesses', '/rapports', '/parametres'] } }, ['route']),
  },
];

// ---------------------------------------------------------------------------
// Exécution — `app` est la valeur de useApp(), `navigate` celle du routeur.
// ---------------------------------------------------------------------------
export function createToolExecutor({ app, navigate, societe }) {
  const today = () => new Date().toISOString().slice(0, 10);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function resolveContact(ref) {
    const r = String(ref || '').trim();
    if (!r) throw new Error('Contact non précisé.');
    const byId = app.contacts.find((c) => c.id === r);
    if (byId) return byId;
    const q = norm(r);
    const hits = app.contacts.filter((c) => norm(`${c.societe} ${c.prenom} ${c.nom} ${c.email}`).includes(q));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) throw new Error(`Plusieurs contacts correspondent à « ${r} » : ${hits.slice(0, 5).map((c) => `${contactLabel(c)} (${c.id})`).join(', ')} — précise l'identifiant.`);
    throw new Error(`Aucun contact trouvé pour « ${r} ».`);
  }
  const compact = (c) => {
    const n = normalizeContact(c);
    return { id: n.id, label: contactLabel(n), nom: [n.prenom, n.nom].filter(Boolean).join(' '), fonction: n.fonction, categorie: n.categorie, email: n.email, telephone: n.telephone, vehicule: n.vehicule, classesActifs: n.classesActifs, zones: n.zones, ticketMin: n.ticketMin, ticketMax: n.ticketMax, rendementCible: n.rendementCible, statutRelation: n.statutRelation, prochaineRelance: n.prochaineRelance, notes: (n.notes || '').slice(0, 300), dernierEchange: n.interactions[0] ? `${n.interactions[0].date} ${n.interactions[0].type}: ${n.interactions[0].note}` : undefined };
  };
  const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));

  return async function execute(name, input) {
    switch (name) {
      case 'lister_donnees': {
        const list = app[input.type] || [];
        const q = norm(input.recherche);
        const out = list.filter((x) => !q || norm(JSON.stringify(x)).includes(q)).slice(0, input.limite || 40)
          .map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !['justificatif', 'photoPrincipale', 'photoComposition', 'photoSituation', 'champs', 'fichiers'].includes(k))));
        return { total: list.length, resultats: out };
      }
      case 'rechercher_contacts': {
        const q = norm(input.texte);
        const res = app.contacts.map(normalizeContact).filter((c) => {
          if (q && !norm(`${c.societe} ${c.prenom} ${c.nom} ${c.fonction} ${c.email} ${c.notes} ${c.categorie} ${c.zones.join(' ')} ${c.classesActifs.join(' ')}`).includes(q)) return false;
          if (input.categorie && norm(c.categorie) !== norm(input.categorie)) return false;
          if (input.classeActif && !c.classesActifs.includes(input.classeActif)) return false;
          if (input.zone && !c.zones.some((z) => norm(z).includes(norm(input.zone)) || norm(input.zone).includes(norm(z)))) return false;
          if (input.statutRelation && c.statutRelation !== input.statutRelation) return false;
          if (input.aRelancer && !(c.prochaineRelance && c.prochaineRelance <= today())) return false;
          return true;
        }).slice(0, 40).map(compact);
        return { total: res.length, contacts: res };
      }
      case 'creer_contact': {
        const rec = app.addContact(normalizeContact(clean(input)));
        return { id: rec.id, resume: `Contact créé : ${contactLabel(rec)}` };
      }
      case 'modifier_contact': {
        const c = resolveContact(input.contact);
        app.updateContact(c.id, clean(input.modifications));
        return { id: c.id, resume: `Contact modifié : ${contactLabel(c)}` };
      }
      case 'ajouter_interaction': {
        const c = resolveContact(input.contact);
        const inter = { id: uid('inter'), date: input.date || today(), type: input.type, note: input.note };
        const patch = { interactions: [inter, ...(c.interactions || [])] };
        if (input.prochaineRelance) patch.prochaineRelance = input.prochaineRelance;
        app.updateContact(c.id, patch);
        return { resume: `${input.type} noté pour ${contactLabel(c)}${input.prochaineRelance ? ` — relance le ${input.prochaineRelance}` : ''}` };
      }
      case 'matcher_investisseurs': {
        let bien = input.bien;
        if (input.mandatId) {
          const m = app.mandats.find((x) => x.id === input.mandatId);
          if (!m) throw new Error('Mandat introuvable.');
          bien = { typeBien: m.typeBien, adresse: m.adresse, prix: m.prixVente, loyerAnnuel: m.loyerAnnuel, description: m.description };
        }
        if (!bien) throw new Error('Décris le bien ou donne un mandatId.');
        const res = matcherInvestisseurs(app.contacts, bien, { limite: input.limite || 12, minimum: 25 });
        return { bien, resultats: res.map((r) => ({ score: r.score, raisons: r.raisons, contact: compact(r.contact) })) };
      }
      case 'biens_pour_contact': {
        const c = resolveContact(input.contact);
        const res = matcherBiens(c, app.mandats, { minimum: 25 });
        return { contact: contactLabel(c), resultats: res.map((r) => ({ score: r.score, raisons: r.raisons, mandat: { id: r.mandat.id, adresse: r.mandat.adresse, typeBien: r.mandat.typeBien, prixVente: r.mandat.prixVente, loyerAnnuel: r.mandat.loyerAnnuel } })) };
      }
      case 'creer_prospect': {
        const rec = app.addProspect(clean({ ...input, dateEnvoi: input.dateEnvoi || (input.statut === 'Envoyé' ? today() : '') }));
        return { id: rec.id, resume: `Suivi commercial : ${rec.prospect} (${rec.statut})` };
      }
      case 'modifier_prospect': {
        const p = app.prospects.find((x) => x.id === input.id);
        if (!p) throw new Error('Prospect introuvable.');
        app.updateProspect(p.id, clean(input.modifications));
        return { resume: `Suivi mis à jour : ${p.prospect}` };
      }
      case 'creer_mandat': {
        const rec = app.addMandat(clean({ typeMandat: 'Vente', ...input }));
        return { id: rec.id, resume: `Mandat créé : ${rec.adresse}` };
      }
      case 'modifier_mandat': {
        const m = app.mandats.find((x) => x.id === input.id);
        if (!m) throw new Error('Mandat introuvable.');
        app.updateMandat(m.id, clean(input.modifications));
        return { resume: `Mandat modifié : ${m.adresse}` };
      }
      case 'creer_promesse': {
        const rec = app.addPromesse(clean(input));
        return { id: rec.id, resume: `Promesse enregistrée : ${rec.bienAdresse}` };
      }
      case 'modifier_promesse': {
        const p = app.promesses.find((x) => x.id === input.id);
        if (!p) throw new Error('Promesse introuvable.');
        app.updatePromesse(p.id, clean(input.modifications));
        return { resume: `Promesse mise à jour : ${p.bienAdresse}` };
      }
      case 'calculer_honoraires': {
        const h = calcHonoraires(societe.bareme, Number(input.prix) || 0);
        const tva = tvaMontant(h, societe.tauxTvaDefaut ?? 20);
        return { prix: input.prix, honorairesHT: Math.round(h), tva: Math.round(tva), honorairesTTC: Math.round(h + tva), bareme: societe.bareme };
      }
      case 'creer_facture_brouillon': {
        const taux = Number(input.tauxTva ?? societe.tauxTvaDefaut ?? 20);
        let lignes = (input.lignes || []).filter((l) => l && (l.libelle || l.montantHT)).map((l) => ({ id: uid('ligne'), libelle: l.libelle || 'Honoraires de transaction', montant: Number(l.montantHT) || 0 }));
        if (!lignes.length) {
          const h = input.prixVente ? Math.round(calcHonoraires(societe.bareme, Number(input.prixVente))) : 0;
          lignes = [{ id: uid('ligne'), libelle: `Honoraires de transaction${input.bienAdresse ? ` — ${input.bienAdresse}` : ''}`, montant: h }];
        }
        const montantHT = lignes.reduce((s, l) => s + l.montant, 0);
        const montantTVA = tvaMontant(montantHT, taux);
        const rec = app.addFacture({
          numero: nextInvoiceNumber(app.factures), clientNumero: clientNumero(app.factures, input.client), client: input.client,
          bienAdresse: input.bienAdresse || '', mandatRef: input.mandatRef || '', notaire: input.notaire || '',
          refTitre: input.refTitre || `Commission d'agence${input.bienAdresse ? ` — ${input.bienAdresse}` : ''}`, libelle: lignes[0].libelle,
          dateEmission: today(), tauxTva: taux, lignes, montantHT, montantTVA, montantTTC: montantHT + montantTVA, statut: 'Brouillon', redevable: input.redevable || '', source: 'copilote',
        });
        return { id: rec.id, numero: rec.numero, montantHT, montantTTC: montantHT + montantTVA, resume: `Facture ${rec.numero} créée en brouillon — ${formatEUR(montantHT + montantTVA)} TTC` };
      }
      case 'creer_note_de_frais': {
        const ttc = Number(input.montantTTC) || 0;
        const taux = Number(input.tauxTva ?? 20);
        const tva = tvaMontant(ttc / (1 + taux / 100), taux);
        const cat = DEPENSE_CATEGORIES.find((c) => c.id === input.categorie) || DEPENSE_CATEGORIES.find((c) => c.id === 'autre');
        const rec = app.addNoteFrais({ commercant: input.commercant || '', date: input.date || today(), categorie: cat.id, categorieLabel: cat.label, compte: cat.compte, montantTTC: ttc, montantTVA: tva, montantHT: ttc - tva, tauxTva: taux });
        return { id: rec.id, resume: `Note de frais : ${formatEUR(ttc)} — ${cat.label}${input.commercant ? ` (${input.commercant})` : ''}` };
      }
      case 'preparer_email': {
        navigate('/mail', { state: { compose: { to: input.to, subject: input.subject, body: input.body } } });
        return { resume: `Email préparé pour ${(input.to || []).join(', ')} — à relire et envoyer dans la Boîte mail` };
      }
      case 'preparer_im': {
        let bien = clean(input.bien);
        if (input.mandatId) {
          const m = app.mandats.find((x) => x.id === input.mandatId);
          if (m) bien = { adresse: m.adresse, typeBien: m.typeBien, prix: m.prixVente, surface: m.surface, loyerAnnuel: m.loyerAnnuel, dpe: m.dpe, description: m.description, ...bien };
        }
        if (!bien.adresse) throw new Error('Adresse du bien manquante.');
        navigate('/im', { state: { bien } });
        return { resume: `Assistant IM ouvert pour ${bien.adresse}` };
      }
      case 'lister_champs_document': {
        const { loadTemplate } = await import('./documentFields.js');
        const mod = await loadTemplate(input.typeId);
        if (!mod) throw new Error('Modèle introuvable.');
        return { typeId: input.typeId, champs: mod.FIELDS.map((f) => ({ id: f.id, label: f.label, section: f.section, type: f.type, options: f.options, requis: !!f.required, defaut: f.default })) };
      }
      case 'generer_document': {
        const { downloadDocumentPdf } = await import('./documentEngine.js');
        const prefix = { mandat_vente: 'MV', mandat_recherche: 'MR', offre_achat: 'OA', avenant: 'AV' }[input.typeId] || 'DOC';
        const nums = app.documents.map((d) => d.numero).filter((n) => n && n.startsWith(`${prefix}-`)).map((n) => parseInt(n.split('-')[1], 10)).filter((n) => !Number.isNaN(n));
        const numero = `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
        const variante = input.typeId.startsWith('mandat') ? (input.variante || 'Simple') : undefined;
        await downloadDocumentPdf({ typeId: input.typeId, variante, champs: input.champs || {}, societe, numero });
        app.addDocument({ typeId: input.typeId, variante, champs: input.champs || {}, numero, statut: 'Brouillon' });
        return { numero, resume: `Document ${numero} généré (PDF téléchargé, brouillon enregistré dans Documents)` };
      }
      case 'enregistrer_dans_bibliotheque': {
        const rec = app.addDocument({ type: 'bibliotheque', nom: input.nom, resume: String(input.resume || '').slice(0, 2500), tags: input.tags || [], statut: 'Mémorisé' });
        return { id: rec.id, resume: `Mémorisé dans la bibliothèque : ${input.nom}` };
      }
      case 'ouvrir_page': {
        navigate(input.route);
        return { resume: `Page ouverte : ${input.route}` };
      }
      default:
        throw new Error(`Outil inconnu : ${name}`);
    }
  };
}
