import { useMemo } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aggregatePeriod, formatEUR } from '../lib/calc';
import { PageHeader, Card, StatCard, Button, EmptyState } from '../components/ui';

function monthBounds(offset) {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
}

export default function Reporting() {
  const { registre, factures, mandats } = useApp();
  const hasData = registre.length > 0;

  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const mb = monthBounds(11 - i);
        const a = aggregatePeriod(registre, mb.start, mb.end);
        return { mois: mb.label, produits: Math.round(a.totalProduitsHT), charges: Math.round(a.totalChargesHT) };
      }),
    [registre]
  );

  const facturesConclues = factures.filter((f) => f.statut === 'Payée');
  const honoraireMoyen = facturesConclues.length ? facturesConclues.reduce((s, f) => s + f.montantHT, 0) / facturesConclues.length : 0;
  const mandatsClotures = mandats.filter((m) => ['Vendu', 'Loué'].includes(m.statut));
  const tauxTransformation = mandats.length ? (mandatsClotures.length / mandats.length) * 100 : 0;

  function exportReport() {
    window.print();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage d'activité"
        title="Rapports"
        description="Indicateurs clés de performance commerciale et financière."
        action={hasData && <Button variant="outline" onClick={exportReport}><Download size={14} /> Export PDF</Button>}
      />

      {!hasData ? (
        <EmptyState icon={BarChart3} title="Pas encore assez de données" description="Les indicateurs apparaîtront dès vos premières factures et mandats." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Honoraires moyens / dossier" value={formatEUR(honoraireMoyen)} />
            <StatCard label="Taux de transformation" value={`${tauxTransformation.toFixed(0)} %`} sub={`${mandatsClotures.length} / ${mandats.length} mandats`} />
            <StatCard label="Mandats actifs" value={mandats.filter((m) => m.statut === 'En cours').length} />
            <StatCard label="Factures émises" value={factures.length} />
          </div>

          <Card>
            <h3 className="font-display text-[16px] text-ink mb-4">Produits vs charges — 12 mois</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#ebe8e0" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 10.5, fill: '#8992a0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: '#8992a0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e2ded4', fontSize: 12.5 }} />
                <Bar dataKey="produits" name="Produits" fill="#1f4e4a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="charges" name="Charges" fill="#ac5236" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
