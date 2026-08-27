import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { soldeTresorerieAt, formatEUR } from '../lib/calc';
import { PageHeader, Card, StatCard, EmptyState } from '../components/ui';

function daysBack(n) {
  const arr = [];
  const today = new Date();
  for (let i = n; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

export default function Tresorerie() {
  const { registre, societe, factures } = useApp();
  const hasData = registre.length > 0;

  const historique = useMemo(() => {
    const days = daysBack(89);
    return days
      .filter((_, i) => i % 3 === 0)
      .map((d) => ({ date: d.slice(5), solde: soldeTresorerieAt(registre, d, societe.soldeTresorerieInitial) }));
  }, [registre, societe]);

  const soldeActuel = historique.length ? historique[historique.length - 1].solde : societe.soldeTresorerieInitial;

  const attendu = factures
    .filter((f) => ['Émise', 'Envoyée'].includes(f.statut))
    .reduce((s, f) => s + f.montantTTC, 0);
  const enRetard = factures.filter((f) => f.statut === 'En retard').reduce((s, f) => s + f.montantTTC, 0);

  const previsionnel = [
    { horizon: 'Aujourd\u2019hui', solde: soldeActuel },
    { horizon: '+30 jours', solde: soldeActuel + attendu * 0.6 },
    { horizon: '+60 jours', solde: soldeActuel + attendu * 0.85 },
    { horizon: '+90 jours', solde: soldeActuel + attendu },
  ];

  return (
    <div>
      <PageHeader eyebrow="Pilotage" title="Trésorerie" description="Position de trésorerie réalisée et prévisionnelle à 30, 60 et 90 jours." />

      {!hasData ? (
        <EmptyState icon={Wallet} title="Pas encore de mouvement" description="La trésorerie se construit à partir de vos factures encaissées et de vos dépenses." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Solde actuel" value={formatEUR(soldeActuel)} tone={soldeActuel >= 0 ? 'good' : 'warn'} />
            <StatCard label="Attendu (émises/envoyées)" value={formatEUR(attendu)} />
            <StatCard label="En retard de paiement" value={formatEUR(enRetard)} tone={enRetard ? 'warn' : 'default'} />
            <StatCard label="Solde prévisionnel à 90j" value={formatEUR(soldeActuel + attendu)} tone="good" />
          </div>

          <Card className="mb-5">
            <h3 className="font-display text-[16px] text-ink mb-4">Évolution — 90 derniers jours</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={historique} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#ebe8e0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: '#8992a0' }} axisLine={false} tickLine={false} interval={5} />
                <YAxis tick={{ fontSize: 10.5, fill: '#8992a0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <ReferenceLine y={0} stroke="#ac5236" strokeDasharray="3 3" />
                <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e2ded4', fontSize: 12.5 }} />
                <Line type="monotone" dataKey="solde" stroke="#1f4e4a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-display text-[16px] text-ink mb-4">Prévisionnel</h3>
            <div className="grid grid-cols-4 gap-4">
              {previsionnel.map((p, i) => (
                <div key={p.horizon} className="text-center">
                  <div className="text-[11px] uppercase tracking-wide text-ink-faint font-medium mb-1.5">{p.horizon}</div>
                  <div className="font-display text-[18px] tabular flex items-center justify-center gap-1.5">
                    {i > 0 && (p.solde >= previsionnel[i - 1].solde ? <TrendingUp size={14} className="text-teal" /> : <TrendingDown size={14} className="text-rust" />)}
                    {formatEUR(p.solde)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
