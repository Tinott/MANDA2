# MANDA2 — Refonte complète (lots 1 à 5)

Paquet prêt à poser : **aucun patch manuel**. Build de production ✓, lint 0
erreur, documents testés au runtime (PDF des 3 mandats, facture, IM .pptx) et
relus mot à mot, reconnaissance email→dossier testée unitairement.

## ⚠️ Mise à jour lot 5 : l'Edge Function DOIT être redéployée

Le Copilote agit désormais dans l'application via des « outils » (créer un
contact, une facture, préparer un email…). La fonction `claude-proxy` du
lot 4 **bloquait** ces outils par sécurité : il faut recoller la nouvelle
version (dashboard Supabase → Edge Functions → claude-proxy → remplacer le
code par `supabase/functions/claude-proxy/index.ts` → Deploy). Sans cela,
le Copilote répond mais n'agit pas. Le secret `ANTHROPIC_API_KEY` reste.

## Installation (10 min)

1. Copier le contenu de `src/` dans le `src/` du repo (remplacer), ainsi que
   `package.json`, `package-lock.json` et le dossier `supabase/` à la racine.
2. `npm install` (le lock régénéré inclut `@azure/msal-browser` — l'ancien
   lock du repo était désynchronisé et faisait échouer `npm ci`).
3. `npm run dev` pour tester, puis push → Vercel.

## Philosophie « universelle » (lot 3)

L'utilisateur final ne configure **rien** :
- **IA** : dans Paramètres, deux options équivalentes au choix de chacun —
  « IA de l'application » (rien à saisir : Edge Function `claude-proxy`, clé
  de l'administrateur côté serveur, utilisateurs connectés uniquement) ou
  « Ma propre clé API » (compte Anthropic personnel : sa consommation, sa
  facture). Le mode choisi est respecté strictement.
- **Gmail / Outlook** : il clique « Connecter », choisit son compte dans la
  fenêtre officielle Google/Microsoft — terminé. Les Client ID identifient
  l'APPLICATION, pas l'utilisateur : ils se créent une seule fois.
- Les tutos pas à pas sont INTÉGRÉS à l'appli : Paramètres → Intégrations →
  « Administrateur — configuration (une seule fois) ».

## Configuration administrateur (une seule fois)

### IA partagée (recommandé)
1. Compte sur console.anthropic.com (offre API, indépendante d'un abonnement
   Claude) → Billing : crédits prépayés (5–10 € pour commencer) + **plafond de
   dépense** → API keys : créer une clé `sk-ant-…`.
2. Déployer la fonction (version lot 4, avec recherche web) : dashboard
   Supabase → Edge Functions → Deploy new
   function → nom `claude-proxy` → coller
   `supabase/functions/claude-proxy/index.ts` ; puis Edge Functions → Secrets →
   `ANTHROPIC_API_KEY` = la clé.
   (CLI : `supabase functions deploy claude-proxy` puis
   `supabase secrets set ANTHROPIC_API_KEY=…`.)
3. Garde-fous intégrés à la fonction : utilisateurs authentifiés uniquement,
   modèles en liste blanche, max_tokens et taille de requête plafonnés.
   Chaque utilisateur peut aussi choisir « Ma propre clé API » dans
   Paramètres — les deux modes cohabitent.

### Gmail (Client ID de l'application)
Google Cloud Console → projet → activer **Gmail API** + **People API** →
écran de consentement (Externe ; en mode « Test », ajouter les emails
autorisés comme utilisateurs test) → Identifiants → ID client OAuth type
**Application Web** → Origines JavaScript : `http://localhost:5173` + URL de
production. Coller l'ID dans Paramètres → Intégrations → Administrateur, ou en
variable d'environnement **`VITE_GOOGLE_CLIENT_ID`** (Vercel → Settings →
Environment Variables). Pour ouvrir à tout Gmail sans liste de testeurs :
passer l'app en « Production » (vérification Google — à prévoir avant
commercialisation).

