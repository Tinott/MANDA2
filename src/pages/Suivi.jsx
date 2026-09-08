import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, UploadCloud, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, TrendingUp, Mail, Flame, Handshake, Users2, FolderPlus, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/calc';
import {
  PROSPECT_FIELDS, PROSPECT_SYNONYMS, PROSPECT_STATUTS, PROSPECT_INTERETS, PROSPECT_TYPES,
  COURRIER_FIELDS, COURRIER_SYNONYMS, COURRIER_STATUTS, COURRIER_TYPES_CONTACT, COURRIER_TYPES_ACTION,
} from '../lib/pipelineFields';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState, BulkDeleteButton } from '../components/ui';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(new Date().toDateString())) / 86400000);
}

function deadlineTone(dateStr, resolved) {
  if (!dateStr) return 'default';
  if (resolved) return 'teal';
  const d = daysUntil(dateStr);
  if (d === null) return 'default';
  if (d <= 7) return 'rust';
  if (d <= 21) return 'brass';
  return 'default';
}

// Un "dossier" de classement peut être un mandat existant OU un classeur
// libre créé à la volée, sans jamais nécessiter de mandat. Les deux sont
// fusionnés ici en une seule liste d'options pour le filtrage et la saisie.
function useDossierOptions() {
  const { mandats, dossiers, addDossier, removeDossier } = useApp();
  const libres = useMemo(() => dossiers.filter((d) => d.type === 'libre'), [dossiers]);

  const options = useMemo(
    () => [
      ...mandats.map((m) => ({ id: m.id, label: m.adresse || 'Mandat sans adresse', source: 'mandat' })),
      ...libres.map((d) => ({ id: d.id, label: d.nom, source: 'libre' })),
    ],
    [mandats, libres]
  );

  const labelFor = (id) => options.find((o) => o.id === id)?.label || null;
  const createDossierLibre = (nom, description) => addDossier({ type: 'libre', nom, description, statut: 'Ouvert' });
  const deleteDossierLibre = (id) => removeDossier(id);

  return { options, libres, labelFor, createDossierLibre, deleteDossierLibre };
}

