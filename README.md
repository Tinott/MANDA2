# Mandat — Application de gestion SARL (broker immobilier)

Application web (React + Vite) couvrant la facturation d'honoraires, les notes
de frais, la comptabilité automatisée, la trésorerie, la génération de
memorandums (IM), la data room et le reporting d'un broker immobilier
indépendant en SARL.

## Démarrer en local

```bash
npm install
npm run dev
```

## Déployer sur Vercel

1. Dézippez ce projet et utilisez-le comme racine d'un dépôt Git :
   ```bash
   cd mandat-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <votre-repo-github>
   git push -u origin main
   ```
2. Sur vercel.com, **Add New → Project**, importez le dépôt GitHub.
3. Vercel détecte automatiquement Vite (`Build Command: vite build`,
   `Output Directory: dist`). Ne changez rien, cliquez **Deploy**.
4. Vérifiez que **Root Directory** pointe bien sur le dossier contenant
   `package.json` (pas un sous-dossier imbriqué) — c'est la cause la plus
   fréquente d'une erreur `NOT_FOUND` après déploiement.

## Notes techniques

- **Données** : stockées en local (localStorage) dans le navigateur de
  l'utilisateur — aucune donnée n'est envoyée à un serveur. Pour une V2
  multi-utilisateurs avec synchronisation, prévoir un backend (Postgres +
  API) : la structure des données (src/context/AppContext.jsx) est déjà
  prête à être branchée sur des appels réseau.
- **Extraction depuis un acte/PDF** : lecture réelle du texte via pdf.js
  côté navigateur, avec reconnaissance heuristique du prix, des parties et
  de la date. L'utilisateur relit et corrige systématiquement avant
  génération de la facture — c'est le comportement volontaire, pas une
  limite cachée.
- **OCR des tickets de frais** : reconnaissance réelle via tesseract.js
  (modèle français), exécutée dans le navigateur.
- **Génération de documents** : factures en PDF (jsPDF), memorandums en
  PowerPoint (pptxgenjs) — téléchargement direct, aucun service tiers.
- **Data room** : l'envoi d'email individualisé par client est préparé côté
  interface mais nécessite un connecteur d'envoi (Resend, SendGrid…) côté
  serveur pour fonctionner réellement — clairement indiqué dans l'écran
  correspondant plutôt que simulé.
- **Bilan / compte de résultat** : calculés à partir du registre
  facturation + frais. Marqués « à faire valider par l'expert-comptable »,
  comme tout état comptable généré automatiquement.
