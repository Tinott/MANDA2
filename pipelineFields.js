
export const PROSPECT_FIELDS = [
  { id: 'ignorer', label: 'Ignorer' },
  { id: 'dossier', label: 'Dossier (classé automatiquement)' },
  { id: 'prospect', label: 'Prospect / Société' },
  { id: 'contact', label: 'Contact' },
  { id: 'type', label: 'Type' },
  { id: 'broker', label: 'Broker' },
  { id: 'dateEnvoi', label: "Date d'envoi" },
  { id: 'versionEnvoyee', label: 'Version envoyée' },
  { id: 'statut', label: 'Statut' },
  { id: 'niveauInteret', label: "Niveau d'intérêt" },
  { id: 'dernierEchange', label: 'Dernier échange' },
  { id: 'prochaineRelance', label: 'Prochaine relance' },
  { id: 'retour', label: 'Retour / Commentaires' },
  { id: 'prixPropose', label: 'Prix proposé' },
  { id: 'rendementPropose', label: 'Rendement proposé' },
  { id: 'documentsDemandes', label: 'Documents demandés' },
  { id: 'prochaineAction', label: 'Prochaine action' },
];

export const PROSPECT_SYNONYMS = {
  dossier: ['dossier', 'nom du dossier'],
  prospect: ['prospect societe', 'prospect', 'societe'],
  contact: ['contact'],
  type: ['type'],
  broker: ['broker', 'via brokers', 'via broker'],
  dateEnvoi: ['date d envoi', 'date envoi'],
  versionEnvoyee: ['version envoyee', 'version'],
  statut: ['statut'],
  niveauInteret: ['niveau d interet', 'niveau interet', 'interet'],
  dernierEchange: ['dernier echange'],
  prochaineRelance: ['prochaine relance'],
  retour: ['retour commentaires', 'retour', 'commentaires'],
  prixPropose: ['prix propose'],
  rendementPropose: ['rendement propose'],
  documentsDemandes: ['documents demandes'],
  prochaineAction: ['prochaine action'],
};

export const COURRIER_FIELDS = [
  { id: 'ignorer', label: 'Ignorer' },
  { id: 'dossier', label: 'Dossier (classé automatiquement)' },
  { id: 'dateEnvoi', label: "Date d'envoi" },
  { id: 'typeAction', label: "Type d'action" },
  { id: 'typeContact', label: 'Type de contact' },
  { id: 'societe', label: 'Société / Foncière' },
  { id: 'nomContact', label: 'Nom du contact' },
  { id: 'fonction', label: 'Fonction' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'email', label: 'Email' },
  { id: 'bienSecteur', label: 'Bien / Secteur concerné' },
  { id: 'objet', label: 'Objet du courrier / mail' },
  { id: 'statut', label: 'Statut' },
  { id: 'dateRelancePrevue', label: 'Date de relance prévue' },
  { id: 'nbRelances', label: 'Nb de relances' },
  { id: 'reponseObtenue', label: 'Réponse obtenue' },
  { id: 'prochaineAction', label: 'Prochaine action / Commentaires' },
  { id: 'chargeDossier', label: 'Chargé(e) de dossier' },
];

export const COURRIER_SYNONYMS = {
  dossier: ['dossier', 'nom du dossier'],
  dateEnvoi: ['date d envoi', 'date envoi'],
  typeAction: ['type d action', 'type action'],
  typeContact: ['type de contact', 'type contact'],
  societe: ['societe fonciere', 'societe', 'fonciere'],
  nomContact: ['nom du contact', 'nom contact'],
  fonction: ['fonction'],
  telephone: ['telephone'],
  email: ['email', 'mail'],
  bienSecteur: ['bien secteur concerne', 'bien secteur', 'secteur'],
  objet: ['objet du courrier mail', 'objet du courrier', 'objet'],
  statut: ['statut'],
  dateRelancePrevue: ['date de relance prevue', 'date relance prevue', 'date relance'],
  nbRelances: ['nb de relances', 'nb relances', 'nombre de relances'],
  reponseObtenue: ['reponse obtenue'],
  prochaineAction: ['prochaine action commentaires', 'prochaine action'],
  chargeDossier: ['charge e de dossier', 'charge de dossier', 'charge dossier'],
};

export const PROSPECT_STATUTS = ['À contacter', 'Envoyé', 'Relancé', 'Intéressé', 'Offre'];
export const PROSPECT_INTERETS = ['Faible', 'Moyen', 'Fort'];
export const PROSPECT_TYPES = ['Foncière', 'Family Office', 'Privé', 'SCPI', 'Autre'];

export const COURRIER_STATUTS = [
  'Envoyé', 'En attente de réponse', 'Relancé', 'RDV obtenu',
  'Réponse positive', 'Réponse négative', 'Sans réponse', 'Dossier clos',
];
export const COURRIER_TYPES_CONTACT = ['Propriétaire foncier', 'Foncière - Nouveau client', 'Investisseur', 'Autre'];
export const COURRIER_TYPES_ACTION = ['Email', 'Courrier', 'Appel', 'RDV'];