### Outlook / Microsoft 365
portal.azure.com → Entra ID → Inscriptions d'applications → type **SPA**,
redirect URI = les deux URL → permissions Graph déléguées Mail.Read,
Mail.Send, Contacts.Read, User.Read → ID client dans le champ dédié ou
**`VITE_MS_CLIENT_ID`**.

## Ce que fait l'appli (récapitulatif des 3 lots)

**Documents parfaits** — mandat de vente (3 variantes), mandat de recherche
(miroir des mandats réels : substitution, L. 215-1 à L. 215-3 et L. 241-3,
non-condamnation, exclusivité 12 mois…), avenant (dont clause « frais déduits
des honoraires à la réitération »), prix en toutes lettres, facture conforme
(pénalités, art. L.441-10/D.441-5, mention fonds), IM .pptx 12 slides style
Cobalt. Correctifs typographiques appliqués jusque dans les espaces
insécables des PDF.

**Boîte mail complète** — connexion en un clic, lecture unifiée
Gmail+Outlook, **composer avec sélection des contacts** (tapez un nom → vos
contacts sont proposés, chips multi-destinataires), envoi de nouveaux
messages et de réponses, import des contacts dédoublonné, et sur chaque mail
reçu un bandeau **« Dans vos dossiers »** : contact, promesse (avec date de
réitération), factures, mandats liés à l'expéditeur — instantané, sans appel
IA.

**Lot 5 — le Copilote devient un collaborateur, l'appli se souvient de tout**

- *Mémoire de navigation* : chaque page garde sa position de défilement,
  ses filtres et sa recherche ; l'application rouvre la dernière page
  visitée ; la conversation du Copilote et ses documents déposés survivent
  aux changements d'onglet (`src/hooks/useNavMemory.js`).
