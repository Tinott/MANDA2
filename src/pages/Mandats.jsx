
import { useState } from 'react';
import { Plus, Building2, MapPin, Trash2, Pencil, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR, formatDate } from '../lib/calc';
import { MANDAT_TYPES } from '../lib/seed';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, statusTone, EmptyState, BulkDeleteButton } from '../components/ui';

const EMPTY = {
  adresse: '', typeBien: '', typeMandat: 'Vente', client: '', prixVente: '', loyerAnnuel: '',
  surface: '', dpe: '', dateDebutMandat: '', dateFinMandat: '', description: '',
};

const TYPE_TONE = { Vente: 'teal', Location: 'brass', Gestion: 'default', Recherche: 'rust' };

export default function Mandats() {
  const { mandats, addMandat, updateMandat, removeMandat } = useApp();
  const [editing, setEditing] = useState(null); // null = fermé, 'new' = création, objet = édition

  return (
    <div>
      <PageHeader
        eyebrow="Portefeuille"
        title="Mandats & biens"
        description="Vente, location, gestion, ou recherche pour le compte d'un acquéreur seul — chaque mandat reste modifiable à tout moment."
        action={
          <div className="flex gap-2">
            <BulkDeleteButton type="mandat" items={mandats} label="mandat" />
            <Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouveau mandat</Button>
          </div>
        }
      />

      {mandats.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun mandat enregistré"
          description="Créez votre premier mandat pour commencer à facturer des honoraires et suivre un bien."
          action={<Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Créer un mandat</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mandats.map((m) => (
            <Card key={m.id} className="animate-rise flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <Badge tone={TYPE_TONE[m.typeMandat] || 'default'}>
                  {m.typeMandat === 'Recherche' && <Search size={11} />} {m.typeMandat}
                </Badge>
                <Badge tone={statusTone(m.statut)}>{m.statut}</Badge>
              </div>
              <div className="mt-3 flex items-start gap-2">
                <MapPin size={15} className="text-ink-faint mt-0.5 shrink-0" />
                <div>
                  <div className="font-display text-[15.5px] text-ink leading-snug">
                    {m.typeMandat === 'Recherche' ? (m.description ? m.description.slice(0, 60) : 'Recherche en cours') : (m.adresse || 'Adresse non renseignée')}
                  </div>
                  <div className="text-[12px] text-ink-faint mt-0.5">{m.typeBien}{m.surface ? ` · ${m.surface} m²` : ''}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-line-soft flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">{m.client || 'Client non renseigné'}</span>
                <span className="tabular font-medium text-ink">
                  {formatEUR(m.typeMandat === 'Location' ? m.loyerAnnuel : m.prixVente)}
                  {m.typeMandat === 'Location' && <span className="text-ink-faint">/an</span>}
                </span>
              </div>
              {m.dateFinMandat && (
                <div className="text-[11.5px] text-ink-faint mt-2">Échéance du mandat : {formatDate(m.dateFinMandat)}</div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <Select value={m.statut} onChange={(e) => updateMandat(m.id, { statut: e.target.value })} className="text-[12px] py-1.5">
                  <option>En cours</option>
                  <option>Compromis signé</option>
                  <option>Vendu</option>
                  <option>Loué</option>
                  <option>Clôturé</option>
                </Select>
                <button onClick={() => setEditing(m)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft shrink-0" title="Modifier">
                  <Pencil size={15} />
                </button>
                <button onClick={() => removeMandat(m.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft shrink-0" title="Supprimer">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MandatEditor open={editing !== null} mandat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function MandatEditor({ open, mandat, onClose }) {
  const { addMandat, updateMandat } = useApp();
  const isEdit = Boolean(mandat);
  const [form, setForm] = useState(mandat || EMPTY);
  const [openedFor, setOpenedFor] = useState(mandat?.id || null);

  if (open && (mandat?.id || null) !== openedFor) {
    setForm(mandat || EMPTY);
    setOpenedFor(mandat?.id || null);
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const recherche = form.typeMandat === 'Recherche';

  function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      prixVente: Number(form.prixVente) || 0,
      loyerAnnuel: Number(form.loyerAnnuel) || 0,
      surface: Number(form.surface) || 0,
    };
    if (isEdit) {
      updateMandat(mandat.id, payload);
    } else {
      addMandat(payload);
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le mandat' : 'Nouveau mandat'} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type de mandat" required>
            <Select value={form.typeMandat} onChange={set('typeMandat')}>
              {MANDAT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Type de bien">
            <Input value={form.typeBien} onChange={set('typeBien')} placeholder="Appartement, local commercial…" />
          </Field>
        </div>

        {recherche && (
          <div className="rounded-lg border border-rust/20 bg-rust-soft/40 px-3.5 py-2.5 text-[12px] text-ink">
            Mandat de recherche : vous représentez uniquement l'acquéreur ou le preneur, pas le vendeur.
            L'adresse du bien peut rester vide tant qu'aucun bien n'est identifié.
          </div>
        )}

        <Field label={recherche ? 'Adresse du bien ciblé (si identifié)' : 'Adresse du bien'} required={!recherche}>
          <Input value={form.adresse} onChange={set('adresse')} placeholder="Numéro, rue, code postal, ville" />
        </Field>
        <Field label={recherche ? 'Client (acquéreur / preneur)' : 'Client (vendeur / bailleur)'}>
          <Input value={form.client} onChange={set('client')} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label={recherche ? 'Budget d\u2019acquisition' : form.typeMandat === 'Location' ? 'Loyer annuel' : 'Prix de vente estimé'}>
            <Input type="number" value={form.typeMandat === 'Location' ? form.loyerAnnuel : form.prixVente}
              onChange={set(form.typeMandat === 'Location' ? 'loyerAnnuel' : 'prixVente')} />
          </Field>
          <Field label="Surface (m²)">
            <Input type="number" value={form.surface} onChange={set('surface')} />
          </Field>
          <Field label="DPE">
            <Select value={form.dpe} onChange={set('dpe')}>
              <option value="">—</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date de signature du mandat">
            <Input type="date" value={form.dateDebutMandat} onChange={set('dateDebutMandat')} />
          </Field>
          <Field label="Échéance du mandat">
            <Input type="date" value={form.dateFinMandat} onChange={set('dateFinMandat')} />
          </Field>
        </div>
        <Field label={recherche ? 'Critères recherchés' : 'Notes'}>
          <Textarea value={form.description} onChange={set('description')} placeholder={recherche ? 'Type de bien, secteur, budget, contraintes…' : 'Précisions utiles au dossier…'} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer le mandat'}</Button>
        </div>
      </form>
    </Modal>
  );
}
