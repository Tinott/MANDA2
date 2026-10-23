// Moteur de calcul — pur, sans effet de bord, testable indépendamment de l'UI.

export function calcHonoraires(bareme, prixVente) {
  const prix = Number(prixVente) || 0;
  if (!bareme) return 0;
  if (bareme.type === 'forfait') return Number(bareme.montant) || 0;
  if (bareme.type === 'taux_fixe') return prix * ((Number(bareme.taux) || 0) / 100);
  if (bareme.type === 'degressif') {
    const tranches = [...(bareme.tranches || [])].sort(
      (a, b) => (a.jusqu_a === null ? Infinity : a.jusqu_a) - (b.jusqu_a === null ? Infinity : b.jusqu_a)
    );
    let reste = prix;
    let base = 0;
    let total = 0;
    for (const tr of tranches) {
      const plafond = tr.jusqu_a === null ? Infinity : tr.jusqu_a;
      const montantTranche = Math.max(0, Math.min(reste, plafond - base));
      total += montantTranche * ((Number(tr.taux) || 0) / 100);
      base = plafond;
      reste = prix - base;
      if (reste <= 0) break;
    }
    return total;
  }
  return 0;
}

export function repartitionRedevable(montantHT, redevable, quotePartVendeur = 50) {
  // redevable: 'vendeur' | 'acquereur' | 'partage'
  if (redevable === 'vendeur') return { vendeur: montantHT, acquereur: 0 };
  if (redevable === 'acquereur') return { vendeur: 0, acquereur: montantHT };
  const partV = montantHT * (Number(quotePartVendeur) / 100);
  return { vendeur: partV, acquereur: montantHT - partV };
}

export function ttc(ht, tauxTva) {
  return ht * (1 + (Number(tauxTva) || 0) / 100);
}

export function tvaMontant(ht, tauxTva) {
  return ht * ((Number(tauxTva) || 0) / 100);
}

