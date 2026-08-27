import { useMemo, useState } from 'react';
import { Plus, CalendarClock, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR, formatDate } from '../lib/calc';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState } from '../components/ui';

const STATUTS = ['En cours', 'Conditions levées', 'Réitéré', 'Caduque'];

function addDays(dateStr, n) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
}

function deadlineTone(dateStr, resolved) {
  if (!dateStr) return 'default';
  if (resolved) return 'teal';
  const d = daysUntil(dateStr);
  if (d === null) return 'default';
  if (d < 0) return 'rust';
  if (d <= 10) return 'rust';
  if (d <= 30) return 'brass';
  return 'default';
}

function deadlineLabel(dateStr, resolved) {
  if (!dateStr) return '—';
  const d = daysUntil(dateStr);
  if (resolved) return formatDate(dateStr);
  if (d < 0) return `${formatDate(dateStr)} — dépassée`;
  if (d === 0) return `${formatDate(dateStr)} — aujourd'hui`;
  return `${formatDate(dateStr)} — J-${d}`;
}

const EMPTY = {
  mandatId: '', bienAdresse: '', vendeur: '', acquereur: '', prixVente: '',
  dateSignaturePromesse: '', dateLimiteConditionsSuspensives: '', dateReiterationPrevue: '',
  statut: 'En cours', notes: '',
};

