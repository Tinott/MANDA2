import { useMemo, useState } from 'react';
import {
  Plus, FileText, Download, Trash2, Pencil, ChevronRight, ChevronLeft,
  AlertTriangle, Loader2, FolderOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/calc';
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, DOCUMENT_STATUTS, VARIANTES_MANDAT, documentTitle } from '../lib/documentTypes';
import { fieldsBySections, visibleFields } from '../lib/documentFields';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState, Stepper, BulkDeleteButton } from '../components/ui';

function nextNumero(documents, typeId) {
  const prefix = { mandat_vente: 'MV', mandat_recherche: 'MR', offre_achat: 'OA', avenant: 'AV' }[typeId] || 'DOC';
  const nums = documents
    .map((d) => d.numero)
    .filter((n) => n && n.startsWith(`${prefix}-`))
    .map((n) => parseInt(n.split('-')[1], 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function statutTone(statut) {
  if (statut === 'Signé') return 'teal';
  if (statut === 'Signature en cours') return 'brass';
  return 'default';
}

export default function Documents() {
  const { documents, societe, mandats, removeDocument, updateDocument } = useApp();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  const filtered = useMemo(() => {
    if (!categoryFilter) return documents;
    return documents.filter((d) => {
      const type = DOCUMENT_TYPES.find((t) => t.id === d.typeId);
      return type?.category === categoryFilter;
    });
  }, [documents, categoryFilter]);

  const countsByCategory = useMemo(() => {
    const c = {};
    documents.forEach((d) => {
      const type = DOCUMENT_TYPES.find((t) => t.id === d.typeId);
      if (type) c[type.category] = (c[type.category] || 0) + 1;
    });
    return c;
  }, [documents]);

  function dossierLabel(dossierId) {
    return mandats.find((m) => m.id === dossierId)?.adresse || null;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bibliothèque juridique"
        title="Documents"
        description="Mandats, avenants et offres d'achat — champs dynamiques, prêts à l'emploi."
        action={
          <div className="flex gap-2">
            <BulkDeleteButton type="document" items={filtered} label="document" />
            <Button variant="brass" onClick={() => setWizardOpen(true)}><Plus size={15} /> Créer un nouveau document</Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        <div className="space-y-1">
          <button
            onClick={() => setCategoryFilter('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${!categoryFilter ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-raised'}`}
          >
            Tous les documents ({documents.length})
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors flex items-center justify-between ${categoryFilter === cat.id ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper-raised'}`}
            >
              <span>{cat.label}</span>
              <span className="text-[11px] opacity-70">{countsByCategory[cat.id] || 0}</span>
            </button>
          ))}
        </div>

        <div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun document"
              description="Créez votre premier mandat, avenant ou offre d'achat à partir d'un modèle guidé."
              action={<Button variant="brass" onClick={() => setWizardOpen(true)}><Plus size={15} /> Créer un nouveau document</Button>}
            />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-5 py-3 font-medium">Dossier</th>
                    <th className="px-5 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 font-medium">Modifié le</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-paper-raised/60">
                      <td className="px-5 py-3">
                        <div className="text-ink font-medium">{documentTitle(d.typeId, d.variante)}</div>
                        <div className="text-[11px] text-ink-faint font-mono">{d.numero}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {d.dossierId && dossierLabel(d.dossierId) ? (
                          <span className="flex items-center gap-1"><FolderOpen size={12} className="text-ink-faint" /> {dossierLabel(d.dossierId)}</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Select value={d.statut} onChange={(e) => updateDocument(d.id, { statut: e.target.value })} className="!py-1 !px-2 text-[11.5px] w-auto">
                          {DOCUMENT_STATUTS.map((s) => <option key={s}>{s}</option>)}
                        </Select>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(d.updatedAt || d.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingDoc(d)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => removeDocument(d.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      <DocumentWizard open={wizardOpen} onClose={() => setWizardOpen(false)} mandats={mandats} societe={societe} />
      {editingDoc && (
        <DocumentWizard
          open
          onClose={() => setEditingDoc(null)}
          mandats={mandats}
          societe={societe}
          existing={editingDoc}
        />
      )}
    </div>
  );
}

const WIZ_STEPS = ['Type', 'Informations', 'Génération'];

function DocumentWizard({ open, onClose, mandats, societe, existing }) {
  const { documents, addDocument, updateDocument } = useApp();
  const [step, setStep] = useState(existing ? 1 : 0);
  const [typeId, setTypeId] = useState(existing?.typeId || '');
  const [variante, setVariante] = useState(existing?.variante || '');
  const [dossierId, setDossierId] = useState(existing?.dossierId || '');
  const [champs, setChamps] = useState(existing?.champs || {});
  const [fields, setFields] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function chooseType(id) {
    setTypeId(id);
    setLoading(true);
    try {
      const { getFieldsFor } = await import('../lib/documentFields');
      const f = await getFieldsFor(id);
      setFields(f);
      const type = DOCUMENT_TYPES.find((t) => t.id === id);
      if (!type.hasVariante) setVariante('');
      setStep(type.hasVariante ? 0.5 : 1);
    } finally {
      setLoading(false);
    }
  }

  async function ensureFields() {
    if (fields || !typeId) return;
    setLoading(true);
    try {
      const { getFieldsFor } = await import('../lib/documentFields');
      setFields(await getFieldsFor(typeId));
    } finally {
      setLoading(false);
    }
  }
  if (existing && !fields && !loading) ensureFields();

  function setChamp(id, value) {
    setChamps((c) => ({ ...c, [id]: value }));
  }

  function applyMandat(id) {
    setDossierId(id);
    const m = mandats.find((mm) => mm.id === id);
    if (!m) return;
    setChamps((c) => ({
      ...c,
      bienAdresse: c.bienAdresse || m.adresse,
      mandantNom: c.mandantNom || m.client,
      prixVente: c.prixVente || m.prixVente,
      prixMax: c.prixMax || m.prixVente,
    }));
  }

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const { downloadDocumentPdf } = await import('../lib/documentEngine');
      const numero = existing?.numero || nextNumero(documents, typeId);
      await downloadDocumentPdf({ typeId, variante: variante || undefined, champs, societe, numero });
      if (existing) {
        updateDocument(existing.id, { typeId, variante, dossierId, champs });
      } else {
        addDocument({ typeId, variante, dossierId, champs, numero, statut: 'Brouillon' });
      }
      setResult({ numero });
      setStep(2);
    } catch (e) {
      setError("La génération a échoué — vérifiez les champs et réessayez.");
    } finally {
      setGenerating(false);
    }
  }

  function close() {
    setStep(existing ? 1 : 0); setTypeId(existing?.typeId || ''); setVariante(existing?.variante || '');
    setDossierId(existing?.dossierId || ''); setChamps(existing?.champs || {}); setFields(null);
    setResult(null); setError('');
    onClose();
  }

  const readyTypes = DOCUMENT_TYPES;
  const sections = fields ? fieldsBySections(fields) : [];

  return (
    <Modal open={open} onClose={close} title={existing ? `Modifier ${documentTitle(existing.typeId, existing.variante)}` : 'Nouveau document'} width="max-w-2xl">
      <Stepper steps={WIZ_STEPS} current={Math.min(Math.floor(step), 2)} />

      {step === 0 && (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-soft mb-3">Choisissez le type de document à générer.</p>
          {DOCUMENT_CATEGORIES.map((cat) => {
            const typesInCat = readyTypes.filter((t) => t.category === cat.id);
            if (typesInCat.length === 0) return null;
            return (
              <div key={cat.id} className="mb-3">
                <div className="text-[10.5px] uppercase tracking-wide text-ink-faint font-medium mb-1.5">{cat.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {typesInCat.map((t) => (
                    <button
                      key={t.id}
                      disabled={!t.ready}
                      onClick={() => chooseType(t.id)}
                      className={`text-left px-3.5 py-2.5 rounded-lg border text-[12.5px] transition-colors ${
                        t.ready
                          ? 'border-line hover:border-brass hover:bg-brass-soft/30 text-ink'
                          : 'border-line-soft text-ink-faint cursor-not-allowed bg-paper-raised'
                      }`}
                    >
                      {t.label}
                      {!t.ready && <span className="block text-[10.5px] mt-0.5">Modèle en attente de validation juridique</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {step === 0.5 && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">Quelle formule pour ce mandat ?</p>
          <div className="grid grid-cols-3 gap-2">
            {VARIANTES_MANDAT.map((v) => (
              <button
                key={v}
                onClick={() => { setVariante(v); setStep(1); }}
                className="px-3.5 py-3 rounded-lg border border-line hover:border-brass hover:bg-brass-soft/30 text-[12.5px] text-ink text-center"
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft size={14} /> Retour</Button>
        </div>
      )}

      {step === 1 && (loading || !fields) ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-brass" size={24} /></div>
      ) : step === 1 && fields ? (
        <div className="space-y-5">
          {mandats.length > 0 && (
            <Field label="Dossier associé" hint="Optionnel — pré-remplit certains champs">
              <Select value={dossierId} onChange={(e) => applyMandat(e.target.value)}>
                <option value="">Aucun</option>
                {mandats.map((m) => <option key={m.id} value={m.id}>{m.adresse || 'Mandat sans adresse'}</option>)}
              </Select>
            </Field>
          )}
          <div className="max-h-[50vh] overflow-y-auto space-y-5 -mx-1 px-1">
            {sections.map(({ section, fields: sf }) => (
              <div key={section}>
                <div className="text-[11px] uppercase tracking-wide text-ink-faint font-medium mb-2">{section}</div>
                <div className="space-y-3">
                  {visibleFields(sf, champs).map((f) => (
                    <Field key={f.id} label={f.label} required={f.required}>
                      {f.type === 'select' ? (
                        <Select value={champs[f.id] ?? f.default ?? ''} onChange={(e) => setChamp(f.id, e.target.value)}>
                          {f.options.map((o) => <option key={o}>{o}</option>)}
                        </Select>
                      ) : f.type === 'textarea' ? (
                        <Textarea value={champs[f.id] ?? ''} onChange={(e) => setChamp(f.id, e.target.value)} placeholder={f.placeholder} />
                      ) : (
                        <Input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={champs[f.id] ?? f.default ?? ''}
                          onChange={(e) => setChamp(f.id, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertTriangle size={14} /> {error}</div>}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(DOCUMENT_TYPES.find((t) => t.id === typeId)?.hasVariante ? 0.5 : 0)} disabled={Boolean(existing)}>
              <ChevronLeft size={14} /> Retour
            </Button>
            <Button variant="brass" onClick={generate} disabled={generating}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              Générer le PDF
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && result && (
        <div className="text-center py-6">
          <FileText className="mx-auto text-teal mb-3" size={32} strokeWidth={1.5} />
          <div className="font-display text-[19px] text-ink">Document {result.numero} généré</div>
          <p className="text-ink-soft text-[13px] mt-1.5">Le PDF a été téléchargé et le document ajouté à votre bibliothèque, statut « Brouillon ».</p>
          <div className="flex justify-center mt-6">
            <Button variant="brass" onClick={close}>Terminer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
