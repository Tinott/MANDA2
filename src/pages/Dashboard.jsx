import { Link } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { FileText, Receipt, Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aggregatePeriod, formatEUR, soldeTresorerieAt, formatDate } from '../lib/calc';
import { PageHeader, StatCard, Card, Badge, statusTone, EmptyState, Button } from '../components/ui';

function monthBounds(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: start.toLocaleDateString('fr-FR', { month: 'short' }) };
}

export default function Dashboard() {
  const { societe, mandats, factures, notesFrais, registre, promesses } = useApp();

  const hasData = factures.length || notesFrais.length || mandats.length;
  const thisMonth = monthBounds(0);
  const agg = aggregatePeriod(registre, thisMonth.start, thisMonth.end);
  const solde = soldeTresorerieAt(registre, thisMonth.end, societe.soldeTresorerieInitial);

  const impayees = factures.filter((f) => ['Émise', 'Envoyée', 'En retard'].includes(f.statut));
  const mandatsEnCours = mandats.filter((m) => m.statut === 'En cours');

  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const mb = monthBounds(5 - i);
    const a = aggregatePeriod(registre, mb.start, mb.end);
    return { mois: mb.label, ca: Math.round(a.totalProduitsHT) };
  });

  const promessesActives = promesses.filter((p) => !['Réitéré', 'Caduque'].includes(p.statut));

  const echeances = [
    ...factures
      .filter((f) => f.dateEcheance && ['Émise', 'Envoyée'].includes(f.statut))
      .map((f) => ({ id: f.id, label: `Échéance facture ${f.numero}`, date: f.dateEcheance, type: 'facture' })),
    ...mandats
      .filter((m) => m.dateFinMandat)
      .map((m) => ({ id: m.id, label: `Fin de mandat — ${m.adresse}`, date: m.dateFinMandat, type: 'mandat' })),
    ...promessesActives
      .filter((p) => p.dateLimiteConditionsSuspensives)
      .map((p) => ({ id: `${p.id}-cs`, label: `Conditions suspensives — ${p.bienAdresse || 'bien'}`, date: p.dateLimiteConditionsSuspensives, type: 'promesse' })),
    ...promessesActives
      .filter((p) => p.dateReiterationPrevue)
      .map((p) => ({ id: `${p.id}-re`, label: `Réitération prévue — ${p.bienAdresse || 'bien'}`, date: p.dateReiterationPrevue, type: 'promesse' })),
  ]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Vue d'ensemble"
        title={`Bonjour${societe.contactNom ? `, ${societe.contactNom.split(' ')[0]}` : ''}`}
        description="L'essentiel de votre activité, à jour en temps réel."
      />

      {!hasData ? (
        <EmptyState
          icon={Building2}
          title="Commencez par créer votre premier mandat"
          description="Chaque module se remplit à partir de vos mandats, factures et notes de frais. Rien n'est pré-rempli : vous partez d'un espace propre."
          action={
            <div className="flex gap-3">
              <Link to="/mandats"><Button variant="brass">Créer un mandat</Button></Link>
              <Link to="/facturation"><Button variant="outline">Émettre une facture</Button></Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="CA du mois (HT)" value={formatEUR(agg.totalProduitsHT)} sub={thisMonth.start.slice(0, 7)} />
            <StatCard label="Trésorerie estimée" value={formatEUR(solde)} tone={solde >= 0 ? 'good' : 'warn'} />
            <StatCard label="Factures en attente" value={impayees.length} sub={formatEUR(impayees.reduce((s, f) => s + f.montantTTC, 0))} tone={impayees.length ? 'warn' : 'default'} />
            <StatCard label="Mandats en cours" value={mandatsEnCours.length} sub={`${mandats.length} au total`} />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2 ledger-bg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[16px] text-ink">Chiffre d'affaires — 6 derniers mois</h3>
                <Link to="/rapports" className="text-[12px] text-brass hover:text-brass-deep flex items-center gap-1">
                  Rapports complets <ArrowRight size={12} />
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ left: -20, right: 10 }}>
                  <defs>
                    <linearGradient id="ca" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a06a2c" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#a06a2c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#8992a0' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => formatEUR(v)}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2ded4', fontSize: 12.5 }}
                  />
                  <Area type="monotone" dataKey="ca" stroke="#a06a2c" strokeWidth={2} fill="url(#ca)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="font-display text-[16px] text-ink mb-4">Échéances à venir</h3>
              {echeances.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">Aucune échéance enregistrée.</p>
              ) : (
                <ul className="space-y-3">
                  {echeances.map((e) => (
                    <li key={e.id} className="flex items-start gap-2.5 text-[12.5px]">
                      <AlertTriangle size={14} className="text-brass mt-0.5 shrink-0" />
                      <div>
                        <div className="text-ink">{e.label}</div>
                        <div className="text-ink-faint">{formatDate(e.date)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[16px] text-ink">Dernières factures</h3>
                <Link to="/facturation" className="text-[12px] text-brass hover:text-brass-deep">Tout voir</Link>
              </div>
              {factures.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">Aucune facture pour le moment.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {factures.slice(0, 4).map((f) => (
                    <li key={f.id} className="flex items-center justify-between py-2.5 text-[13px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={14} className="text-ink-faint shrink-0" />
                        <span className="truncate">{f.client || 'Client'} — <span className="font-mono text-[11.5px] text-ink-faint">{f.numero}</span></span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular text-ink-soft">{formatEUR(f.montantTTC)}</span>
                        <Badge tone={statusTone(f.statut)}>{f.statut}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[16px] text-ink">Dernières notes de frais</h3>
                <Link to="/frais" className="text-[12px] text-brass hover:text-brass-deep">Tout voir</Link>
              </div>
              {notesFrais.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">Aucune dépense enregistrée.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {notesFrais.slice(0, 4).map((n) => (
                    <li key={n.id} className="flex items-center justify-between py-2.5 text-[13px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Receipt size={14} className="text-ink-faint shrink-0" />
                        <span className="truncate">{n.commercant || n.categorieLabel}</span>
                      </div>
                      <span className="tabular text-ink-soft shrink-0">{formatEUR(n.montantTTC)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
