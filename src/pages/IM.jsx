import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileStack, Sparkles, Download, UploadCloud, Loader2, ImagePlus, X, Wand2, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasApiKey, generateImTexts, extractImDataAI } from '../lib/ai';
import { extractTextFromFile, estImage } from '../lib/fileText';
import { useFileDrop } from '../hooks/useFileDrop';
import DropOverlay from '../components/DropOverlay';
import { matcherInvestisseurs } from '../lib/matching';
import { contactLabel } from '../lib/contactsSchema';
import { PageHeader, Card, Button, Field, Input, Textarea, Badge, EmptyState, Stepper } from '../components/ui';

const STEPS = ['Bien', 'Documents', 'Relecture', 'Export'];

async function downloadImPptx(bien, societe) {
  const { downloadImPptx: run } = await import('../lib/pptxIM');
  run(bien, societe);
}

export default function IM() {
  const { mandats, societe, dossiers, addDossier, contacts, addProspectsBulk } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(mandats.length ? 0 : -1);
  const [bien, setBien] = useState(null);
  const bienRef = useRef(bien);
  useEffect(() => { bienRef.current = bien; }, [bien]);
  const [dossierId, setDossierId] = useState(null);
  const [prospectsCrees, setProspectsCrees] = useState(false);
  const [docsLus, setDocsLus] = useState([]); // { nom, methode }
  const [pointsAttention, setPointsAttention] = useState([]);

  // Ouverture depuis le Copilote (« prépare l'IM de … ») : bien pré-rempli.
  useEffect(() => {
    const b = location.state?.bien;
    if (!b) return undefined;
    window.history.replaceState({}, '');
    const t = setTimeout(() => {
      setBien({
        adresse: '', typeBien: '', prix: '', surface: '', loyerAnnuel: '', dpe: '', description: '', charges: '',
        situationLocative: '', reference: '', locataire: '', dureeBail: '3/6/9', indexation: '', dateEffetBail: '',
        activiteLocataire: '', tripleNet: false, prixRecommande: '', modaliteVente: '', honorairesPct: '', environnement: '',
        photoPrincipale: '', photoComposition: '', photoSituation: '', photos: [], pointsCles: [], ...b,
      });
      setDocsLus([]); setPointsAttention([]);
      setStep(2);
    }, 0);
    return () => clearTimeout(t);
  }, [location.state]);

  const cibles = bien ? matcherInvestisseurs(contacts, { typeBien: bien.typeBien, adresse: bien.adresse, prix: bien.prix, loyerAnnuel: bien.loyerAnnuel, description: bien.description }, { limite: 10, minimum: 30 }) : [];

  function creerSuivi() {
    if (!cibles.length) return;
    addProspectsBulk(cibles.map((r) => ({
      dossierId: dossierId || '', prospect: contactLabel(r.contact), contact: [r.contact.prenom, r.contact.nom].filter(Boolean).join(' '),
      type: r.contact.vehicule === 'Family office' ? 'Family Office' : r.contact.vehicule === 'SCPI' ? 'SCPI' : /fonci/i.test(r.contact.vehicule || '') ? 'Foncière' : r.contact.vehicule === 'Investisseur privé' ? 'Privé' : 'Autre',
      statut: 'À contacter', prochaineAction: 'Envoyer l’IM', niveauInteret: r.score >= 70 ? 'Fort' : 'Moyen',
    })));
    setProspectsCrees(true);
  }
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  const imGeneres = dossiers.filter((d) => d.type === 'IM');

  function startFrom(m) {
    setBien({
      adresse: m.adresse, typeBien: m.typeBien, prix: m.prixVente, surface: m.surface,
      loyerAnnuel: m.loyerAnnuel, dpe: m.dpe, description: m.description || '', charges: '',
      situationLocative: '', reference: '', locataire: '', dureeBail: '3/6/9', indexation: '',
      dateEffetBail: '', activiteLocataire: '', tripleNet: m.typeMandat === 'Location',
      prixRecommande: '', modaliteVente: '', honorairesPct: '', environnement: '',
      photoPrincipale: '', photoComposition: '', photoSituation: '', photos: [], pointsCles: [],
    });
    setDocsLus([]); setPointsAttention([]); setAiError('');
    setStep(1);
  }

  async function handleDocs(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) ingerer(files);
  }

  // Dépôt de documents et de photos : les PDF / Word / Excel sont lus et
  // leurs données extraites par l'IA dans les champs de l'IM ; les images
  // sont affectées automatiquement (couverture, carte, plan, galerie).
  async function ingerer(files) {
    if (!bien) return;
    setUploading(true);
    const lus = [];
    const textes = [];
    try {
      for (const f of files.slice(0, 12)) {
        setUploadLabel(`Lecture de ${f.name}…`);
        if (estImage(f)) {
          const { fileToResizedDataUrl } = await import('../lib/image');
          const dataUrl = await fileToResizedDataUrl(f, 1600, 0.85);
          const n = f.name.toLowerCase();
          setBien((b) => {
            if (/carte|map|situation|plan de situation|localisation/.test(n) && !b.photoSituation) return { ...b, photoSituation: dataUrl };
            if (/plan|facade|façade|coupe|composition/.test(n) && !b.photoComposition) return { ...b, photoComposition: dataUrl };
            if (!b.photoPrincipale) return { ...b, photoPrincipale: dataUrl };
            return { ...b, photos: [...(b.photos || []), dataUrl].slice(0, 8) };
          });
          lus.push({ nom: f.name, methode: 'photo' });
          continue;
        }
        try {
          const r = await extractTextFromFile(f, { onProgress: (m) => setUploadLabel(`${f.name} — ${m}`) });
          if (r.texte?.trim()) textes.push({ nom: f.name, texte: r.texte });
          lus.push({ nom: f.name, methode: r.methode });
        } catch (err) {
          lus.push({ nom: f.name, methode: 'erreur', erreur: err.message });
        }
      }
      setDocsLus((d) => [...d, ...lus]);
      if (textes.length && hasApiKey(societe)) {
        setUploadLabel('Extraction des données du bien par l\u2019IA…');
        try {
          const data = await extractImDataAI(societe, { documents: textes, bienConnu: { adresse: bien.adresse, typeBien: bien.typeBien, surface: bien.surface, loyerAnnuel: bien.loyerAnnuel, locataire: bien.locataire } });
          setBien((b) => {
            const out = { ...b };
            const prend = (k, v) => { if (v !== null && v !== undefined && v !== '' && (out[k] === '' || out[k] === undefined || out[k] === null)) out[k] = v; };
            ['adresse', 'typeBien', 'surface', 'locataire', 'activiteLocataire', 'loyerAnnuel', 'charges', 'dureeBail', 'dateEffetBail', 'indexation', 'reference', 'dpe', 'situationLocative', 'prix'].forEach((k) => prend(k, data[k]));
            if (typeof data.tripleNet === 'boolean' && !b.locataire) out.tripleNet = data.tripleNet;
            return out;
          });
          if (Array.isArray(data.pointsAttention)) setPointsAttention(data.pointsAttention.filter(Boolean).slice(0, 8));
          // Puis les textes de présentation et les points clés, sur les champs encore vides.
          await new Promise((r) => setTimeout(r, 0));
          setUploadLabel('Rédaction des textes de présentation…');
          await redigerAvecIA();
        } catch (err) {
          setAiError(`Extraction IA impossible : ${err.message}`);
        }
      } else if (textes.length) {
        // Sans IA : repli sur l'extraction locale (référence cadastrale).
        const { parseActeFields } = await import('../lib/pdfExtract');
        const fields = parseActeFields(textes.map((t) => t.texte).join('\n'));
        setBien((b) => ({ ...b, reference: b.reference || fields.reference || '' }));
      }
    } finally {
      setUploading(false);
      setUploadLabel('');
      setStep(2);
    }
  }
  const { dragging } = useFileDrop(ingerer, { enabled: Boolean(bien) && step >= 1 && step <= 2 });

  async function handlePhoto(field, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { fileToResizedDataUrl } = await import('../lib/image');
    const dataUrl = await fileToResizedDataUrl(file, 1600, 0.85);
    setBien((b) => ({ ...b, [field]: dataUrl }));
  }

  // Rédaction assistée : complète uniquement les champs encore vides
  // (environnement, description de l'actif, activité du locataire) — ce que
  // vous avez déjà écrit n'est jamais écrasé.
  async function redigerAvecIA() {
    setAiBusy(true);
    setAiError('');
    try {
      const { photoPrincipale: _p1, photoComposition: _p2, photoSituation: _p3, photos: _p4, ...infos } = bienRef.current || bien;
      const textes = await generateImTexts(societe, infos);
      setBien((b) => ({
        ...b,
        environnement: b.environnement?.trim() ? b.environnement : (textes.environnement || b.environnement),
        description: b.description?.trim() ? b.description : (textes.descriptionActif || b.description),
        activiteLocataire: b.activiteLocataire?.trim() ? b.activiteLocataire : (textes.presentationLocataire || b.activiteLocataire),
        pointsCles: Array.isArray(textes.pointsCles) && textes.pointsCles.length ? textes.pointsCles : (b.pointsCles || []),
      }));
    } catch {
      setAiError("La rédaction assistée a échoué — vérifiez la clé API dans Paramètres → Intégrations, puis réessayez.");
    } finally {
      setAiBusy(false);
    }
  }

  function finish() {
    // La bibliothèque garde une trace du document (nom, statut) mais pas les
    // photos elles-mêmes — déjà présentes dans le .pptx téléchargé, elles
    // n'ont pas besoin d'être dupliquées dans le stockage local.
    const { photoPrincipale: _p1, photoComposition: _p2, photoSituation: _p3, photos: _p4, ...bienLeger } = bien;
    const rec = addDossier({ type: 'IM', nom: `IM — ${bien.adresse}`, bien: bienLeger, statut: 'Diffusé' });
    setDossierId(rec?.id || null);
    setProspectsCrees(false);
    setStep(3);
  }

  return (
    <div>
      <DropOverlay visible={dragging} titre="Déposez les documents et photos du bien" detail="Bail, état locatif, diagnostics, plaquette, photos, plan, capture Maps — tout est lu et affecté automatiquement" />
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
                  Déposez d'un coup tout ce que vous avez : bail, état locatif, diagnostics, plaquette, <span className="font-medium text-ink">photos</span> et plans. Les données du bien sont extraites par l'IA, les photos affectées automatiquement (nommez-les « carte… » ou « plan… » pour la situation et la composition).
                </p>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-9 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
                  {uploading ? (
                    <><Loader2 className="animate-spin text-brass" size={24} /><span className="text-[12.5px] text-ink-soft">{uploadLabel || 'Lecture des documents…'}</span></>
                  ) : (
                    <>
                      <UploadCloud className="text-ink-faint" size={24} />
                      <span className="text-[13px] text-ink font-medium">Déposer les documents et photos</span>
                      <span className="text-[11.5px] text-ink-faint">PDF, Word, Excel, images — ou glissez-les n'importe où sur la page</span>
                    </>
                  )}
                  <input type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" className="hidden" onChange={handleDocs} />
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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] text-ink-soft flex items-center gap-1.5"><Sparkles size={13} className="text-brass" /> Relisez et complétez avant génération.</p>
                  {hasApiKey(societe) && (
                    <Button variant="outline" onClick={redigerAvecIA} disabled={aiBusy} className="shrink-0">
                      {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {aiBusy ? 'Rédaction…' : "Rédiger avec l'IA"}
                    </Button>
                  )}
                </div>
                {aiError && (
                  <div className="flex items-center gap-2 text-[12px] text-rust"><AlertCircle size={13} /> {aiError}</div>
                )}
                {(docsLus.length > 0 || pointsAttention.length > 0) && (
                  <div className="rounded-lg border border-line bg-paper-raised px-3.5 py-2.5 text-[12px] space-y-1.5">
                    {docsLus.length > 0 && (
                      <div className="text-ink-soft"><span className="font-medium text-ink">Lus :</span> {docsLus.map((d) => d.nom).join(', ')}
                        <label className="ml-2 text-brass hover:text-brass-deep cursor-pointer">+ ajouter<input type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*" className="hidden" onChange={handleDocs} /></label>
                      </div>
                    )}
                    {pointsAttention.length > 0 && (
                      <div className="text-ink-soft"><span className="font-medium text-rust">À vérifier :</span> {pointsAttention.join(' · ')}</div>
                    )}
                  </div>
                )}
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
                  {(bien.photos || []).length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11.5px] font-medium text-ink mb-1">Galerie ({bien.photos.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {bien.photos.map((p, i) => (
                          <div key={i} className="relative h-16 w-24 rounded-lg overflow-hidden border border-line">
                            <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setBien({ ...bien, photos: bien.photos.filter((_, j) => j !== i) })} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-rust"><X size={11} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

                {cibles.length > 0 && (
                  <div className="mt-8 text-left rounded-xl border border-brass/25 bg-brass-soft/20 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-ink"><Users size={15} className="text-brass" /> Investisseurs à cibler ({cibles.length})</div>
                      {prospectsCrees
                        ? <span className="text-[12px] text-teal">Ajoutés au Suivi commercial ✓</span>
                        : <Button size="sm" variant="outline" onClick={creerSuivi}>Créer le suivi de diffusion</Button>}
                    </div>
                    <ul className="space-y-1.5">
                      {cibles.map((r) => (
                        <li key={r.contact.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                          <div className="min-w-0"><span className="text-ink font-medium">{contactLabel(r.contact)}</span><span className="text-ink-faint"> — {r.raisons.join(' · ')}</span></div>
                          <span className={`shrink-0 tabular font-semibold ${r.score >= 70 ? 'text-teal' : 'text-brass'}`}>{r.score} %</span>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => navigate('/assistant', { state: { prefill: { question: `Lance la campagne de diffusion de l'IM « ${bien.adresse} » : pour chacun des investisseurs ciblés, prépare l'email personnalisé d'envoi du teaser et trace l'envoi dans le Suivi commercial.` } } })}
                      className="mt-3 text-[12px] text-brass hover:text-brass-deep inline-flex items-center gap-1"><Sparkles size={12} /> Confier la campagne au Copilote <ArrowRight size={12} /></button>
                  </div>
                )}
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