- *Contacts structurés* (`contactsSchema.js`, `Contacts.jsx`) : identité
  (fonction, LinkedIn, site), profil investisseur (véhicule, stratégie,
  classes d'actifs, zones, ticket min/max, rendement cible), patrimoine
  (propriétaires), suivi (statut de relation, source, prochaine relance),
  **historique des échanges** daté (appel, email, RDV, visite, envoi IM,
  offre) avec relance programmée ; fiche détaillée à onglets ; filtres par
  catégorie / classe d'actif / statut / « à relancer » ; import Excel qui
  reconnaît ces colonnes (zones, ticket « 5 M€ », classes…). Les relances
  contacts remontent dans les alertes du Dashboard.
- *Matching investisseurs ↔ biens* (`matching.js`) : score explicable
  (classe d'actif 40, zone 25, ticket 25, rendement 10) ; panneau
  « Investisseurs à cibler » après génération d'un IM avec création du
  suivi de diffusion en un clic ; « Biens à lui proposer » sur chaque fiche
  investisseur ; outil `matcher_investisseurs` pour le Copilote.
- *Copilote agent* (`agentTools.js`, `ai.js › runAgent/askAgent`) : 23
  outils — lister / rechercher, créer et modifier contacts, échanges,
  suivi commercial, mandats, promesses, **factures brouillon** (calcul au
  barème), **notes de frais**, préparer un **email** (composer pré-rempli),
  préparer un **IM** (assistant pré-rempli), **générer un document
  juridique PDF**, mémoriser dans la bibliothèque, ouvrir une page — plus la
  recherche web. Aucun outil ne supprime ; les envois restent validés par
  l'utilisateur. Les actions effectuées s'affichent sous chaque réponse.
- *Glisser-déposer partout* : documents sur le Copilote (PDF, images OCR,
  Word, Excel, CSV, texte — `fileText.js`) → lus, analysés, **mémorisés
  dans la bibliothèque** (visible dans Documents) et disponibles dans toutes
  les conversations ; acte/promesse sur Facturation → facture ; ticket sur
  Notes de frais → **lecture IA du justificatif** (commerçant, date, TTC,
  TVA, catégorie) avec repli OCR local.
- *Dictée* (reconnaissance vocale du navigateur, Chrome/Edge) dans le
  Copilote et pour le « Compte rendu de visite » : notes dictées → CR
  structuré, échanges notés sur les contacts, relances programmées,
  mémorisation.
- *LinkedIn* : production « Post LinkedIn » + bouton « Publier sur
  LinkedIn » (LinkedIn s'ouvre avec le texte pré-rempli). Profil LinkedIn
  saisi dans Paramètres › Intégrations. LinkedIn n'autorise aucune
  application à lire un compte (réseau, messages) : rien d'autre n'est
  techniquement possible, l'appli ne le promet pas.
- *Briefing* : chaque action du point du jour a un bouton « Faire » qui la
  confie au Copilote.
- *IM en un glisser-déposer* : dans l'assistant IM, déposez d'un coup bail,
  état locatif, diagnostics, plaquette, photos et plans → les données du
  bien sont extraites par l'IA (`extractImDataAI` : locataire, loyer,
  durée, indexation, date d'effet, surface, cadastre, DPE, charges, points à
  vérifier), les photos affectées automatiquement (couverture ; « carte… »
  → situation ; « plan… » → composition ; les autres → galerie), puis les
  textes de présentation et les **points clés** rédigés. Le PowerPoint
  gagne une galerie (2 photos par slide) et une slide « Points clés de
  l'investissement ». Après génération : investisseurs à cibler + campagne.
- Dépendance ajoutée : `jszip` (lecture Word) — déjà présent via pptxgenjs,
  déclaré explicitement.

**Agent IA CARDO (lot 4)** — le Copilote est un moteur de dossiers, pas un
chat : barre de **productions à la demande** — *Fiche prospect* (recherche
web réelle : société, dirigeants, patrimoine, signaux de cession, angle
d'approche, sourcé et daté), *Avis de valeur* (comparables recherchés sur le
web en tableau date/ville/surface/prix/taux, approche par le rendement,
fourchette argumentée), *Teaser anonymisé* (jamais le vendeur ni l'adresse
exacte), *Veille marché* (transactions, taux, mouvements d'investisseurs),
*Séquence de prospection* (3 emails + 2 relances par profil de cible) — et
**analyse de documents** : déposez un bail, un état locatif, un diagnostic ou
une promesse en PDF dans le chat, la synthèse structurée arrive (données
clés, échéances, risques, actions). Chaque alerte du Dashboard porte un
bouton **« Rédiger la relance »** qui ouvre le composer avec la consigne
prête. Le chat sait aussi produire NDA, lettres de process, index de data
room, comptes rendus, tableaux comparatifs et scoring d'offres, posts
LinkedIn et tombstones. Règles CARDO câblées dans tous les prompts : données
sourcées et datées (sinon « à vérifier »), aucun chiffre inventé,
comparables en tableau, teasers anonymisés, relecture humaine avant envoi.
La recherche web passe par l'outil officiel Anthropic, exécuté côté serveur
et verrouillé dans l'Edge Function (web_search uniquement, 5 recherches max
par requête).

**Secrétaire IA proactive** — le Copilote ouvre sur **« Le point du jour »**,
généré automatiquement (1 fois/jour, actualisable) : résumé de l'activité +
3-7 actions datées cliquables (« Émettre la facture NCAP avant le 20/10 —
réitération le 04/11 → Ouvrir »). Le chat connaît toutes les données ET les
alertes calculées, répond en citant les dossiers, et signale spontanément ce
qui mérite attention. Rédaction d'emails (réponses et nouveaux messages avec
consigne), extraction d'actes pour la facturation, textes d'IM.

**Alertes déterministes** (sans IA, toujours actives) — conditions
suspensives, réitérations, mandats qui expirent, factures en retard, relances
prospects et courriers — sur le Dashboard et dans Promesses.

## Limites connues
- Jeton Gmail : reconnexion après ~1 h (un clic). Levable plus tard avec un
  refresh token côté serveur.
- Mode « Test » Google : seuls les emails déclarés testeurs se connectent,
  jusqu'au passage en Production.
- Les documents générés restent marqués « brouillon à faire valider par un
  professionnel du droit ».
