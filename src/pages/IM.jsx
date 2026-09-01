import { useState } from 'react';
import { FileStack, Sparkles, Download, UploadCloud, Loader2, Plus, ImagePlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR } from '../lib/calc';
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Badge, EmptyState, Stepper } from '../components/ui';

const STEPS = ['Bien', 'Documents', 'Relecture', 'Export'];

async function downloadImPptx(bien, societe) {
  const { downloadImPptx: run } = await import('../lib/pptxIM');
  run(bien, societe);
}

export default function IM() {
  const { mandats, societe, dossiers, addDossier, updateDossier } = useApp();
  const [step, setStep] = useState(mandats.length ? 0 : -1);
  const [mandatId, setMandatId] = useState(mandats[0]?.id || '');
  const [bien, setBien] = useState(null);
  const [uploading, setUploading] = useState(false);

  const imGeneres = dossiers.filter((d) => d.type === 'IM');
  const mandat = mandats.find((m) => m.id === mandatId);

  function startFrom(m) {
    setBien({
      adresse: m.adresse, typeBien: m.typeBien, prix: m.prixVente, surface: m.surface,
      loyerAnnuel: m.loyerAnnuel, dpe: m.dpe, description: m.description || '', charges: '',
      situationLocative: '', reference: '', locataire: '', dureeBail: '3/6/9', indexation: '',
      dateEffetBail: '', activiteLocataire: '', tripleNet: m.typeMandat === 'Location',
      prixRecommande: '', modaliteVente: '', honorairesPct: '', environnement: '',
      photoPrincipale: '', photoComposition: '', photoSituation: '',
    });
    setMandatId(m.id);
    setStep(1);
  }

  async function handleDocs(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    try {
      const { extractPdfText, parseActeFields } = await import('../lib/pdfExtract');
      for (const f of files.filter((f) => f.type === 'application/pdf')) {
        const text = await extractPdfText(f);
        const fields = parseActeFields(text);
        setBien((b) => ({
          ...b,
          reference: b.reference || fields.reference,
          description: b.description || '',
        }));
      }
    } finally {
      setUploading(false);
      setStep(2);
    }
  }

  async function handlePhoto(field, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { fileToResizedDataUrl } = await import('../lib/image');
    const dataUrl = await fileToResizedDataUrl(file, 1600, 0.85);
    setBien((b) => ({ ...b, [field]: dataUrl }));
  }

  function finish() {
    // La bibliothèque garde une trace du document (nom, statut) mais pas les
    // photos elles-mêmes — déjà présentes dans le .pptx téléchargé, elles
    // n'ont pas besoin d'être dupliquées dans le stockage local.
    const { photoPrincipale, photoComposition, photoSituation, ...bienLeger } = bien;
    addDossier({ type: 'IM', nom: `IM — ${bien.adresse}`, bien: bienLeger, statut: 'Diffusé' });
    setStep(3);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Production commerciale"
        title="Memorandums (IM)"
        description="Générez un Information Memorandum prêt à diffuser à partir des documents d'un bien."
      />

      {mandats.length === 0 ? (
        <EmptyState icon={FileStack} title="Créez d'abord un mandat" description="L'IM s'appuie sur les données d'un mandat existant." />
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <Stepper steps={STEPS} current={Math.max(step, 0)} />

            {step <= 0 && (
              <div className="space-y-3">
                <p className="text-[13px] text-ink-soft mb-2">Choisissez le mandat concerné.</p>
                {mandats.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => startFrom(m)}
                    className="w-full flex items-center justify-between rounded-lg border border-line px-4 py-3 text-left hover:border-brass hover:bg-brass-soft/30 transition-colors"
                  >
                    <div>
                      <div className="text-[13.5px] text-ink font-medium">{m.adresse}</div>
                      <div className="text-[11.5px] text-ink-faint">{m.typeBien} · {m.typeMandat}</div>
                    </div>
                    <span className="text-[12px] text-brass">Choisir →</span>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && bien && (
              <div className="space-y-4">
                <p className="text-[13px] text-ink-soft">
                  Ajoutez les documents du bien (bail, diagnostics, état locatif…) pour compléter automatiquement le dossier.
                </p>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-9 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
                  {uploading ? (
                    <><Loader2 className="animate-spin text-brass" size={24} /><span className="text-[12.5px] text-ink-soft">Lecture des documents…</span></>
                  ) : (
                    <>
                      <UploadCloud className="text-ink-faint" size={24} />
                      <span className="text-[13px] text-ink font-medium">Déposer les documents (PDF, images)</span>
                      <span className="text-[11.5px] text-ink-faint">Bail, diagnostics, plans, photos…</span>
                    </>
                  )}
                  <input type="file" multiple className="hidden" onChange={handleDocs} />
                </label>
                <div className="text-center">
                  <button onClick={() => setStep(2)} className="text-[12px] text-ink-faint hover:text-ink underline underline-offset-2">
                    Continuer sans document
                  </button>
                </div>
              </div>
            )}

            {step === 2 && bien && (
              <div className="space-y-4">
                <p className="text-[12.5px] text-ink-soft flex items-center gap-1.5"><Sparkles size={13} className="text-brass" /> Relisez et complétez avant génération.</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Prix / valeur"><Input type="number" value={bien.prix} onChange={(e) => setBien({ ...bien, prix: e.target.value })} /></Field>
                  <Field label="Loyer annuel"><Input type="number" value={bien.loyerAnnuel} onChange={(e) => setBien({ ...bien, loyerAnnuel: e.target.value })} /></Field>
                  <Field label="Surface (m²)"><Input type="number" value={bien.surface} onChange={(e) => setBien({ ...bien, surface: e.target.value })} /></Field>
                  <Field label="DPE"><Input value={bien.dpe} onChange={(e) => setBien({ ...bien, dpe: e.target.value })} /></Field>
                  <Field label="Situation locative"><Input value={bien.situationLocative} onChange={(e) => setBien({ ...bien, situationLocative: e.target.value })} /></Field>
                  <Field label="Référence cadastrale"><Input value={bien.reference} onChange={(e) => setBien({ ...bien, reference: e.target.value })} /></Field>
                </div>
                <Field label="Présentation du bien">
                  <Textarea value={bien.description} onChange={(e) => setBien({ ...bien, description: e.target.value })} placeholder="Points forts, environnement, potentiel locatif…" />
                </Field>

                <div className="pt-2 border-t border-line-soft">
                  <div className="text-[12px] font-medium text-ink mt-4 mb-1">Visuels</div>
                  <p className="text-[11.5px] text-ink-faint mb-3">
                    Une présentation sans photo se voit tout de suite — ajoutez au moins la photo principale.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <PhotoField label="Photo principale" hint="Couverture" value={bien.photoPrincipale} onChange={(e) => handlePhoto('photoPrincipale', e)} onClear={() => setBien({ ...bien, photoPrincipale: '' })} />
                    <PhotoField label="Carte / emplacement" hint="Capture Maps" value={bien.photoSituation} onChange={(e) => handlePhoto('photoSituation', e)} onClear={() => setBien({ ...bien, photoSituation: '' })} />
                    <PhotoField label="Plan / façade" hint="Composition" value={bien.photoComposition} onChange={(e) => handlePhoto('photoComposition', e)} onClear={() => setBien({ ...bien, photoComposition: '' })} />
                  </div>
                  {bien.photoSituation && (
                    <Field label="Présentation de l'emplacement" hint="Texte affiché à côté de la carte">
                      <Textarea value={bien.environnement} onChange={(e) => setBien({ ...bien, environnement: e.target.value })} placeholder="Accessibilité, bassin économique, environnement immédiat…" />
                    </Field>
                  )}
                </div>

                <div className="pt-2 border-t border-line-soft">
                  <div className="text-[12px] font-medium text-ink mt-4 mb-3">Conditions financières du bail</div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Locataire en place"><Input value={bien.locataire} onChange={(e) => setBien({ ...bien, locataire: e.target.value })} placeholder="Nom de l'enseigne" /></Field>
                    <Field label="Durée du bail"><Input value={bien.dureeBail} onChange={(e) => setBien({ ...bien, dureeBail: e.target.value })} placeholder="3/6/9" /></Field>
                    <Field label="Indexation"><Input value={bien.indexation} onChange={(e) => setBien({ ...bien, indexation: e.target.value })} placeholder="ILC, révision triennale…" /></Field>
                    <Field label="Date d'effet du bail"><Input type="date" value={bien.dateEffetBail} onChange={(e) => setBien({ ...bien, dateEffetBail: e.target.value })} /></Field>
                  </div>
                  <Field label="Activité du locataire" hint="Décrit l'activité exercée dans les lieux">
                    <Textarea value={bien.activiteLocataire} onChange={(e) => setBien({ ...bien, activiteLocataire: e.target.value })} />
                  </Field>
                  <label className="flex items-center gap-2 text-[12.5px] text-ink-soft mt-3">
                    <input type="checkbox" checked={bien.tripleNet} onChange={(e) => setBien({ ...bien, tripleNet: e.target.checked })} className="rounded border-line" />
                    Loyer triple net (charges récupérables)
                  </label>
                </div>

                <div className="pt-2 border-t border-line-soft">
                  <div className="text-[12px] font-medium text-ink mt-4 mb-3">Conditions de cession</div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Prix net vendeur recommandé"><Input type="number" value={bien.prixRecommande} onChange={(e) => setBien({ ...bien, prixRecommande: e.target.value })} /></Field>
                    <Field label="Honoraires (% HT)"><Input type="number" value={bien.honorairesPct} onChange={(e) => setBien({ ...bien, honorairesPct: e.target.value })} placeholder="4" /></Field>
                  </div>
                  <Field label="Modalité de vente"><Input value={bien.modaliteVente} onChange={(e) => setBien({ ...bien, modaliteVente: e.target.value })} placeholder="Vente d'actif de gré à gré…" /></Field>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>Retour</Button>
                  <Button variant="brass" onClick={finish}>Générer l'IM</Button>
                </div>
              </div>
            )}

            {step === 3 && bien && (
              <div className="text-center py-6">
                <div className="font-display text-[19px] text-ink">IM prêt pour {bien.adresse}</div>
                <p className="text-ink-soft text-[13px] mt-1.5">Structure reprenant votre charte : couverture, synthèse, caractéristiques, contact.</p>
                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" onClick={() => { setStep(mandats.length ? 0 : -1); setBien(null); }}>Nouveau document</Button>
                  <Button variant="brass" onClick={() => downloadImPptx(bien, societe)}><Download size={15} /> Télécharger (.pptx)</Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-display text-[16px] text-ink mb-4">Bibliothèque d'IM</h3>
            {imGeneres.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Aucun document généré pour l'instant.</p>
            ) : (
              <ul className="space-y-3">
                {imGeneres.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-[13px]">
                    <span className="truncate text-ink">{d.nom}</span>
                    <Badge tone="teal">{d.statut}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PhotoField({ label, hint, value, onChange, onClear }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-ink mb-1">{label}</div>
      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-line h-20">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-rust"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 h-20 rounded-lg border-2 border-dashed border-line cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
          <ImagePlus size={16} className="text-ink-faint" />
          <span className="text-[10px] text-ink-faint">{hint}</span>
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </label>
      )}
    </div>
  );
}
