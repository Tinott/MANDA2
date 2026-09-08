
import { useState } from 'react';
import { Plus, FileText, Sparkles, Download, Trash2, Pencil, UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcHonoraires, repartitionRedevable, tvaMontant, nextInvoiceNumber, clientNumero, formatEUR, formatDate } from '../lib/calc';
import { uid } from '../lib/storage';
import {
  PageHeader, Card, Button, Modal, Field, Input, Select, Badge, statusTone, EmptyState, Stepper, Stamp, BulkDeleteButton,
} from '../components/ui';

const STATUTS = ['Brouillon', 'Émise', 'Envoyée', 'Payée', 'En retard'];

async function downloadInvoicePdf(facture, societe) {
  const { downloadInvoicePdf: run } = await import('../lib/pdfInvoice');
  run(facture, societe);
}

export default function Facturation() {
  const { factures, societe, updateFacture, removeFacture } = useApp();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editorState, setEditorState] = useState(null); // null | 'new' | facture object

  return (
    <div>
      <PageHeader
        eyebrow="Recettes"
        title="Facturation"
        description="Générez vos honoraires à partir d'un acte, ou créez une facture manuellement. Tout reste modifiable après coup."
        action={
          <div className="flex gap-2">
            <BulkDeleteButton type="facture" items={factures} label="facture" />
            <Button variant="outline" onClick={() => setEditorState('new')}><Plus size={15} /> Facture manuelle</Button>
            <Button variant="brass" onClick={() => setWizardOpen(true)}><Sparkles size={15} /> Générer depuis un acte</Button>
          </div>
        }
      />

      {factures.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune facture émise"
          description="Déposez une promesse de vente ou un acte authentique : Mandat en extrait le prix, les parties et calcule vos honoraires selon votre barème."
          action={<Button variant="brass" onClick={() => setWizardOpen(true)}><Sparkles size={15} /> Générer depuis un acte</Button>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                <th className="px-5 py-3 font-medium">N°</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Émission</th>
                <th className="px-5 py-3 font-medium text-right">Montant TTC</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {factures.map((f) => (
                <tr key={f.id} className="hover:bg-paper-raised/60">
                  <td className="px-5 py-3 font-mono text-[11.5px] text-ink-soft">{f.numero}</td>
                  <td className="px-5 py-3 text-ink">{f.client}</td>
                  <td className="px-5 py-3 text-ink-soft">{formatDate(f.dateEmission)}</td>
                  <td className="px-5 py-3 text-right tabular font-medium text-ink">{formatEUR(f.montantTTC)}</td>
                  <td className="px-5 py-3">
                    <Select
                      value={f.statut}
                      onChange={(e) => updateFacture(f.id, { statut: e.target.value })}
                      className="!py-1 !px-2 text-[11.5px] w-auto"
                    >
                      {STATUTS.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditorState(f)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => downloadInvoicePdf(f, societe)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Télécharger le PDF">
                        <Download size={15} />
                      </button>
                      <button onClick={() => removeFacture(f.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer">
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

      <InvoiceEditor
        open={editorState !== null}
        facture={editorState === 'new' ? null : editorState}
        onClose={() => setEditorState(null)}
      />
      <ActeWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onEdit={(f) => setEditorState(f)} />
    </div>
  );
}

// --- Éditeur de lignes — chaque ligne peut être positive (honoraires) ou
// négative (déduction, rétrocession…), exactement comme sur les factures
// à plusieurs lignes des confrères.
function LineItemsEditor({ lignes, onChange }) {
  function updateLine(id, patch) {
    onChange(lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function removeLine(id) {
    onChange(lignes.filter((l) => l.id !== id));
  }
  function addLine() {
    onChange([...lignes, { id: uid('ligne'), libelle: '', montant: '' }]);
  }

  return (
    <div>
      <div className="text-[12.5px] font-medium text-ink mb-2">Lignes de la facture</div>
      <div className="space-y-2">
        {lignes.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <Input
              value={l.libelle}
              onChange={(e) => updateLine(l.id, { libelle: e.target.value })}
              placeholder="Libellé (ex. Commission d'agence, Déduction frais de géomètre…)"
              className="flex-1"
            />
            <Input
              type="number"
              step="0.01"
              value={l.montant}
              onChange={(e) => updateLine(l.id, { montant: e.target.value })}
              placeholder="Montant HT"
              className="w-32 text-right"
            />
            <button
              type="button"
              onClick={() => removeLine(l.id)}
              disabled={lignes.length <= 1}
              className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft disabled:opacity-30 disabled:pointer-events-none shrink-0"
              title="Supprimer la ligne"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addLine} className="mt-2 text-[12px] text-brass hover:text-brass-deep flex items-center gap-1">
        <Plus size={13} /> Ajouter une ligne (ex. une déduction, en montant négatif)
      </button>
    </div>
  );
}

// --- Éditeur de facture — sert à la fois à la création manuelle et à la
// modification d'une facture existante (y compris celles générées depuis
// un acte). Rien n'est figé après génération : montants, lignes, client,
// références, tout reste modifiable.
function InvoiceEditor({ open, facture, onClose }) {
  const { addFacture, updateFacture, factures, societe } = useApp();
  const isEdit = Boolean(facture);

  const [form, setForm] = useState(() => emptyForm(facture, societe));

  // Recharge le formulaire à chaque ouverture sur une facture différente.
  const [openedFor, setOpenedFor] = useState(facture?.id || null);
  if (open && (facture?.id || null) !== openedFor) {
    setForm(emptyForm(facture, societe));
    setOpenedFor(facture?.id || null);
  }

  if (!open) return null;

  const montantHT = form.lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const montantTVA = tvaMontant(montantHT, form.tauxTva);
  const montantTTC = montantHT + montantTVA;

  function set(k) {
    return (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    const lignesPropres = form.lignes
      .filter((l) => l.libelle.trim() || Number(l.montant))
      .map((l) => ({ ...l, montant: Number(l.montant) || 0 }));
    const payload = {
      client: form.client,
      clientNumero: form.clientNumero || clientNumero(factures, form.client),
      bienAdresse: form.bienAdresse,
      mandatRef: form.mandatRef,
      notaire: form.notaire,
      refTitre: form.refTitre,
      libelle: lignesPropres[0]?.libelle || form.libelle,
      dateEmission: form.dateEmission,
      tauxTva: Number(form.tauxTva),
      lignes: lignesPropres,
      montantHT,
      montantTVA,
      montantTTC,
      statut: form.statut,
      redevable: form.redevable,
    };
    if (isEdit) {
      updateFacture(facture.id, payload);
    } else {
      addFacture({ numero: nextInvoiceNumber(factures), ...payload });
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Modifier la facture ${facture.numero}` : 'Facture manuelle'} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Client" required><Input value={form.client} onChange={set('client')} required /></Field>
          <Field label="N° client" hint="Attribué automatiquement si laissé vide">
            <Input value={form.clientNumero} onChange={set('clientNumero')} placeholder="CLT00000001" />
          </Field>
        </div>
        <Field label="Bien concerné"><Input value={form.bienAdresse} onChange={set('bienAdresse')} /></Field>
        <Field label="Réf. facture" hint="Ex. « Commission d'agence — Vente immobilière X / Y »">
          <Input value={form.refTitre} onChange={set('refTitre')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Réf. mandat" hint="Optionnel"><Input value={form.mandatRef} onChange={set('mandatRef')} placeholder="Ex. AO-719" /></Field>
          <Field label="Notaire instrumentaire" hint="Optionnel"><Input value={form.notaire} onChange={set('notaire')} placeholder="M X, notaire à Y" /></Field>
        </div>

        <LineItemsEditor lignes={form.lignes} onChange={(lignes) => setForm((f) => ({ ...f, lignes }))} />

        <div className="grid grid-cols-3 gap-4">
          <Field label="Date d'émission"><Input type="date" value={form.dateEmission} onChange={set('dateEmission')} /></Field>
          <Field label="TVA">
            <Select value={form.tauxTva} onChange={set('tauxTva')}>
              <option value={20}>20 %</option><option value={10}>10 %</option><option value={5.5}>5,5 %</option><option value={0}>0 %</option>
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={form.statut} onChange={set('statut')}>
              {STATUTS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-paper-raised p-4 flex items-center justify-between text-[13px]">
          <div className="text-ink-soft">
            Total HT <span className="text-ink font-medium tabular">{formatEUR(montantHT)}</span>
            <span className="mx-2 text-ink-faint">·</span>
            TVA <span className="text-ink font-medium tabular">{formatEUR(montantTVA)}</span>
          </div>
          <div className="font-display text-[19px] text-ink tabular">{formatEUR(montantTTC)}</div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer la facture'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function emptyForm(facture, societe) {
  if (facture) {
    return {
      client: facture.client || '',
      clientNumero: facture.clientNumero || '',
      bienAdresse: facture.bienAdresse || '',
      refTitre: facture.refTitre || '',
      mandatRef: facture.mandatRef || '',
      notaire: facture.notaire || '',
      dateEmission: facture.dateEmission || new Date().toISOString().slice(0, 10),
      tauxTva: facture.tauxTva ?? 20,
      statut: facture.statut || 'Émise',
      redevable: facture.redevable || '',
      lignes: facture.lignes?.length
        ? facture.lignes.map((l) => ({ id: l.id || uid('ligne'), libelle: l.libelle, montant: l.montant }))
        : [{ id: uid('ligne'), libelle: facture.libelle || 'Honoraires de transaction', montant: facture.montantHT || '' }],
    };
  }
  return {
    client: '', clientNumero: '', bienAdresse: '', refTitre: '', mandatRef: '', notaire: '',
    dateEmission: new Date().toISOString().slice(0, 10), tauxTva: societe.tauxTvaDefaut, statut: 'Émise', redevable: '',
    lignes: [{ id: uid('ligne'), libelle: 'Honoraires de transaction', montant: '' }],
  };
}

const WIZ_STEPS = ['Document', 'Vérification', 'Barème', 'Facture'];

function ActeWizard({ open, onClose, onEdit }) {
  const { societe, factures, addFacture } = useApp();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [fileName, setFileName] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [redevable, setRedevable] = useState('vendeur');
  const [quotePart, setQuotePart] = useState(50);
  const [created, setCreated] = useState(null);

  function reset() {
    setStep(0); setStatus('idle'); setFileName(''); setExtracted(null); setRedevable('vendeur'); setCreated(null);
  }
  function close() { reset(); onClose(); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus('reading');
    try {
      const { extractPdfText, parseActeFields } = await import('../lib/pdfExtract');
      const text = await extractPdfText(file);
      const fields = parseActeFields(text);
      setExtracted({
        prixVente: fields.prixVente || '',
        dateSignature: fields.dateSignature || '',
        vendeur: fields.vendeur || '',
        acquereur: fields.acquereur || '',
        adresseBien: fields.adresseBien || '',
        reference: fields.reference || '',
        notaire: fields.notaire || '',
        mandatRef: '',
        confidence: fields.confidence,
      });
      setStatus('done');
      setStep(1);
    } catch (err) {
      setStatus('error');
    }
  }

  const honoraires = extracted ? calcHonoraires(societe.bareme, extracted.prixVente) : 0;
  const rep = repartitionRedevable(honoraires, redevable, quotePart);
  const clientPayeur = redevable === 'acquereur' ? extracted?.acquereur : extracted?.vendeur;
  const montantFacture = redevable === 'partage' ? honoraires * (quotePart / 100) : honoraires;
  const tva = tvaMontant(montantFacture, societe.tauxTvaDefaut);

  function generate() {
    const client = clientPayeur || (redevable === 'acquereur' ? "Acquéreur" : 'Vendeur');
    const libelle = `Honoraires de transaction — ${extracted.adresseBien || 'bien'}`;
    const rec = addFacture({
      numero: nextInvoiceNumber(factures),
      clientNumero: clientNumero(factures, client),
      client,
      bienAdresse: extracted.adresseBien,
      mandatRef: extracted.mandatRef,
      notaire: extracted.notaire,
      refTitre: `Commission d'agence — Vente immobilière${extracted.vendeur && extracted.acquereur ? ` ${extracted.vendeur} / ${extracted.acquereur}` : ''}`,
      libelle,
      dateEmission: new Date().toISOString().slice(0, 10),
      lignes: [{ id: uid('ligne'), libelle, montant: montantFacture }],
      montantHT: montantFacture,
      tauxTva: societe.tauxTvaDefaut,
      montantTVA: tva,
      montantTTC: montantFacture + tva,
      statut: 'Émise',
      redevable: redevable === 'partage' ? `répartis (${quotePart}% vendeur)` : redevable,
      source: 'acte',
    });
    setCreated(rec);
    setStep(3);
  }

  return (
    <Modal open={open} onClose={close} title="Générer une facture depuis un acte" width="max-w-2xl">
      <Stepper steps={WIZ_STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            Déposez la promesse de vente ou l'acte authentique au format PDF. Le prix de vente, les parties
            et l'adresse du bien sont extraits automatiquement — vous les vérifierez à l'étape suivante, et
            pourrez de toute façon tout modifier ensuite, y compris après génération.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
            {status === 'reading' ? (
              <>
                <Loader2 className="animate-spin text-brass" size={26} />
                <span className="text-[12.5px] text-ink-soft">Lecture du document…</span>
              </>
            ) : (
              <>
                <UploadCloud className="text-ink-faint" size={26} />
                <span className="text-[13px] text-ink font-medium">Déposer un PDF ou cliquer pour parcourir</span>
                <span className="text-[11.5px] text-ink-faint">{fileName || 'Acte, promesse ou compromis de vente'}</span>
              </>
            )}
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
          </label>
          {status === 'error' && (
            <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> Impossible de lire ce fichier — vérifiez qu'il s'agit bien d'un PDF.</div>
          )}
        </div>
      )}

      {step === 1 && extracted && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft flex items-center gap-1.5">
            <Sparkles size={13} className="text-brass" /> Données extraites — corrigez si nécessaire avant de continuer.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prix de vente" required>
              <Input type="number" value={extracted.prixVente} onChange={(e) => setExtracted({ ...extracted, prixVente: e.target.value })} />
            </Field>
            <Field label="Date de signature">
              <Input type="date" value={extracted.dateSignature} onChange={(e) => setExtracted({ ...extracted, dateSignature: e.target.value })} />
            </Field>
            <Field label="Vendeur">
              <Input value={extracted.vendeur} onChange={(e) => setExtracted({ ...extracted, vendeur: e.target.value })} />
            </Field>
            <Field label="Acquéreur">
              <Input value={extracted.acquereur} onChange={(e) => setExtracted({ ...extracted, acquereur: e.target.value })} />
            </Field>
          </div>
          <Field label="Adresse du bien">
            <Input value={extracted.adresseBien} onChange={(e) => setExtracted({ ...extracted, adresseBien: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Réf. mandat" hint="Optionnel">
              <Input value={extracted.mandatRef} onChange={(e) => setExtracted({ ...extracted, mandatRef: e.target.value })} placeholder="Ex. AO-719" />
            </Field>
            <Field label="Notaire instrumentaire" hint="Détecté automatiquement si présent">
              <Input value={extracted.notaire} onChange={(e) => setExtracted({ ...extracted, notaire: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Retour</Button>
            <Button variant="brass" onClick={() => setStep(2)} disabled={!extracted.prixVente}>Continuer</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-paper-raised p-4 flex items-center justify-between">
            <span className="text-[12.5px] text-ink-soft">Honoraires calculés (barème {societe.bareme?.type})</span>
            <span className="font-display text-[20px] text-ink tabular">{formatEUR(honoraires)}</span>
          </div>
          <Field label="Honoraires à la charge de">
            <Select value={redevable} onChange={(e) => setRedevable(e.target.value)}>
              <option value="vendeur">Vendeur</option>
              <option value="acquereur">Acquéreur</option>
              <option value="partage">Partagés avec un confrère</option>
            </Select>
          </Field>
          {redevable === 'partage' && (
            <Field label="Quote-part vendeur (%)">
              <Input type="number" min="0" max="100" value={quotePart} onChange={(e) => setQuotePart(e.target.value)} />
              <div className="text-[11.5px] text-ink-faint mt-1">
                Vendeur : {formatEUR(rep.vendeur)} · Acquéreur : {formatEUR(rep.acquereur)}
              </div>
            </Field>
          )}
          <div className="rounded-lg border border-brass/25 bg-brass-soft/40 p-4 text-[13px] text-ink flex items-center justify-between">
            <span>Montant à facturer (HT)</span>
            <span className="font-medium tabular">{formatEUR(montantFacture)}</span>
          </div>
          <p className="text-[11.5px] text-ink-faint">
            Une erreur de répartition ? Vous pourrez modifier ce montant, ajouter une ligne de déduction
            ou tout recalculer directement depuis la facture, une fois générée.
          </p>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Retour</Button>
            <Button variant="brass" onClick={generate}>Générer la facture</Button>
          </div>
        </div>
      )}

      {step === 3 && created && (
        <div className="text-center py-4">
          <div className="flex justify-center mb-4"><Stamp label="Générée" /></div>
          <div className="font-display text-[19px] text-ink">Facture {created.numero} créée</div>
          <p className="text-ink-soft text-[13px] mt-1.5">{formatEUR(created.montantTTC)} TTC — {created.client}</p>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={close}>Fermer</Button>
            <Button variant="outline" onClick={() => { onEdit(created); close(); }}><Pencil size={14} /> Modifier</Button>
            <Button variant="brass" onClick={() => downloadInvoicePdf(created, societe)}><Download size={15} /> Télécharger le PDF</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
