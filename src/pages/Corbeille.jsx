import { useMemo, useState } from 'react';
import { Trash2, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR, formatDate } from '../lib/calc';
import { PageHeader, Card, Button, Badge, EmptyState } from '../components/ui';

const TYPE_LABEL = {
  mandat: 'Mandat',
  facture: 'Facture',
  frais: 'Note de frais',
  promesse: 'Promesse de vente',
  contact: 'Contact',
};

const TYPE_TONE = {
  mandat: 'teal',
  facture: 'brass',
  frais: 'default',
  promesse: 'rust',
  contact: 'default',
};

function describe(entry) {
  const d = entry.data;
  switch (entry.type) {
    case 'mandat':
      return { title: d.adresse || 'Mandat sans adresse', sub: [d.typeMandat, d.client].filter(Boolean).join(' · ') };
    case 'facture':
      return { title: `${d.numero || 'Facture'} — ${d.client || 'Client'}`, sub: d.montantTTC ? formatEUR(d.montantTTC) : '' };
    case 'frais':
      return { title: d.commercant || d.categorieLabel || 'Dépense', sub: d.montantTTC ? formatEUR(d.montantTTC) : '' };
    case 'promesse':
      return { title: d.bienAdresse || 'Promesse de vente', sub: [d.vendeur, d.acquereur].filter(Boolean).join(' → ') };
    case 'contact':
      return { title: d.societe || [d.prenom, d.nom].filter(Boolean).join(' ') || 'Contact', sub: d.email || d.telephone || '' };
    default:
      return { title: 'Élément', sub: '' };
  }
}

export default function Corbeille() {
  const { trash, restoreFromTrash, permanentlyDelete, emptyTrash } = useApp();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(
    () => (filter ? trash.filter((t) => t.type === filter) : trash),
    [trash, filter]
  );

  const counts = useMemo(() => {
    const c = {};
    trash.forEach((t) => { c[t.type] = (c[t.type] || 0) + 1; });
    return c;
  }, [trash]);

  function handleEmptyTrash() {
    if (confirm(`Supprimer définitivement les ${trash.length} élément${trash.length > 1 ? 's' : ''} de la corbeille ? Cette action est irréversible.`)) {
      emptyTrash();
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Récupération"
        title="Corbeille"
        description="Tout élément supprimé — mandat, facture, note de frais, promesse, contact — atterrit ici, restaurable à tout moment."
        action={
          trash.length > 0 && (
            <Button variant="danger" onClick={handleEmptyTrash}><Trash2 size={15} /> Vider la corbeille</Button>
          )
        }
      />

      {trash.length === 0 ? (
        <EmptyState icon={Trash2} title="Corbeille vide" description="Rien à récupérer pour l'instant — tout ce que vous supprimerez apparaîtra ici." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilter('')}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${!filter ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-soft border-line hover:bg-paper'}`}
            >
              Tout ({trash.length})
            </button>
            {Object.entries(counts).map(([type, n]) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${filter === type ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-soft border-line hover:bg-paper'}`}
              >
                {TYPE_LABEL[type] || type} ({n})
              </button>
            ))}
          </div>

          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Élément</th>
                  <th className="px-5 py-3 font-medium">Supprimé le</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((entry) => {
                  const { title, sub } = describe(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-paper-raised/60">
                      <td className="px-5 py-3"><Badge tone={TYPE_TONE[entry.type]}>{TYPE_LABEL[entry.type] || entry.type}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="text-ink">{title}</div>
                        {sub && <div className="text-[11.5px] text-ink-faint">{sub}</div>}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(entry.deletedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => restoreFromTrash(entry.id)} className="p-2 rounded-lg text-ink-faint hover:text-teal hover:bg-teal-soft" title="Restaurer">
                            <RotateCcw size={15} />
                          </button>
                          <button onClick={() => permanentlyDelete(entry.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer définitivement">
                            <XCircle size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <p className="text-[11.5px] text-ink-faint mt-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> La suppression définitive est irréversible — seule la restauration ramène l'élément dans son module d'origine.
          </p>
        </>
      )}
    </div>
  );
}
