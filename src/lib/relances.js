// Moteur d'alertes et de relances — pur, sans effet de bord.
// Produit la liste des actions à mener, triée par urgence, affichée sur le
// tableau de bord (AlertsCard) et en bandeau sur la page Promesses.

function days(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
}

export function buildAlerts({ promesses = [], mandats = [], factures = [], prospects = [], courriers = [] }) {
  const alerts = [];
  const push = (level, label, detail, link, d) => alerts.push({ level, label, detail, link, days: d });

  promesses.filter((p) => p.statut === 'En cours' || p.statut === 'Conditions levées').forEach((p) => {
    const bien = p.bienAdresse || 'Promesse';
    if (p.statut === 'En cours') {
      const d = days(p.dateLimiteConditionsSuspensives);
      if (d !== null && d < 0) push('critical', `Conditions suspensives dépassées — ${bien}`, `Échéance dépassée de ${-d} j. Vérifier la levée ou la caducité.`, '/promesses', d);
      else if (d !== null && d <= 15) push('urgent', `Conditions suspensives J-${d} — ${bien}`, `Relancer ${p.acquereur || "l'acquéreur"} (financement, due diligence).`, '/promesses', d);
    }
    const r = days(p.dateReiterationPrevue);
    if (r !== null && r < 0 && p.statut !== 'Réitéré') push('critical', `Réitération dépassée — ${bien}`, `Prévue le ${p.dateReiterationPrevue}. Contacter le notaire.`, '/promesses', r);
    else if (r !== null && r <= 30 && p.statut !== 'Réitéré') push('warn', `Réitération J-${r} — ${bien}`, `Préparer la facture d'honoraires${p.honorairesHT ? ` (${Number(p.honorairesHT).toLocaleString('fr-FR')} € HT)` : ''} et le décompte notaire.`, '/promesses', r);
    const rel = days(p.dateProchaineRelance);
    if (rel !== null && rel <= 0) push('urgent', `Relance prévue — ${bien}`, p.notes ? `Note : ${p.notes.slice(0, 80)}` : 'Relance client planifiée à faire aujourd’hui.', '/promesses', rel);
  });

  mandats.filter((m) => m.statut === 'En cours').forEach((m) => {
    const d = days(m.dateFinMandat);
    if (d !== null && d < 0) push('critical', `Mandat expiré — ${m.adresse || m.client}`, 'Faire signer un renouvellement ou un avenant de prorogation.', '/mandats', d);
    else if (d !== null && d <= 30) push('warn', `Mandat J-${d} — ${m.adresse || m.client}`, 'Échéance du mandat dans moins de 30 jours : anticiper le renouvellement.', '/mandats', d);
  });

  factures.forEach((f) => {
    if (f.statut === 'En retard') push('urgent', `Facture en retard — ${f.numero}`, `${f.client} · ${Number(f.montantTTC || 0).toLocaleString('fr-FR')} € TTC.`, '/facturation', -1);
    else if ((f.statut === 'Émise' || f.statut === 'Envoyée') && f.dateEmission) {
      const age = -days(f.dateEmission);
      if (age > 30) push('warn', `Facture > 30 j sans règlement — ${f.numero}`, `${f.client} · émise il y a ${age} j. Passer en « En retard » et relancer.`, '/facturation', -age);
    }
  });

  prospects.forEach((p) => {
    const d = days(p.prochaineRelance);
    if (d !== null && d <= 0 && !['Refus', 'Offre acceptée'].includes(p.statut)) {
      push('info', `Relance prospect — ${p.prospect || p.contact}`, p.prochaineAction || 'Relance planifiée à faire.', '/suivi', d);
    }
  });

  courriers.forEach((c) => {
    const d = days(c.dateRelancePrevue);
    if (d !== null && d <= 0 && c.statut !== 'Répondu') {
      push('info', `Relance courrier — ${c.societe || c.nomContact}`, c.objet || 'Relance de prospection à faire.', '/suivi', d);
    }
  });

  const order = { critical: 0, urgent: 1, warn: 2, info: 3 };
  return alerts.sort((a, b) => order[a.level] - order[b.level] || (a.days ?? 0) - (b.days ?? 0));
}