export default function Suivi() {
  const { prospects, courriers } = useApp();
  const [tab, setTab] = useState('prospects');
  const [dossierFilter, setDossierFilter] = useState('');
  const [newDossierOpen, setNewDossierOpen] = useState(false);
  const { options, libres, labelFor, createDossierLibre, deleteDossierLibre } = useDossierOptions();

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline commercial"
        title="Suivi commercial"
        description="Prospects investisseurs et courriers de prospection, classés par dossier — un dossier peut être un mandat, ou un simple classeur libre sans mandat associé."
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setDossierFilter('')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${!dossierFilter ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-soft border-line hover:bg-paper'}`}
        >
          Tous les dossiers
        </button>
        {options.map((o) => (
          <div key={o.id} className="relative group">
            <button
              onClick={() => setDossierFilter(o.id)}
              className={`pl-3 pr-2.5 py-1.5 rounded-full text-[12px] font-medium border transition-colors flex items-center gap-1.5 ${dossierFilter === o.id ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-soft border-line hover:bg-paper'}`}
            >
              {o.source === 'libre' && <FolderPlus size={11} className="opacity-60" />}
              {o.label}
            </button>
            {o.source === 'libre' && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteDossierLibre(o.id); if (dossierFilter === o.id) setDossierFilter(''); }}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rust text-white items-center justify-center hidden group-hover:flex"
                title="Supprimer ce dossier"
              >
                <X size={9} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setDossierFilter('__none__')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${dossierFilter === '__none__' ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-soft border-line hover:bg-paper'}`}
        >
          Sans dossier
        </button>
        <button
          onClick={() => setNewDossierOpen(true)}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-dashed border-brass/50 text-brass-deep hover:bg-brass-soft/40 transition-colors flex items-center gap-1.5"
        >
          <Plus size={12} /> Nouveau dossier
        </button>
      </div>

      <div className="flex gap-1 mb-6 border border-line rounded-lg p-1 bg-surface w-fit">
        <button
          onClick={() => setTab('prospects')}
          className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${tab === 'prospects' ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}
        >
          <TrendingUp size={14} /> Prospects investisseurs
        </button>
        <button
          onClick={() => setTab('courriers')}
          className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${tab === 'courriers' ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}
        >
          <Mail size={14} /> Courriers & mails
        </button>
      </div>

      {tab === 'prospects'
        ? <ProspectsTab dossierFilter={dossierFilter} dossierOptions={options} dossierLabel={labelFor} createDossierLibre={createDossierLibre} />
        : <CourriersTab dossierFilter={dossierFilter} dossierOptions={options} dossierLabel={labelFor} createDossierLibre={createDossierLibre} />}

      <NewDossierModal open={newDossierOpen} onClose={() => setNewDossierOpen(false)} onCreate={createDossierLibre} />
    </div>
  );
}

function NewDossierModal({ open, onClose, onCreate }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    onCreate(nom.trim(), description.trim());
    setNom(''); setDescription(''); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau dossier">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-ink-soft">
          Un dossier libre — pas besoin d'un mandat signé. Utile pour une campagne de prospection sur un
          secteur, une recherche off-market, ou tout classement qui n'a pas encore (ou n'aura jamais) de mandat.
        </p>
        <Field label="Nom du dossier" required>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Prospection ZA Les Palettes, Aubagne" autoFocus />
        </Field>
        <Field label="Description" hint="Optionnel">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">Créer le dossier</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================= PROSPECTS ==================================

const PROSPECT_EMPTY = {
  dossierId: '', prospect: '', contact: '', type: '', broker: '', dateEnvoi: '', versionEnvoyee: '',
  statut: 'À contacter', niveauInteret: '', dernierEchange: '', prochaineRelance: '', retour: '',
  prixPropose: '', rendementPropose: '', documentsDemandes: '', prochaineAction: '',
};

function ProspectsTab({ dossierFilter, dossierOptions, dossierLabel, createDossierLibre }) {
  const { prospects, removeProspect, addProspectsBulk } = useApp();
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!dossierFilter) return prospects;
    if (dossierFilter === '__none__') return prospects.filter((p) => !p.dossierId);
    return prospects.filter((p) => p.dossierId === dossierFilter);
  }, [prospects, dossierFilter]);

  const kpis = useMemo(() => ({
    total: filtered.length,
    retours: filtered.filter((p) => ['Intéressé', 'Offre'].includes(p.statut)).length,
    chauds: filtered.filter((p) => p.niveauInteret === 'Fort').length,
    offres: filtered.filter((p) => p.statut === 'Offre').length,
    viaBrokers: filtered.filter((p) => p.broker?.trim()).length,
  }), [filtered]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <KpiBox label="Prospects" value={kpis.total} icon={Users2} />
        <KpiBox label="Retours / intéressés" value={kpis.retours} icon={TrendingUp} />
        <KpiBox label="Prospects chauds" value={kpis.chauds} icon={Flame} tone="rust" />
        <KpiBox label="Offres" value={kpis.offres} icon={Handshake} tone="teal" />
        <KpiBox label="Via brokers" value={kpis.viaBrokers} icon={Users2} />
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <BulkDeleteButton type="prospect" items={filtered} label="prospect" />
        <Button variant="outline" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>
        <Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouveau prospect</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Aucun prospect enregistré"
          description="Ajoutez vos prospects investisseurs un par un, ou importez d'un coup votre tableau de suivi Excel."
          action={<Button variant="brass" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                <th className="px-5 py-3 font-medium">Prospect</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Intérêt</th>
                <th className="px-5 py-3 font-medium">Prochaine relance</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-paper-raised/60">
                  <td className="px-5 py-3 text-ink max-w-[180px]">
                    <div className="truncate font-medium">{p.prospect || '—'}</div>
                    {p.dossierId && dossierLabel(p.dossierId) && <div className="text-[11px] text-ink-faint truncate">{dossierLabel(p.dossierId)}</div>}
                  </td>
                  <td className="px-5 py-3 text-ink-soft max-w-[150px] truncate">{p.contact || '—'}</td>
                  <td className="px-5 py-3 text-ink-soft">{p.type && <Badge>{p.type}</Badge>}</td>
                  <td className="px-5 py-3">
                    {p.niveauInteret && <Badge tone={p.niveauInteret === 'Fort' ? 'rust' : p.niveauInteret === 'Moyen' ? 'brass' : 'default'}>{p.niveauInteret}</Badge>}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{p.prochaineRelance ? formatDate(p.prochaineRelance) : '—'}</td>
                  <td className="px-5 py-3"><Badge tone={p.statut === 'Offre' ? 'teal' : p.statut === 'Intéressé' ? 'brass' : 'default'}>{p.statut}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(p)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier"><Pencil size={14} /></button>
                      <button onClick={() => removeProspect(p.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ProspectEditor open={editing !== null} prospect={editing === 'new' ? null : editing} dossierOptions={dossierOptions} onClose={() => setEditing(null)} />
      <PipelineImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        synonyms={PROSPECT_SYNONYMS}
        targetFields={PROSPECT_FIELDS}
        dossierOptions={dossierOptions}
        createDossierLibre={createDossierLibre}
        onImport={addProspectsBulk}
        title="Importer des prospects depuis Excel"
      />
    </div>
  );
}

function ProspectEditor({ open, prospect, dossierOptions, onClose }) {
  const { addProspect, updateProspect } = useApp();
  const isEdit = Boolean(prospect?.id);
  const [form, setForm] = useState(prospect || PROSPECT_EMPTY);
  const [openedFor, setOpenedFor] = useState(prospect);

  if (open && prospect !== openedFor) {
    setForm(prospect || PROSPECT_EMPTY);
    setOpenedFor(prospect);
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (isEdit) updateProspect(prospect.id, form);
    else addProspect(form);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le prospect' : 'Nouveau prospect'} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        {dossierOptions.length > 0 && (
          <Field label="Dossier" hint="Mandat ou dossier libre — optionnel">
            <Select value={form.dossierId} onChange={set('dossierId')}>
              <option value="">Aucun</option>
              {dossierOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prospect / Société" required><Input value={form.prospect} onChange={set('prospect')} /></Field>
          <Field label="Contact"><Input value={form.contact} onChange={set('contact')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={form.type} onChange={set('type')}>
              <option value="">—</option>
              {PROSPECT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Broker" hint="Si transmis via un confrère"><Input value={form.broker} onChange={set('broker')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Statut">
            <Select value={form.statut} onChange={set('statut')}>
              {PROSPECT_STATUTS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Niveau d'intérêt">
            <Select value={form.niveauInteret} onChange={set('niveauInteret')}>
              <option value="">—</option>
              {PROSPECT_INTERETS.map((i) => <option key={i}>{i}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date d'envoi"><Input type="date" value={form.dateEnvoi} onChange={set('dateEnvoi')} /></Field>
          <Field label="Version envoyée"><Input value={form.versionEnvoyee} onChange={set('versionEnvoyee')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dernier échange"><Input type="date" value={form.dernierEchange} onChange={set('dernierEchange')} /></Field>
          <Field label="Prochaine relance"><Input type="date" value={form.prochaineRelance} onChange={set('prochaineRelance')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prix proposé"><Input value={form.prixPropose} onChange={set('prixPropose')} /></Field>
          <Field label="Rendement proposé"><Input value={form.rendementPropose} onChange={set('rendementPropose')} /></Field>
        </div>
        <Field label="Documents demandés"><Input value={form.documentsDemandes} onChange={set('documentsDemandes')} /></Field>
        <Field label="Retour / Commentaires"><Textarea value={form.retour} onChange={set('retour')} /></Field>
        <Field label="Prochaine action"><Input value={form.prochaineAction} onChange={set('prochaineAction')} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer le prospect'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================= COURRIERS ===================================

const COURRIER_EMPTY = {
  dossierId: '', dateEnvoi: '', typeAction: 'Email', typeContact: '', societe: '', nomContact: '', fonction: '',
  telephone: '', email: '', bienSecteur: '', objet: '', statut: 'Envoyé', dateRelancePrevue: '',
  nbRelances: '', reponseObtenue: '', prochaineAction: '', chargeDossier: '',
};

function CourriersTab({ dossierFilter, dossierOptions, dossierLabel, createDossierLibre }) {
  const { courriers, removeCourrier, addCourriersBulk } = useApp();
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!dossierFilter) return courriers;
    if (dossierFilter === '__none__') return courriers.filter((c) => !c.dossierId);
    return courriers.filter((c) => c.dossierId === dossierFilter);
  }, [courriers, dossierFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const reponses = filtered.filter((c) => ['Réponse positive', 'Réponse négative', 'RDV obtenu'].includes(c.statut)).length;
    const relancesProches = filtered.filter(
      (c) => c.dateRelancePrevue && daysUntil(c.dateRelancePrevue) <= 7 && !['Dossier clos', 'Réponse positive', 'Réponse négative'].includes(c.statut)
    ).length;
    return { total, reponses, tauxReponse: total ? Math.round((reponses / total) * 100) : 0, relancesProches };
  }, [filtered]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiBox label="Envois enregistrés" value={kpis.total} icon={Mail} />
        <KpiBox label="Réponses obtenues" value={kpis.reponses} icon={CheckCircle2} tone="teal" />
        <KpiBox label="Taux de réponse" value={`${kpis.tauxReponse}%`} icon={TrendingUp} />
        <KpiBox label="Relances sous 7 jours" value={kpis.relancesProches} icon={AlertCircle} tone={kpis.relancesProches ? 'rust' : 'default'} />
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <BulkDeleteButton type="courrier" items={filtered} label="courrier" />
        <Button variant="outline" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>
        <Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouveau courrier</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Aucun courrier enregistré"
          description="Ajoutez vos envois un par un, ou importez d'un coup votre tableau de suivi Excel."
          action={<Button variant="brass" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                <th className="px-5 py-3 font-medium">Envoi</th>
                <th className="px-5 py-3 font-medium">Société / Contact</th>
                <th className="px-5 py-3 font-medium">Objet</th>
                <th className="px-5 py-3 font-medium">Relance prévue</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.map((c) => {
                const resolved = ['Dossier clos', 'Réponse positive', 'Réponse négative'].includes(c.statut);
                return (
                  <tr key={c.id} className="hover:bg-paper-raised/60">
                    <td className="px-5 py-3 text-ink-soft">
                      <div>{c.dateEnvoi ? formatDate(c.dateEnvoi) : '—'}</div>
                      <div className="text-[11px] text-ink-faint">{c.typeAction}</div>
                    </td>
                    <td className="px-5 py-3 text-ink max-w-[180px]">
                      <div className="truncate font-medium">{c.societe || '—'}</div>
                      <div className="text-[11px] text-ink-faint truncate">{c.nomContact}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft max-w-[200px] truncate">{c.objet || '—'}</td>
                    <td className="px-5 py-3">
                      {c.dateRelancePrevue ? <Badge tone={deadlineTone(c.dateRelancePrevue, resolved)}>{formatDate(c.dateRelancePrevue)}</Badge> : '—'}
                    </td>
                    <td className="px-5 py-3"><Badge tone={resolved ? 'teal' : 'default'}>{c.statut}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(c)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier"><Pencil size={14} /></button>
                        <button onClick={() => removeCourrier(c.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <CourrierEditor open={editing !== null} courrier={editing === 'new' ? null : editing} dossierOptions={dossierOptions} onClose={() => setEditing(null)} />
      <PipelineImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        synonyms={COURRIER_SYNONYMS}
        targetFields={COURRIER_FIELDS}
        dossierOptions={dossierOptions}
        createDossierLibre={createDossierLibre}
        onImport={addCourriersBulk}
        title="Importer des courriers depuis Excel"
      />
    </div>
  );
}

function CourrierEditor({ open, courrier, dossierOptions, onClose }) {
  const { addCourrier, updateCourrier } = useApp();
  const isEdit = Boolean(courrier?.id);
  const [form, setForm] = useState(courrier || COURRIER_EMPTY);
  const [openedFor, setOpenedFor] = useState(courrier);

  if (open && courrier !== openedFor) {
    setForm(courrier || COURRIER_EMPTY);
    setOpenedFor(courrier);
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (isEdit) updateCourrier(courrier.id, form);
    else addCourrier(form);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le courrier' : 'Nouveau courrier'} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        {dossierOptions.length > 0 && (
          <Field label="Dossier" hint="Mandat ou dossier libre — optionnel">
            <Select value={form.dossierId} onChange={set('dossierId')}>
              <option value="">Aucun</option>
              {dossierOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date d'envoi"><Input type="date" value={form.dateEnvoi} onChange={set('dateEnvoi')} /></Field>
          <Field label="Type d'action">
            <Select value={form.typeAction} onChange={set('typeAction')}>
              {COURRIER_TYPES_ACTION.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Société / Foncière" required><Input value={form.societe} onChange={set('societe')} /></Field>
          <Field label="Type de contact">
            <Select value={form.typeContact} onChange={set('typeContact')}>
              <option value="">—</option>
              {COURRIER_TYPES_CONTACT.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom du contact"><Input value={form.nomContact} onChange={set('nomContact')} /></Field>
          <Field label="Fonction"><Input value={form.fonction} onChange={set('fonction')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Bien / Secteur concerné"><Input value={form.bienSecteur} onChange={set('bienSecteur')} /></Field>
        <Field label="Objet du courrier / mail"><Input value={form.objet} onChange={set('objet')} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Statut">
            <Select value={form.statut} onChange={set('statut')}>
              {COURRIER_STATUTS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Date de relance prévue"><Input type="date" value={form.dateRelancePrevue} onChange={set('dateRelancePrevue')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nb de relances"><Input type="number" value={form.nbRelances} onChange={set('nbRelances')} /></Field>
          <Field label="Chargé(e) de dossier"><Input value={form.chargeDossier} onChange={set('chargeDossier')} /></Field>
        </div>
        <Field label="Réponse obtenue"><Textarea value={form.reponseObtenue} onChange={set('reponseObtenue')} /></Field>
        <Field label="Prochaine action / Commentaires"><Textarea value={form.prochaineAction} onChange={set('prochaineAction')} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer le courrier'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================ COMPOSANTS PARTAGÉS ==========================

function KpiBox({ label, value, icon: Icon, tone = 'default' }) {
  const toneMap = { default: 'text-ink', teal: 'text-teal', rust: 'text-rust', brass: 'text-brass-deep' };
  return (
    <Card>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-faint font-medium">
        {Icon && <Icon size={12} />} {label}
      </div>
      <div className={`font-display text-[22px] mt-1.5 tabular ${toneMap[tone]}`}>{value}</div>
    </Card>
  );
}

// Assistant d'import générique — lecture réelle du classeur (SheetJS),
// mappage de colonnes deviné puis vérifié par l'utilisateur avant tout
// enregistrement, comme pour l'import Contacts.
function PipelineImportWizard({ open, onClose, synonyms, targetFields, dossierOptions, createDossierLibre, onImport, title }) {
  const [status, setStatus] = useState('idle');
  const [sheets, setSheets] = useState([]);
  const [mappings, setMappings] = useState({});
  const [included, setIncluded] = useState({});
  const [openSheets, setOpenSheets] = useState({});
  const [dossierId, setDossierId] = useState('');
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStatus('idle'); setSheets([]); setMappings({}); setIncluded({}); setOpenSheets({}); setDossierId(''); setError(''); setImportedCount(0);
  }
  function close() { reset(); onClose(); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('reading');
    setError('');
    try {
      const { readWorkbookSheets } = await import('../lib/pipelineImport');
      const parsed = await readWorkbookSheets(file, synonyms);
      const initMappings = {};
      const initIncluded = {};
      const initOpen = {};
      parsed.forEach((s, i) => {
        initMappings[s.name] = Object.fromEntries(s.columns.map((c) => [c.index, c.guess]));
        initIncluded[s.name] = s.hasHeader;
        initOpen[s.name] = i === 0;
      });
      setSheets(parsed);
      setMappings(initMappings);
      setIncluded(initIncluded);
      setOpenSheets(initOpen);
      setStatus('mapping');
    } catch (err) {
      setStatus('error');
      setError("Impossible de lire ce fichier — vérifiez qu'il s'agit bien d'un classeur Excel (.xlsx ou .xlsm).");
    }
  }

  function setMapping(sheetName, colIndex, field) {
    setMappings((m) => ({ ...m, [sheetName]: { ...m[sheetName], [colIndex]: field } }));
  }

  const previewTotal = useMemo(() => {
    if (status !== 'mapping') return 0;
    return sheets.reduce((sum, s) => {
      if (!included[s.name]) return sum;
      const rowsWithData = s.rows.filter((row) =>
        s.columns.some((c) => {
          const f = mappings[s.name]?.[c.index];
          return f && f !== 'ignorer' && String(row[c.index] ?? '').trim();
        })
      );
      return sum + rowsWithData.length;
    }, 0);
  }, [sheets, mappings, included, status]);

  async function confirmImport() {
    const { buildRecordsFromMapping } = await import('../lib/pipelineImport');
    const extraFields = dossierId ? { dossierId } : {};
    const raw = sheets
      .filter((s) => included[s.name])
      .flatMap((s) => buildRecordsFromMapping(s, mappings[s.name], extraFields));

    // Classification automatique : si une colonne a été mappée vers
    // "Dossier", chaque ligne rejoint le dossier correspondant à sa valeur
    // — retrouvé s'il existe déjà (mandat ou dossier libre), sinon créé à
    // la volée. Les lignes déjà rattachées via le sélecteur ci-dessus ne
    // sont écrasées que si leur propre colonne "Dossier" est renseignée.
    const nameToId = new Map(dossierOptions.map((o) => [o.label.trim().toLowerCase(), o.id]));
    const all = raw.map((rec) => {
      if (!rec.dossier || !rec.dossier.trim()) return rec;
      const key = rec.dossier.trim().toLowerCase();
      let id = nameToId.get(key);
      if (!id) {
        const created = createDossierLibre(rec.dossier.trim(), '');
        id = created.id;
        nameToId.set(key, id);
      }
      const { dossier, ...rest } = rec;
      return { ...rest, dossierId: id };
    });

    onImport(all);
    setImportedCount(all.length);
    setStatus('done');
  }

  return (
    <Modal open={open} onClose={close} title={title} width="max-w-3xl">
      {status === 'idle' || status === 'reading' ? (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            Déposez votre classeur Excel. Chaque onglet est lu séparément — vous choisirez ensuite quelle
            colonne correspond à quel champ avant que rien ne soit enregistré.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
            {status === 'reading' ? (
              <><Loader2 className="animate-spin text-brass" size={26} /><span className="text-[12.5px] text-ink-soft">Lecture du classeur…</span></>
            ) : (
              <><UploadCloud className="text-ink-faint" size={26} /><span className="text-[13px] text-ink font-medium">Déposer un fichier .xlsx / .xlsm ou cliquer pour parcourir</span></>
            )}
            <input type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={handleFile} />
          </label>
          {status === 'error' && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {error}</div>}
        </div>
      ) : status === 'mapping' ? (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft">
            {sheets.length} onglet{sheets.length > 1 ? 's' : ''} détecté{sheets.length > 1 ? 's' : ''}. Corrigez
            le mappage si besoin, décochez un onglet à ne pas importer (les onglets de listes déroulantes ou de
            tableau de bord, par exemple). Astuce : mappez une colonne vers <strong>« Dossier »</strong> (ex.
            « Bien / Secteur concerné ») pour que chaque ligne rejoigne automatiquement le bon dossier —
            créé à la volée s'il n'existe pas encore.
          </p>
          {dossierOptions.length > 0 && (
            <Field label="Rattacher les lignes importées à un dossier" hint="Optionnel — mandat ou dossier libre, vous pourrez le préciser ligne par ligne ensuite">
              <Select value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
                <option value="">Aucun dossier par défaut</option>
                {dossierOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
          )}
          <div className="max-h-[45vh] overflow-y-auto space-y-2 -mx-1 px-1">
            {sheets.map((s) => (
              <div key={s.name} className="border border-line rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSheets((o) => ({ ...o, [s.name]: !o[s.name] }))}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-paper-raised text-left"
                >
                  <input
                    type="checkbox"
                    checked={included[s.name] ?? true}
                    onChange={(e) => { e.stopPropagation(); setIncluded((o) => ({ ...o, [s.name]: e.target.checked })); }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-line"
                  />
                  {openSheets[s.name] ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
                  <span className="text-[13px] font-medium text-ink flex-1">{s.name}</span>
                  <span className="text-[11px] text-ink-faint">{s.rows.length} ligne{s.rows.length > 1 ? 's' : ''}</span>
                </button>
                {openSheets[s.name] && (
                  <div className="p-3.5 space-y-2">
                    {s.columns.map((c) => (
                      <div key={c.index} className="flex items-center gap-2">
                        <div className="w-44 shrink-0 text-[12px] text-ink-soft truncate" title={c.label}>{c.label}</div>
                        <div className="flex-1 text-[11px] text-ink-faint truncate italic" title={c.sample}>{c.sample || '—'}</div>
                        <Select
                          value={mappings[s.name]?.[c.index] || 'ignorer'}
                          onChange={(e) => setMapping(s.name, c.index, e.target.value)}
                          className="!py-1.5 w-48 shrink-0"
                        >
                          {targetFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-brass/25 bg-brass-soft/40 p-3.5 flex items-center justify-between text-[13px]">
            <span className="text-ink">Lignes à importer</span>
            <span className="font-display text-[18px] text-ink tabular">{previewTotal}</span>
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={close}>Annuler</Button>
            <Button variant="brass" onClick={confirmImport} disabled={previewTotal === 0}>Importer {previewTotal} ligne{previewTotal > 1 ? 's' : ''}</Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto text-teal mb-3" size={30} strokeWidth={1.5} />
          <div className="font-display text-[19px] text-ink">{importedCount} ligne{importedCount > 1 ? 's' : ''} importée{importedCount > 1 ? 's' : ''}</div>
          <p className="text-ink-soft text-[13px] mt-1.5">Modifiables, supprimables (avec récupération immédiate) comme n'importe quelle ligne saisie à la main.</p>
          <div className="flex justify-center mt-6"><Button variant="brass" onClick={close}>Terminer</Button></div>
        </div>
      )}
    </Modal>
  );
}