export default function Promesses() {
  const { promesses, mandats, removePromesse } = useApp();
  const [editing, setEditing] = useState(null); // null fermé | 'new' | objet

  const sorted = useMemo(() => {
    const withScore = promesses.map((p) => {
      const candidates = [p.dateLimiteConditionsSuspensives, p.dateReiterationPrevue]
        .filter(Boolean)
        .filter((d) => !['Réitéré', 'Caduque'].includes(p.statut));
      const next = candidates.length ? candidates.sort()[0] : null;
      return { ...p, _next: next };
    });
    return withScore.sort((a, b) => {
      if (a._next && b._next) return a._next < b._next ? -1 : 1;
      if (a._next) return -1;
      if (b._next) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [promesses]);

  const alertes = sorted.filter((p) => p._next && daysUntil(p._next) !== null && daysUntil(p._next) <= 10 && !['Réitéré', 'Caduque'].includes(p.statut));

  return (
    <div>
      <PageHeader
        eyebrow="Suivi juridique"
        title="Promesses de vente"
        description="Une fois une promesse signée, suivez ici ses dates butoir — levée des conditions suspensives, réitération prévue — pour ne rien laisser filer."
        action={<Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouvelle promesse</Button>}
      />

      {alertes.length > 0 && (
        <div className="mb-5 rounded-lg border border-rust/25 bg-rust-soft/50 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-rust mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-ink">
            <span className="font-medium">{alertes.length} échéance{alertes.length > 1 ? 's' : ''} à moins de 10 jours</span>
            {' '}— {alertes.map((a) => a.bienAdresse || 'bien sans adresse').join(', ')}.
          </div>
        </div>
      )}

      {promesses.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Aucune promesse suivie"
          description="Dès qu'une promesse ou un compromis est signé, enregistrez-le ici pour suivre ses échéances clés."
          action={<Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Enregistrer une promesse</Button>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                <th className="px-5 py-3 font-medium">Bien</th>
                <th className="px-5 py-3 font-medium">Parties</th>
                <th className="px-5 py-3 font-medium text-right">Prix</th>
                <th className="px-5 py-3 font-medium">Conditions susp. — au plus tard le</th>
                <th className="px-5 py-3 font-medium">Réitération prévue</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {sorted.map((p) => {
                const resolved = ['Réitéré', 'Caduque'].includes(p.statut);
                return (
                  <tr key={p.id} className="hover:bg-paper-raised/60">
                    <td className="px-5 py-3 text-ink max-w-[200px]">
                      <div className="truncate">{p.bienAdresse || '—'}</div>
                      {p.dateSignaturePromesse && (
                        <div className="text-[11px] text-ink-faint">
                          Signée le {formatDate(p.dateSignaturePromesse)} · rétractation SRU jusqu'au {formatDate(addDays(p.dateSignaturePromesse, 10))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft max-w-[160px]">
                      <div className="truncate">{p.vendeur || '—'}</div>
                      <div className="truncate text-ink-faint">{p.acquereur || '—'}</div>
                    </td>
                    <td className="px-5 py-3 text-right tabular text-ink">{p.prixVente ? formatEUR(p.prixVente) : '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={deadlineTone(p.dateLimiteConditionsSuspensives, resolved)}>
                        {deadlineLabel(p.dateLimiteConditionsSuspensives, resolved)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={deadlineTone(p.dateReiterationPrevue, resolved)}>
                        {deadlineLabel(p.dateReiterationPrevue, resolved)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{p.statut}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(p)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => removePromesse(p.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <PromesseEditor open={editing !== null} promesse={editing === 'new' ? null : editing} mandats={mandats} onClose={() => setEditing(null)} />
    </div>
  );
}

function PromesseEditor({ open, promesse, mandats, onClose }) {
  const { addPromesse, updatePromesse } = useApp();
  const isEdit = Boolean(promesse);
  const [form, setForm] = useState(promesse || EMPTY);
  const [openedFor, setOpenedFor] = useState(promesse?.id || null);

  if (open && (promesse?.id || null) !== openedFor) {
    setForm(promesse || EMPTY);
    setOpenedFor(promesse?.id || null);
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyMandat(id) {
    const m = mandats.find((mm) => mm.id === id);
    setForm((f) => ({
      ...f,
      mandatId: id,
      bienAdresse: m ? m.adresse : f.bienAdresse,
      vendeur: m ? m.client : f.vendeur,
      prixVente: m ? m.prixVente : f.prixVente,
    }));
  }

  function submit(e) {
    e.preventDefault();
    const payload = { ...form, prixVente: Number(form.prixVente) || 0 };
    if (isEdit) {
      updatePromesse(promesse.id, payload);
    } else {
      addPromesse(payload);
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier la promesse' : 'Nouvelle promesse de vente'} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        {mandats.length > 0 && (
          <Field label="Lier à un mandat" hint="Optionnel — pré-remplit bien, client et prix">
            <Select value={form.mandatId} onChange={(e) => applyMandat(e.target.value)}>
              <option value="">Aucun</option>
              {mandats.map((m) => <option key={m.id} value={m.id}>{m.adresse}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Adresse du bien" required>
          <Input value={form.bienAdresse} onChange={set('bienAdresse')} placeholder="Numéro, rue, code postal, ville" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendeur"><Input value={form.vendeur} onChange={set('vendeur')} /></Field>
          <Field label="Acquéreur"><Input value={form.acquereur} onChange={set('acquereur')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prix de vente"><Input type="number" value={form.prixVente} onChange={set('prixVente')} /></Field>
          <Field label="Statut">
            <Select value={form.statut} onChange={set('statut')}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Date de signature de la promesse" hint="Le délai de rétractation SRU (10 jours) sera calculé automatiquement">
          <Input type="date" value={form.dateSignaturePromesse} onChange={set('dateSignaturePromesse')} />
        </Field>
        {form.dateSignaturePromesse && (
          <div className="text-[11.5px] text-ink-faint -mt-2">
            Fin du délai de rétractation SRU : {formatDate(addDays(form.dateSignaturePromesse, 10))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Conditions suspensives — au plus tard le" hint="Date butoir de levée des CS">
            <Input type="date" value={form.dateLimiteConditionsSuspensives} onChange={set('dateLimiteConditionsSuspensives')} />
          </Field>
          <Field label="Date de réitération prévue" hint="Signature de l'acte authentique">
            <Input type="date" value={form.dateReiterationPrevue} onChange={set('dateReiterationPrevue')} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Conditions suspensives en cours, contact notaire…" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer la promesse'}</Button>
        </div>
      </form>
    </Modal>
  );
}