export function nextInvoiceNumber(factures, year = new Date().getFullYear()) {
  const nums = factures
    .map((f) => f.numero)
    .filter((n) => n && n.startsWith(`F${year}-`))
    .map((n) => parseInt(n.split('-')[1], 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `F${year}-${String(next).padStart(4, '0')}`;
}

// N° client — un identifiant stable par client, comme sur les factures des
// confrères (ex. CLT00000256). Réutilise le numéro déjà attribué à ce nom.
export function clientNumero(factures, clientName) {
  if (!clientName) return null;
  const existing = factures.find((f) => f.client === clientName && f.clientNumero);
  if (existing) return existing.clientNumero;
  const nums = factures
    .map((f) => f.clientNumero)
    .filter(Boolean)
    .map((n) => parseInt(String(n).replace(/\D/g, ''), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `CLT${String(next).padStart(8, '0')}`;
}

export function isInPeriod(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  return d >= new Date(start).getTime() && d <= new Date(end + 'T23:59:59').getTime();
}

// Construit le registre annuel (grand livre simplifié) à partir des factures
// (recettes, comptes 706x) et des notes de frais (charges, comptes 6xxx).
export function buildRegistre(factures, notesFrais) {
  const recettes = factures
    .filter((f) => f.statut !== 'Brouillon')
    .map((f) => ({
      id: f.id,
      date: f.dateEmission,
      libelle: `${f.numero} — ${f.client || 'Client'}`,
      compte: '706100',
      sens: 'credit',
      ht: f.montantHT,
      tva: f.montantTVA,
      ttc: f.montantTTC,
      source: 'facture',
      statut: f.statut,
    }));
  const charges = notesFrais.map((n) => ({
    id: n.id,
    date: n.date,
    libelle: `${n.commercant || n.categorieLabel} — ${n.categorieLabel}`,
    compte: n.compte,
    sens: 'debit',
    ht: n.montantHT,
    tva: n.montantTVA,
    ttc: n.montantTTC,
    source: 'frais',
  }));
  return [...recettes, ...charges].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function aggregatePeriod(registre, start, end) {
  const lignes = registre.filter((l) => isInPeriod(l.date, start, end));
  const produits = lignes.filter((l) => l.sens === 'credit');
  const charges = lignes.filter((l) => l.sens === 'debit');
  const totalProduitsHT = produits.reduce((s, l) => s + l.ht, 0);
  const totalChargesHT = charges.reduce((s, l) => s + l.ht, 0);
  const tvaCollectee = produits.reduce((s, l) => s + l.tva, 0);
  const tvaDeductible = charges.reduce((s, l) => s + l.tva, 0);
  return {
    lignes,
    produits,
    charges,
    totalProduitsHT,
    totalChargesHT,
    resultat: totalProduitsHT - totalChargesHT,
    tvaCollectee,
    tvaDeductible,
    tvaDue: tvaCollectee - tvaDeductible,
  };
}

export function chargesParCategorie(charges) {
  const map = new Map();
  for (const c of charges) {
    const key = c.compte;
    map.set(key, (map.get(key) || 0) + c.ht);
  }
  return [...map.entries()].map(([compte, montant]) => ({ compte, montant }));
}

function periodDays(start, end) {
  return Math.max(1, (new Date(end) - new Date(start)) / 86400000 + 1);
}

// Compte de résultat au format soldes intermédiaires de gestion (SIG) — même
// structure que les prévisionnels d'expert-comptable habituels du secteur
// (chiffre d'affaires, valeur ajoutée, EBE, résultat d'exploitation…).
// Les charges de structure (rémunération du gérant, charges sociales,
// impôts et taxes, dotations aux amortissements) sont saisies en Paramètres
// et proratisées sur la période sélectionnée.
export function buildCompteDeResultat(agg, societe = {}, start, end) {
  const prorata = start && end ? periodDays(start, end) / 365 : 1;

  const chiffreAffaires = agg.totalProduitsHT;
  const autresChargesExternes = agg.totalChargesHT;
  const valeurAjoutee = chiffreAffaires - autresChargesExternes;

  const impotsEtTaxes = (Number(societe.impotsTaxesAnnuel) || 0) * prorata;
  const remunerations = (Number(societe.remunerationGerantAnnuelle) || 0) * prorata;
  const chargesSociales = (Number(societe.chargesSocialesAnnuelle) || 0) * prorata;
  const totalChargesPersonnel = remunerations + chargesSociales;

  const excedentBrutExploitation = valeurAjoutee - impotsEtTaxes - totalChargesPersonnel;
  const dotationsAmortissements = (Number(societe.dotationAmortissementAnnuelle) || 0) * prorata;
  const resultatExploitation = excedentBrutExploitation - dotationsAmortissements;

  const produitsFinanciers = (Number(societe.produitsFinanciersAnnuel) || 0) * prorata;
  const chargesFinancieres = (Number(societe.chargesFinancieresAnnuel) || 0) * prorata;
  const resultatCourant = resultatExploitation + produitsFinanciers - chargesFinancieres;

  const isEstime =
    resultatCourant <= 0
      ? 0
      : resultatCourant <= 42500
      ? resultatCourant * 0.15
      : 42500 * 0.15 + (resultatCourant - 42500) * 0.25;
  const resultatNet = resultatCourant - isEstime;

  const pct = (v) => (chiffreAffaires ? (v / chiffreAffaires) * 100 : 0);

  return {
    chiffreAffaires,
    autresChargesExternes,
    valeurAjoutee,
    impotsEtTaxes,
    remunerations,
    chargesSociales,
    totalChargesPersonnel,
    excedentBrutExploitation,
    dotationsAmortissements,
    resultatExploitation,
    produitsFinanciers,
    chargesFinancieres,
    resultatCourant,
    isEstime,
    resultatNet,
    pct,
    // conservés pour compatibilité avec le bilan
    produitsExploitation: chiffreAffaires,
    chargesExploitation: autresChargesExternes + totalChargesPersonnel + dotationsAmortissements,
  };
}

// Bilan simplifié — reconstitué à partir de la trésorerie et du résultat
// cumulé (une SARL réelle aurait aussi immobilisations/capital renseignés
// dans Paramètres ; ils sont intégrés ici s'ils existent).
export function buildBilan(agg, societe, soldeTresorerie, start, end) {
  const capitalSocial = Number(societe?.capitalSocial) || 0;
  const immobilisations = Number(societe?.immobilisationsNettes) || 0;
  const dettesDiverses = Number(societe?.dettesDiverses) || 0;
  const cr = buildCompteDeResultat(agg, societe, start, end);
  const resultatExercice = cr.resultatNet;
  const creancesClients = agg.produits
    .filter((p) => p.statut && p.statut !== 'Payée')
    .reduce((s, p) => s + p.ttc, 0);

  const actifImmobilise = immobilisations;
  const actifCirculant = soldeTresorerie + creancesClients;
  const totalActif = actifImmobilise + actifCirculant;

  const capitauxPropres = capitalSocial + resultatExercice;
  const dettes = dettesDiverses + Math.max(0, agg.tvaDue);
  const totalPassif = capitauxPropres + dettes;

  return {
    actifImmobilise,
    creancesClients,
    tresorerie: soldeTresorerie,
    actifCirculant,
    totalActif,
    capitalSocial,
    resultatExercice,
    capitauxPropres,
    dettesDiverses,
    tvaAPayer: Math.max(0, agg.tvaDue),
    dettes,
    totalPassif,
    equilibre: Math.abs(totalActif - totalPassif) < 0.5,
  };
}

export function soldeTresorerieAt(registre, date, soldeInitial = 0) {
  return registre
    .filter((l) => new Date(l.date) <= new Date(date))
    .reduce((s, l) => s + (l.sens === 'credit' ? l.ttc : -l.ttc), soldeInitial);
}

export function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

export function formatDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}
