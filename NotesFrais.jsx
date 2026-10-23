import { useEffect, useState } from 'react';
import { useFileDrop } from '../hooks/useFileDrop';
import DropOverlay from '../components/DropOverlay';
import { hasApiKey, extractReceiptAI } from '../lib/ai';
import { Receipt, Camera, Loader2, Sparkles, Trash2, Pencil, Car } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcIndemniteKm, DEPENSE_CATEGORIES } from '../lib/seed';
import { formatEUR, formatDate, tvaMontant } from '../lib/calc';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Badge, EmptyState, Stepper, Stamp, BulkDeleteButton } from '../components/ui';

export default function NotesFrais() {
  const { notesFrais, removeNoteFrais } = useApp();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  // Un ticket (photo ou PDF) glissé n'importe où sur la page ouvre la saisie.
  const { dragging } = useFileDrop((files) => {
    const f = files.find((x) => /^image\//.test(x.type) || x.type === 'application/pdf' || /\.(png|jpe?g|webp|pdf)$/i.test(x.name));
    if (f) { setDroppedFile(f); setCaptureOpen(true); }
  });
  const [kmOpen, setKmOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const total = notesFrais.reduce((s, n) => s + n.montantTTC, 0);

  return (
    <div>
      <DropOverlay visible={dragging} titre="Déposez le justificatif" detail="Photo ou PDF du ticket — montant, date et commerçant reconnus automatiquement" />
      <PageHeader
        eyebrow="Dépenses"
        title="Notes de frais"
        description="Photographiez un justificatif ou calculez une indemnité kilométrique — tout s'ajoute automatiquement à la comptabilité."
        action={
          <div className="flex gap-2">
            <BulkDeleteButton type="frais" items={notesFrais} label="dépense" />
            <Button variant="outline" onClick={() => setKmOpen(true)}><Car size={15} /> Frais kilométriques</Button>
            <Button variant="brass" onClick={() => setCaptureOpen(true)}><Camera size={15} /> Photographier un ticket</Button>
          </div>
        }
      />

      {notesFrais.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune dépense enregistrée"
          description="Ajoutez votre premier justificatif — carburant, repas d'affaires, frais de mandat…"
          action={<Button variant="brass" onClick={() => setCaptureOpen(true)}><Camera size={15} /> Photographier un ticket</Button>}
        />
      ) : (
        <>
          <div className="text-[12.5px] text-ink-soft mb-3">{notesFrais.length} dépense{notesFrais.length > 1 ? 's' : ''} · total <strong className="text-ink">{formatEUR(total)}</strong></div>
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-line bg-paper-raised">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Commerçant / motif</th>
                  <th className="px-5 py-3 font-medium">Catégorie</th>
                  <th className="px-5 py-3 font-medium text-right">Montant TTC</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {notesFrais.map((n) => (
                  <tr key={n.id} className="hover:bg-paper-raised/60">
                    <td className="px-5 py-3 text-ink-soft">{formatDate(n.date)}</td>
                    <td className="px-5 py-3 text-ink">{n.commercant || n.categorieLabel}</td>
                    <td className="px-5 py-3"><Badge>{n.categorieLabel}</Badge></td>
                    <td className="px-5 py-3 text-right tabular font-medium text-ink">{formatEUR(n.montantTTC)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(n)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => removeNoteFrais(n.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <CaptureWizard open={captureOpen} onClose={() => { setCaptureOpen(false); setDroppedFile(null); }} initialFile={droppedFile} />
      <KmModal open={kmOpen} onClose={() => setKmOpen(false)} />
      <EditNoteModal note={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditNoteModal({ note, onClose }) {
  const { updateNoteFrais } = useApp();
  const [form, setForm] = useState(note);
  const [openedFor, setOpenedFor] = useState(note?.id || null);

  if (note && note.id !== openedFor) {
    setForm(note);
    setOpenedFor(note.id);
  }
  if (!note) return null;

  function submit(e) {
    e.preventDefault();
    const ttcVal = Number(form.montantTTC) || 0;
    const tva = tvaMontant(ttcVal / (1 + form.tauxTva / 100), form.tauxTva);
    const cat = DEPENSE_CATEGORIES.find((c) => c.id === form.categorie) || DEPENSE_CATEGORIES[0];
    updateNoteFrais(note.id, {
      commercant: form.commercant,
      date: form.date,
      categorie: form.categorie,
      categorieLabel: cat.label,
      compte: cat.compte,
      montantTTC: ttcVal,
      montantTVA: tva,
      montantHT: ttcVal - tva,
    });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Modifier la dépense">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Commerçant / motif"><Input value={form.commercant} onChange={(e) => setForm({ ...form, commercant: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Montant TTC" required><Input type="number" step="0.01" value={form.montantTTC} onChange={(e) => setForm({ ...form, montantTTC: e.target.value })} /></Field>
          <Field label="TVA">
            <Select value={form.tauxTva} onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) })}>
              <option value={20}>20 %</option><option value={10}>10 %</option><option value={5.5}>5,5 %</option><option value={0}>0 %</option>
            </Select>
          </Field>
        </div>
        <Field label="Catégorie de dépense">
          <Select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
            {DEPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">Enregistrer les modifications</Button>
        </div>
      </form>
    </Modal>
  );
}

const CAP_STEPS = ['Photo', 'Vérification', 'Enregistrée'];

function CaptureWizard({ open, onClose, initialFile }) {
  const { addNoteFrais, societe } = useApp();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(null);

  function reset() { setStep(0); setStatus('idle'); setPreview(null); setForm(null); }
  function close() { reset(); onClose(); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (file) lireFichier(file);
  }

  // Lecture du justificatif : texte extrait (OCR pour une image, texte natif
  // pour un PDF), puis champs reconnus par l'IA si elle est disponible —
  // sinon par les heuristiques locales.
  async function lireFichier(file) {
    const estPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    setPreview(estPdf ? null : URL.createObjectURL(file));
    setStatus('reading');
    const vide = { commercant: '', date: new Date().toISOString().slice(0, 10), montantTTC: '', tauxTva: 20, categorie: 'transport' };
    try {
      let texte = '';
      let local = null;
      if (estPdf) {
        const { extractPdfText } = await import('../lib/pdfExtract');
        texte = await extractPdfText(file);
        const { parseReceiptFields } = await import('../lib/ocr');
        local = parseReceiptFields(texte);
      } else {
        const { ocrReceipt } = await import('../lib/ocr');
        local = await ocrReceipt(file);
        texte = local.text || '';
      }
      let champs = null;
      if (hasApiKey(societe) && texte.trim().length > 10) {
        try {
          const ia = await extractReceiptAI(societe, texte, DEPENSE_CATEGORIES);
          champs = {
            commercant: ia.commercant || local?.commercant || '',
            date: ia.date || local?.date || vide.date,
            montantTTC: ia.montantTTC ?? local?.montantTTC ?? '',
            tauxTva: ia.tauxTva ?? local?.tauxTva ?? 20,
            categorie: DEPENSE_CATEGORIES.some((c) => c.id === ia.categorie) ? ia.categorie : 'autre',
          };
        } catch { champs = null; }
      }
      if (!champs) {
        champs = { ...vide, commercant: local?.commercant || '', date: local?.date || vide.date, montantTTC: local?.montantTTC || '', tauxTva: local?.tauxTva || 20 };
      }
      setForm(champs);
      setStatus(champs.montantTTC ? 'done' : 'fallback');
      setStep(1);
    } catch {
      setForm(vide);
      setStatus('fallback');
      setStep(1);
    }
  }

  useEffect(() => {
    if (!open || !initialFile) return undefined;
    const t = setTimeout(() => lireFichier(initialFile), 0);
    return () => clearTimeout(t);
  }, [open, initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    const ttc = Number(form.montantTTC) || 0;
    const tva = tvaMontant(ttc / (1 + form.tauxTva / 100), form.tauxTva);
    const cat = DEPENSE_CATEGORIES.find((c) => c.id === form.categorie);
    addNoteFrais({
      commercant: form.commercant,
      date: form.date,
      categorie: form.categorie,
      categorieLabel: cat.label,
      compte: cat.compte,
      montantTTC: ttc,
      montantTVA: tva,
      montantHT: ttc - tva,
      justificatif: preview,
    });
    setStep(2);
  }

  return (
    <Modal open={open} onClose={close} title="Nouvelle note de frais">
      <Stepper steps={CAP_STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            Prenez le ticket en photo ou importez une image. Le montant, la date et le commerçant sont
            reconnus automatiquement — vous validerez à l'étape suivante.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
            {status === 'reading' ? (
              <>
                <Loader2 className="animate-spin text-brass" size={26} />
                <span className="text-[12.5px] text-ink-soft">Lecture du ticket…</span>
              </>
            ) : (
              <>
                <Camera className="text-ink-faint" size={26} />
                <span className="text-[13px] text-ink font-medium">Prendre une photo ou choisir un fichier</span>
                <span className="text-[11.5px] text-ink-faint">JPG, PNG ou PDF</span>
              </>
            )}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
          </label>
        </div>
      )}

      {step === 1 && form && (
        <div className="space-y-4">
          <div className="flex gap-4">
            {preview && <img src={preview} alt="Justificatif" className="w-24 h-24 object-cover rounded-lg border border-line shrink-0" />}
            <p className="text-[12px] text-ink-soft flex items-start gap-1.5">
              <Sparkles size={13} className="text-brass mt-0.5 shrink-0" />
              {status === 'fallback'
                ? "La lecture automatique n'a rien détecté sur cette image — complétez les champs manuellement."
                : 'Vérifiez les champs reconnus avant d\u2019enregistrer.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Commerçant"><Input value={form.commercant} onChange={(e) => setForm({ ...form, commercant: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Montant TTC" required><Input type="number" step="0.01" value={form.montantTTC} onChange={(e) => setForm({ ...form, montantTTC: e.target.value })} /></Field>
            <Field label="TVA">
              <Select value={form.tauxTva} onChange={(e) => setForm({ ...form, tauxTva: Number(e.target.value) })}>
                <option value={20}>20 %</option><option value={10}>10 %</option><option value={5.5}>5,5 %</option><option value={0}>0 %</option>
              </Select>
            </Field>
          </div>
          <Field label="Catégorie de dépense">
            <Select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {DEPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Retour</Button>
            <Button variant="brass" onClick={save} disabled={!form.montantTTC}>Enregistrer</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-4">
          <div className="flex justify-center mb-4"><Stamp label="Archivée" /></div>
          <div className="font-display text-[19px] text-ink">Dépense enregistrée</div>
          <p className="text-ink-soft text-[13px] mt-1.5">Le justificatif est archivé et la comptabilité mise à jour.</p>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="brass" onClick={close}>Terminer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function KmModal({ open, onClose }) {
  const { addNoteFrais, kmCumules, addKm } = useApp();
  const [form, setForm] = useState({ motif: '', date: new Date().toISOString().slice(0, 10), distance: '', cv: 5 });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const distance = Number(form.distance) || 0;
  const montant = calcIndemniteKm(form.cv, kmCumules, distance);

  function submit(e) {
    e.preventDefault();
    addNoteFrais({
      commercant: form.motif || 'Indemnité kilométrique',
      date: form.date,
      categorie: 'transport',
      categorieLabel: 'Carburant / transport',
      compte: '6251',
      montantTTC: montant,
      montantTVA: 0,
      montantHT: montant,
      km: distance,
    });
    addKm(distance);
    setForm({ motif: '', date: new Date().toISOString().slice(0, 10), distance: '', cv: 5 });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Frais kilométriques">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-ink-soft">
          Barème fiscal appliqué selon la puissance du véhicule et le cumul déjà parcouru cette année
          ({kmCumules.toLocaleString('fr-FR')} km).
        </p>
        <Field label="Motif du déplacement"><Input value={form.motif} onChange={set('motif')} placeholder="Visite du bien, rendez-vous client…" /></Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} /></Field>
          <Field label="Distance (km)"><Input type="number" value={form.distance} onChange={set('distance')} /></Field>
          <Field label="Puissance fiscale">
            <Select value={form.cv} onChange={set('cv')}>
              {[3, 4, 5, 6, 7].map((c) => <option key={c} value={c}>{c} CV{c === 7 ? ' et +' : ''}</option>)}
            </Select>
          </Field>
        </div>
        <div className="rounded-lg border border-brass/25 bg-brass-soft/40 p-4 flex items-center justify-between">
          <span className="text-[13px] text-ink">Indemnité calculée</span>
          <span className="font-display text-[20px] text-ink tabular">{formatEUR(montant)}</span>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass" disabled={!distance}>Ajouter aux frais</Button>
        </div>
      </form>
    </Modal>
  );
}
