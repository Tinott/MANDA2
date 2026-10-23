import { useMemo, useState } from 'react';
import { Plus, CalendarClock, Pencil, Trash2, UploadCloud, Loader2, Sparkles, AlertCircle, FileText, BellRing } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR, formatDate, calcHonoraires } from '../lib/calc';
import { hasApiKey, extractActeAI } from '../lib/ai';
import { buildAlerts } from '../lib/relances';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState, BulkDeleteButton, StatCard } from '../components/ui';

const STATUTS = ['En cours', 'Conditions levées', 'Réitéré', 'Caduque'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
}

function DateCell({ date, resolved }) {
  if (!date) return <span className="text-ink-faint">—</span>;
  const d = daysUntil(date);
  let tone = 'default';
  if (!resolved) {
    if (d < 0) tone = 'rust';
    else if (d <= 15) tone = 'rust';
    else if (d <= 30) tone = 'brass';
  } else tone = 'teal';
  const suffix = resolved ? '' : d < 0 ? ` · dépassée` : d === 0 ? ' · auj.' : ` · J-${d}`;
  return <Badge tone={tone}>{formatDate(date)}{suffix}</Badge>;
}

const EMPTY = {
  mandatId: '', bienAdresse: '', vendeur: '', acquereur: '', notaire: '', prixVente: '',
  honorairesHT: '', redevable: 'acquereur', depotGarantie: '',
  dateSignaturePromesse: '', dateLimiteConditionsSuspensives: '', dateReiterationPrevue: '',
  dateProchaineRelance: '', statut: 'En cours', notes: '',
};

