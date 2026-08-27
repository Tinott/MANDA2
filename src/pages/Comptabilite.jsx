import { useMemo, useState } from 'react';
import { Download, BookOpen, FileBarChart, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { aggregatePeriod, buildCompteDeResultat, buildBilan, soldeTresorerieAt, chargesParCategorie, formatEUR, formatDate } from '../lib/calc';
import { DEPENSE_CATEGORIES } from '../lib/seed';
import { PageHeader, Card, Button, Field, Input, Badge, EmptyState } from '../components/ui';

function yearBounds(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export default function Comptabilite() {
  const { registre, societe, notesFrais, factures } = useApp();
  const currentYear = new Date().getFullYear();
  const [start, setStart] = useState(yearBounds(currentYear).start);
  const [end, setEnd] = useState(yearBounds(currentYear).end);
  const [showEtats, setShowEtats] = useState(false);

  const agg = useMemo(() => aggregatePeriod(registre, start, end), [registre, start, end]);
  const cr = useMemo(() => buildCompteDeResultat(agg, societe, start, end), [agg, societe, start, end]);
  const solde = soldeTresorerieAt(registre, end, societe.soldeTresorerieInitial);
  const bilan = useMemo(() => buildBilan(agg, societe, solde, start, end), [agg, societe, solde, start, end]);
  const parCategorie = chargesParCategorie(agg.charges);

  const hasData = registre.length > 0;

  function exportFEC() {
    const rows = [['JournalCode', 'JournalLib', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'EcritureLib', 'Debit', 'Credit']];
    agg.lignes.forEach((l) => {
      rows.push([
        l.sens === 'credit' ? 'VE' : 'AC',
        l.sens === 'credit' ? 'Ventes' : 'Achats',
        l.date.replaceAll('-', ''),
        l.compte,
        l.libelle,
        l.id,
        l.libelle,
        l.sens === 'debit' ? l.ht.toFixed(2) : '0.00',
        l.sens === 'credit' ? l.ht.toFixed(2) : '0.00',
      ]);
    });
    downloadCsv(rows, `FEC_${start}_${end}.csv`, ';');
  }

  function exportCsv() {
    const rows = [['Date', 'Libellé', 'Compte', 'Sens', 'Montant HT', 'TVA', 'Montant TTC']];
    agg.lignes.forEach((l) => rows.push([l.date, l.libelle, l.compte, l.sens, l.ht.toFixed(2), l.tva.toFixed(2), l.ttc.toFixed(2)]));
    downloadCsv(rows, `registre_${start}_${end}.csv`, ',');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Grand livre"
        title="Comptabilité"
        description="Le registre se met à jour automatiquement à chaque facture ou note de frais enregistrée."
      />

      {!hasData ? (
        <EmptyState icon={BookOpen} title="Rien à afficher pour l'instant" description="Émettez une facture ou enregistrez une note de frais pour voir le registre se construire." />
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Période — du"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="au"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
                <Button variant="outline" onClick={exportFEC}><Download size={14} /> Export FEC</Button>
                <Button variant="brass" onClick={() => setShowEtats(true)}><FileBarChart size={14} /> Générer bilan & CR</Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card><div className="text-[11px] uppercase text-ink-faint font-medium">Produits HT</div><div className="font-display text-[22px] mt-1.5 tabular">{formatEUR(agg.totalProduitsHT)}</div></Card>
            <Card><div className="text-[11px] uppercase text-ink-faint font-medium">Charges HT</div><div className="font-display text-[22px] mt-1.5 tabular">{formatEUR(agg.totalChargesHT)}</div></Card>
            <Card><div className="text-[11px] uppercase text-ink-faint font-medium">Résultat</div><div className={`font-display text-[22px] mt-1.5 tabular ${agg.resultat >= 0 ? 'text-teal' : 'text-rust'}`}>{formatEUR(agg.resultat)}</div></Card>
            <Card><div className="text-[11px] uppercase text-ink-faint font-medium">TVA due</div><div className="font-display text-[22px] mt-1.5 tabular">{formatEUR(agg.tvaDue)}</div></Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2 ledger-bg" padded={false}>
              <div className="px-5 pt-5 pb-3">
                <h3 className="font-display text-[16px] text-ink">Registre — {agg.lignes.length} écriture{agg.lignes.length > 1 ? 's' : ''}</h3>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint border-y border-line bg-paper-raised sticky top-0">
                      <th className="px-5 py-2 font-medium">Date</th>
                      <th className="px-5 py-2 font-medium">Libellé</th>
                      <th className="px-5 py-2 font-medium">Compte</th>
                      <th className="px-5 py-2 font-medium text-right">HT</th>
                      <th className="px-5 py-2 font-medium text-right">TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {agg.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-2 text-ink-soft whitespace-nowrap">{formatDate(l.date)}</td>
                        <td className="px-5 py-2 text-ink truncate max-w-[220px]">{l.libelle}</td>
                        <td className="px-5 py-2 font-mono text-[11px] text-ink-faint">{l.compte}</td>
                        <td className={`px-5 py-2 text-right tabular ${l.sens === 'credit' ? 'text-teal' : 'text-rust'}`}>
                          {l.sens === 'credit' ? '+' : '−'}{formatEUR(l.ht)}
                        </td>
                        <td className="px-5 py-2 text-right tabular text-ink-soft">{formatEUR(l.ttc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-[16px] text-ink mb-4">Charges par nature</h3>
              {parCategorie.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">Aucune charge sur la période.</p>
              ) : (
                <ul className="space-y-3">
                  {parCategorie.sort((a, b) => b.montant - a.montant).map((c) => {
                    const cat = DEPENSE_CATEGORIES.find((d) => d.compte === c.compte);
                    const pct = agg.totalChargesHT ? (c.montant / agg.totalChargesHT) * 100 : 0;
                    return (
                      <li key={c.compte}>
                        <div className="flex justify-between text-[12.5px] mb-1">
                          <span className="text-ink-soft">{cat?.label || c.compte}</span>
                          <span className="tabular text-ink">{formatEUR(c.montant)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                          <div className="h-full bg-brass rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {showEtats && (
        <EtatsFinanciers agg={agg} cr={cr} bilan={bilan} start={start} end={end} societe={societe} onClose={() => setShowEtats(false)} />
      )}
    </div>
  );
}

function EtatsFinanciers({ agg, cr, bilan, start, end, societe, onClose }) {
  function printPdf() {
    window.print();
  }
  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto animate-rise">
      <div className="sticky top-0 bg-surface border-b border-line px-6 py-3.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-ink font-medium text-[13.5px]">
          <Sparkles size={15} className="text-brass" /> Bilan & compte de résultat — {start} au {end}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printPdf}><Download size={14} /> Imprimer / PDF</Button>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="text-center mb-10">
          <div className="font-display text-[24px] text-ink">{societe.nom}</div>
          <div className="text-[12px] text-ink-faint mt-1">SIRET {societe.siret} — États financiers du {start} au {end}</div>
        </div>

        <h2 className="font-display text-[19px] text-ink mb-3 border-b border-line pb-2">Compte de résultat</h2>
        <table className="w-full text-[13.5px] mb-10">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-ink-faint">
              <td className="py-1"></td>
              <td className="py-1 text-right w-24">Montant</td>
              <td className="py-1 text-right w-16">%</td>
            </tr>
          </thead>
          <tbody>
            <Row label="Chiffre d'affaires (honoraires HT)" value={cr.chiffreAffaires} pct={cr.pct(cr.chiffreAffaires)} />
            <Row label="Autres charges externes" value={-cr.autresChargesExternes} pct={cr.pct(cr.autresChargesExternes)} />
            <Row label="Valeur ajoutée" value={cr.valeurAjoutee} pct={cr.pct(cr.valeurAjoutee)} bold />
            <Row label="Impôts et taxes" value={-cr.impotsEtTaxes} pct={cr.pct(cr.impotsEtTaxes)} />
            <Row label="Rémunération du gérant" value={-cr.remunerations} pct={cr.pct(cr.remunerations)} />
            <Row label="Charges sociales" value={-cr.chargesSociales} pct={cr.pct(cr.chargesSociales)} />
            <Row label="Excédent brut d'exploitation" value={cr.excedentBrutExploitation} pct={cr.pct(cr.excedentBrutExploitation)} bold />
            <Row label="Dotations aux amortissements" value={-cr.dotationsAmortissements} pct={cr.pct(cr.dotationsAmortissements)} />
            <Row label="Résultat d'exploitation" value={cr.resultatExploitation} pct={cr.pct(cr.resultatExploitation)} bold />
            <Row label="Produits / charges financières" value={cr.produitsFinanciers - cr.chargesFinancieres} pct={cr.pct(cr.produitsFinanciers - cr.chargesFinancieres)} />
            <Row label="Résultat courant" value={cr.resultatCourant} pct={cr.pct(cr.resultatCourant)} bold />
            <Row label="Impôt sur les sociétés (estimé)" value={-cr.isEstime} pct={cr.pct(cr.isEstime)} />
            <Row label="Résultat net" value={cr.resultatNet} pct={cr.pct(cr.resultatNet)} bold accent />
          </tbody>
        </table>

        <h2 className="font-display text-[19px] text-ink mb-3 border-b border-line pb-2">Bilan simplifié</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint font-medium mb-2">Actif</div>
            <table className="w-full text-[13px]">
              <tbody>
                <Row label="Immobilisations nettes" value={bilan.actifImmobilise} />
                <Row label="Créances clients" value={bilan.creancesClients} />
                <Row label="Trésorerie" value={bilan.tresorerie} />
                <Row label="Total actif" value={bilan.totalActif} bold />
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint font-medium mb-2">Passif</div>
            <table className="w-full text-[13px]">
              <tbody>
                <Row label="Capital social" value={bilan.capitalSocial} />
                <Row label="Résultat de l'exercice" value={bilan.resultatExercice} />
                <Row label="TVA à payer" value={bilan.tvaAPayer} />
                <Row label="Autres dettes" value={bilan.dettesDiverses} />
                <Row label="Total passif" value={bilan.totalPassif} bold />
              </tbody>
            </table>
          </div>
        </div>

        <div className={`mt-6 text-[12px] text-center ${bilan.equilibre ? 'text-teal' : 'text-rust'}`}>
          {bilan.equilibre ? 'Actif = Passif — bilan équilibré.' : "Écart entre actif et passif — les immobilisations et dettes peuvent être précisées dans Paramètres."}
        </div>
        <p className="text-[11px] text-ink-faint text-center mt-8">
          États simplifiés générés automatiquement à titre de pilotage — à faire valider par votre expert-comptable avant tout dépôt officiel.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent, pct }) {
  return (
    <tr className={bold ? 'border-t border-line' : ''}>
      <td className={`py-2 ${bold ? 'font-medium text-ink' : 'text-ink-soft'}`}>{label}</td>
      <td className={`py-2 text-right tabular ${bold ? `font-semibold ${accent ? 'text-brass-deep' : 'text-ink'}` : 'text-ink'}`}>{formatEUR(value)}</td>
      {pct !== undefined && <td className="py-2 text-right tabular text-ink-faint text-[11.5px]">{pct.toFixed(1)}%</td>}
    </tr>
  );
}

function downloadCsv(rows, filename, sep) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