export default function Promesses() {
  const { promesses, societe, updatePromesse, removePromesse } = useApp();
  const [editing, setEditing] = useState(null); // null | 'new' | objet
  const [extractOpen, setExtractOpen] = useState(false);

  const enCours = promesses.filter((p) => ['En cours', 'Conditions levées'].includes(p.statut));
  const volume = enCours.reduce((s, p) => s + (Number(p.prixVente) || 0), 0);
  const honorairesAttendus = enCours.reduce((s, p) => s + (Number(p.honorairesHT) || 0), 0);
  const alerts = buildAlerts({ promesses });

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline sécurisé"
        title="Promesses de vente"
        description="Toutes les échéances d'un coup d'œil : conditions suspensives, réitération, relances client et honoraires attendus — avec alertes automatiques."
        action={
          <div className="flex gap-2">
            <BulkDeleteButton type="promesse" items={promesses} label="promesse" />
            <Button variant="outline" onClick={() => setExtractOpen(true)}><UploadCloud size={15} /> Depuis une promesse PDF</Button>
            <Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouvelle promesse</Button>
          </div>
        }
      />

      {promesses.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <StatCard label="Promesses en cours" value={String(enCours.length)} />
          <StatCard label="Volume sous promesse" value={formatEUR(volume)} />
          <StatCard label="Honoraires attendus (HT)" value={formatEUR(honorairesAttendus)} />
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.slice(0, 4).map((a, i) => (
            <div key={i} className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-[12.5px] ${a.level === 'critical' || a.level === 'urgent' ? 'bg-rust/5 border-rust/20 text-rust' : 'bg-brass-soft/40 border-brass/20 text-brass-deep'}`}>
              <BellRing size={14} className="shrink-0" />
              <span className="font-medium">{a.label}</span>
              <span className="text-ink-faint hidden sm:inline">— {a.detail}</span>
            </div>
          ))}
        </div>
      )}

      {promesses.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Aucune promesse suivie" description="Ajoutez une promesse manuellement ou déposez le PDF signé : l'IA en extrait les parties, le prix, les dates et les honoraires." action={<Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouvelle promesse</Button>} />
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[1100px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                <th className="px-4 py-3 font-medium">Bien</th>
                <th className="px-4 py-3 font-medium">Vendeur → Acquéreur</th>
                <th className="px-4 py-3 font-medium text-right">Prix</th>
                <th className="px-4 py-3 font-medium text-right">Honoraires HT</th>
                <th className="px-4 py-3 font-medium">Signature</th>
                <th className="px-4 py-3 font-medium">Cond. suspensives</th>
                <th className="px-4 py-3 font-medium">Réitération</th>
                <th className="px-4 py-3 font-medium">Relance</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {promesses.map((p) => (
                <tr key={p.id} className="hover:bg-paper-raised/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{p.bienAdresse || '—'}</div>
                    {p.notaire && <div className="text-[11px] text-ink-faint">Notaire : {p.notaire}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.vendeur || '—'}<br /><span className="text-ink-faint">→</span> {p.acquereur || '—'}</td>
                  <td className="px-4 py-3 text-right tabular font-medium text-ink">{formatEUR(p.prixVente)}</td>
                  <td className="px-4 py-3 text-right tabular text-ink">
                    {p.honorairesHT ? formatEUR(p.honorairesHT) : <span className="text-ink-faint">—</span>}
                    {p.honorairesHT ? <div className="text-[10.5px] text-ink-faint">{formatEUR(Number(p.honorairesHT) * (1 + (societe.tauxTvaDefaut || 20) / 100))} TTC · {p.redevable === 'vendeur' ? 'vendeur' : 'acquéreur'}</div> : null}
                  </td>
                  <td className="px-4 py-3">{p.dateSignaturePromesse ? formatDate(p.dateSignaturePromesse) : '—'}</td>
                  <td className="px-4 py-3"><DateCell date={p.dateLimiteConditionsSuspensives} resolved={['Conditions levées', 'Réitéré'].includes(p.statut)} /></td>
                  <td className="px-4 py-3"><DateCell date={p.dateReiterationPrevue} resolved={p.statut === 'Réitéré'} /></td>
                  <td className="px-4 py-3"><DateCell date={p.dateProchaineRelance} resolved={false} /></td>
                  <td className="px-4 py-3">
                    <Select value={p.statut} onChange={(e) => updatePromesse(p.id, { statut: e.target.value })} className="text-[11.5px] py-1">
                      {STATUTS.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier"><Pencil size={14} /></button>
                    <button onClick={() => removePromesse(p.id)} className="p-1.5 rounded-lg text-ink-faint hover:text-rust hover:bg-rust/10" title="Supprimer"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && <PromesseModal initial={editing === 'new' ? EMPTY : editing} onClose={() => setEditing(null)} />}
      {extractOpen && <ExtractModal onClose={() => setExtractOpen(false)} onExtracted={(f) => { setExtractOpen(false); setEditing({ ...EMPTY, ...f }); }} />}
    </div>
  );
}

function PromesseModal({ initial, onClose }) {
  const { mandats, societe, addPromesse, updatePromesse } = useApp();
  const [form, setForm] = useState(initial);
  const isNew = !initial.id;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function linkMandat(id) {
    const m = mandats.find((x) => x.id === id);
    const patch = { mandatId: id };
    if (m) {
      patch.bienAdresse = form.bienAdresse || m.adresse || '';
      patch.vendeur = form.vendeur || m.client || '';
      if (!form.honorairesHT && (form.prixVente || m.prixVente)) {
        patch.honorairesHT = Math.round(calcHonoraires(societe.bareme, form.prixVente || m.prixVente));
      }
    }
    set(patch);
  }

  function autoHonoraires() {
    if (!form.prixVente) return;
    set({ honorairesHT: Math.round(calcHonoraires(societe.bareme, form.prixVente)) });
  }

  function save(e) {
    e.preventDefault();
    const rec = { ...form, prixVente: Number(form.prixVente) || 0, honorairesHT: Number(form.honorairesHT) || 0 };
    if (isNew) addPromesse(rec); else updatePromesse(initial.id, rec);
    onClose();
  }

  return (
    <Modal open title={isNew ? "Nouvelle promesse" : "Modifier la promesse"} onClose={onClose} width="max-w-3xl">
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        <Field label="Mandat associé (facultatif)">
          <Select value={form.mandatId} onChange={(e) => linkMandat(e.target.value)}>
            <option value="">— Aucun —</option>
            {mandats.map((m) => <option key={m.id} value={m.id}>{m.adresse || m.client}</option>)}
          </Select>
        </Field>
        <Field label="Adresse du bien"><Input value={form.bienAdresse} onChange={(e) => set({ bienAdresse: e.target.value })} required /></Field>
        <Field label="Vendeur"><Input value={form.vendeur} onChange={(e) => set({ vendeur: e.target.value })} /></Field>
        <Field label="Acquéreur"><Input value={form.acquereur} onChange={(e) => set({ acquereur: e.target.value })} /></Field>
        <Field label="Notaire"><Input value={form.notaire || ''} onChange={(e) => set({ notaire: e.target.value })} placeholder="Maître …, notaire à …" /></Field>
        <Field label="Prix de vente (€)"><Input type="number" value={form.prixVente} onChange={(e) => set({ prixVente: e.target.value })} /></Field>
        <Field label={<span>Honoraires HT (€) <button type="button" onClick={autoHonoraires} className="text-brass text-[11px] underline ml-1">calculer au barème</button></span>}>
          <Input type="number" value={form.honorairesHT} onChange={(e) => set({ honorairesHT: e.target.value })} />
        </Field>
        <Field label="Honoraires à la charge de">
          <Select value={form.redevable} onChange={(e) => set({ redevable: e.target.value })}>
            <option value="acquereur">Acquéreur</option>
            <option value="vendeur">Vendeur</option>
          </Select>
        </Field>
        <Field label="Dépôt de garantie (€)"><Input type="number" value={form.depotGarantie || ''} onChange={(e) => set({ depotGarantie: e.target.value })} /></Field>
        <Field label="Date de signature de la promesse"><Input type="date" value={form.dateSignaturePromesse} onChange={(e) => set({ dateSignaturePromesse: e.target.value })} /></Field>
        <Field label="Date limite des conditions suspensives"><Input type="date" value={form.dateLimiteConditionsSuspensives} onChange={(e) => set({ dateLimiteConditionsSuspensives: e.target.value })} /></Field>
        <Field label="Date de réitération prévue"><Input type="date" value={form.dateReiterationPrevue} onChange={(e) => set({ dateReiterationPrevue: e.target.value })} /></Field>
        <Field label="Prochaine relance client"><Input type="date" value={form.dateProchaineRelance || ''} onChange={(e) => set({ dateProchaineRelance: e.target.value })} /></Field>
        <Field label="Statut">
          <Select value={form.statut} onChange={(e) => set({ statut: e.target.value })}>{STATUTS.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes de suivi"><Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Banque de l'acquéreur, pièces attendues, points d'attention…" /></Field>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>Annuler</Button>
          <Button variant="brass" type="submit">{isNew ? 'Créer la promesse' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ExtractModal({ onClose, onExtracted }) {
  const { societe } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const { extractPdfText, parseActeFields } = await import('../lib/pdfExtract');
      const text = await extractPdfText(file);
      let fields = {};
      if (hasApiKey(societe)) {
        const ai = await extractActeAI(societe, text);
        fields = {
          bienAdresse: ai.bienAdresse || '', vendeur: ai.vendeur || '', acquereur: ai.acquereur || '',
          prixVente: ai.prixVente || '', notaire: ai.notaire || '',
          dateSignaturePromesse: ai.dateSignature || '', dateReiterationPrevue: ai.dateReiteration || '',
          honorairesHT: ai.honorairesMontantTTC ? Math.round(ai.honorairesMontantTTC / (1 + (societe.tauxTvaDefaut || 20) / 100)) : '',
          redevable: ai.honorairesRedevable || 'acquereur',
        };
      } else {
        const h = parseActeFields(text);
        fields = { prixVente: h.prix || '', vendeur: h.vendeur || '', acquereur: h.acquereur || '' };
      }
      onExtracted(fields);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <Modal open title="Extraire depuis une promesse PDF" onClose={onClose}>
      <p className="text-[13px] text-ink-soft mb-4">
        Déposez la promesse signée : {hasApiKey(societe) ? "l'IA" : 'une lecture heuristique (ajoutez une clé API dans Paramètres pour une extraction complète)'} en extrait les parties, le prix, les dates et les honoraires. Relisez systématiquement avant d'enregistrer.
      </p>
      {error && <div className="mb-3 flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {error}</div>}
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass/50 hover:bg-brass-soft/20">
        {busy ? <Loader2 size={22} className="animate-spin text-brass" /> : <FileText size={22} className="text-ink-faint" />}
        <span className="text-[13px] text-ink-soft">{busy ? 'Lecture et extraction en cours…' : 'Cliquer pour choisir le PDF'}</span>
        <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {hasApiKey(societe) && <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-faint"><Sparkles size={12} className="text-brass" /> Extraction par IA activée</div>}
    </Modal>
  );
}
