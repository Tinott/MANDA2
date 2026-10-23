import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bot, Send, Loader2, Sparkles, AlertCircle, RefreshCw, ArrowRight, CalendarCheck,
  UserSearch, Scale, Globe2, Megaphone, Mails, Paperclip, Copy, Check, X, Mic, MicOff,
  Share2, Users, ClipboardList, FileText, Trash2, CheckCircle2, Wrench, BookMarked,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  hasApiKey, askAgent, dailyBriefing, buildAppSnapshot, analyseDocument,
  ficheProspect, avisDeValeur, veilleMarche, genererTeaser, sequenceProspection, postLinkedIn,
} from '../lib/ai';
import { TOOLS, createToolExecutor } from '../lib/agentTools';
import { buildAlerts } from '../lib/relances';
import { matcherInvestisseurs } from '../lib/matching';
import { contactLabel } from '../lib/contactsSchema';
import { extractTextFromFile, TYPES_ACCEPTES } from '../lib/fileText';
import { useFileDrop } from '../hooks/useFileDrop';
import { usePersistedState } from '../hooks/useNavMemory';
import DropOverlay from '../components/DropOverlay';
import { formatEUR } from '../lib/calc';
import { PageHeader, Card, Button, EmptyState, Field, Input, Textarea, Select } from '../components/ui';

const SUGGESTIONS = [
  'Quelles sont mes échéances à risque ce mois-ci ?',
  'Fais-moi le point sur chaque promesse en cours.',
  'Qui dois-je relancer cette semaine ? Prépare les emails.',
  'Crée une facture brouillon pour le dossier le plus avancé.',
  'Rédige un NDA pour la cession d’un actif, acquéreur à compléter.',
  'Prépare une lettre de process et un index de data room.',
];

// --- Productions à la demande (plan CARDO) ---
const ACTIONS = [
  {
    id: 'prospect', icon: UserSearch, titre: 'Fiche prospect', web: true,
    desc: 'Recherche web : société, dirigeants, patrimoine, angle d’approche.',
    champs: [
      { id: 'cible', label: 'Société ou personne à étudier', ph: 'LIDL France, foncière X, M. Dupont (dirigeant de…)…', requis: true },
      { id: 'contexte', label: 'Objectif (optionnel)', ph: 'Obtenir un mandat sur leur site de…' },
    ],
    run: (societe, v, { snapshot }) => ficheProspect(societe, { cible: v.cible, contexte: v.contexte, snapshot }),
    etiquette: (v) => `Fiche prospect — ${v.cible}`,
  },
  {
    id: 'avis', icon: Scale, titre: 'Avis de valeur', web: true,
    desc: 'Comparables recherchés sur le web, fourchette argumentée.',
    champs: [{ id: 'bien', label: 'Décrivez le bien (type, surface, loyer, bail, localisation…)', ph: 'Bâtiment d’activité 3 475 m² à Champagnier (38), loué TESLA, 288 000 € HT/an, bail 3/6/9…', textarea: true, requis: true }],
    run: (societe, v) => avisDeValeur(societe, { bien: { description: v.bien } }),
    etiquette: (v) => `Avis de valeur — ${v.bien.slice(0, 60)}…`,
  },
  {
    id: 'cibles', icon: Users, titre: 'Investisseurs à cibler',
    desc: 'Rapproche votre carnet d’un bien du portefeuille : score, raisons, puis campagne.',
    champs: [{ id: 'mandatId', label: 'Bien / mandat', select: 'mandats', requis: true }],
    local: true,
  },
  {
    id: 'teaser', icon: Megaphone, titre: 'Teaser anonymisé',
    desc: 'Une page pré-NDA : jamais le vendeur ni l’adresse exacte.',
    champs: [{ id: 'bien', label: 'Le bien et ses indicateurs clés', ph: 'Type, agglomération, surface, locataire (secteur), loyer, durée ferme, prix ou « sur demande »…', textarea: true, requis: true }],
    run: (societe, v) => genererTeaser(societe, { description: v.bien }),
    etiquette: () => 'Teaser anonymisé',
  },
  {
    id: 'veille', icon: Globe2, titre: 'Veille marché', web: true,
    desc: 'Transactions, taux, mouvements d’investisseurs — sourcé et daté.',
    champs: [],
    run: (societe) => veilleMarche(societe),
    etiquette: () => 'Veille marché du jour',
  },
  {
    id: 'sequence', icon: Mails, titre: 'Séquence de prospection',
    desc: '3 emails + 2 relances, personnalisés par profil de cible.',
    champs: [
      { id: 'cible', label: 'Cible', ph: 'Dirigeant de…, foncière…, SCPI…', requis: true },
      { id: 'profil', label: 'Profil', ph: 'Propriétaire utilisateur, foncière, family office, SCPI…' },
      { id: 'objectif', label: 'Objectif (optionnel)', ph: 'Rendez-vous, mandat de vente, off-market…' },
    ],
    run: (societe, v, { snapshot }) => sequenceProspection(societe, { cible: v.cible, profil: v.profil, objectif: v.objectif, snapshot }),
    etiquette: (v) => `Séquence de prospection — ${v.cible}`,
  },
  {
    id: 'linkedin', icon: Share2, titre: 'Post LinkedIn',
    desc: 'Un post sobre et pro, publié en un clic.',
    champs: [{ id: 'sujet', label: 'Sujet du post', ph: 'Signature d’un mandat exclusif, retour sur une transaction, point de marché…', textarea: true, requis: true }],
    run: (societe, v, { snapshot }) => postLinkedIn(societe, { sujet: v.sujet, snapshot }),
    etiquette: (v) => `Post LinkedIn — ${v.sujet.slice(0, 60)}`,
    kind: 'linkedin',
  },
  {
    id: 'cr', icon: ClipboardList, titre: 'Compte rendu de visite',
    desc: 'Dictez ou tapez vos notes : CR structuré, échanges notés sur les contacts, relances programmées.',
    champs: [{ id: 'notes', label: 'Vos notes brutes (le micro fonctionne ici aussi)', ph: 'Visite du bâtiment de Lescar avec M. X de la foncière Y : intéressé si le loyer passe à…, veut le bail et les diagnostics, relance vendredi…', textarea: true, requis: true, dictee: true }],
    agent: (v) => `Voici mes notes brutes après un rendez-vous / une visite :\n\n${v.notes}\n\nFais le travail de secrétaire : (1) rédige un compte rendu structuré (contexte, points abordés, position de chaque partie, actions à mener avec dates) ; (2) note l'échange dans l'historique des contacts concernés (crée le contact s'il n'existe pas) ; (3) programme les relances ; (4) mémorise le compte rendu dans la bibliothèque ; (5) propose, si pertinent, l'email de suivi à envoyer.`,
    etiquette: () => 'Compte rendu de visite',
  },
];

const ROUTES_VALIDES = new Set(['/promesses', '/mandats', '/facturation', '/suivi', '/mail', '/documents', '/im', '/frais', '/comptabilite', '/contacts']);
const BRIEF_KEY = () => `manda2.briefing.${new Date().toISOString().slice(0, 10)}`;
const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function linkedinShareUrl(text) {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

export default function Assistant() {
  const app = useApp();
  const { societe } = app;
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = usePersistedState('assistant.history', []); // {role, content, actions?, kind?}
  const [attachments, setAttachments] = usePersistedState('assistant.attachments', []); // {id, nom, texte, methode}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [liveActions, setLiveActions] = useState([]);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [vals, setVals] = useState({});
  const [brief, setBrief] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BRIEF_KEY()) || 'null'); } catch { return null; }
  });
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const snapshot = useMemo(() => buildAppSnapshot(app), [app]);
  const alerts = useMemo(() => buildAlerts(app), [app]);
  const aDesDonnees = (app.mandats?.length || 0) + (app.promesses?.length || 0) + (app.factures?.length || 0) + (app.prospects?.length || 0) + (app.contacts?.length || 0) > 0;
  const execute = useMemo(() => createToolExecutor({ app, navigate, societe }), [app, navigate, societe]);

  function scroll() { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); }
  function pushMsg(m) { setHistory((h) => [...h, m].slice(-60)); }

  // --- Briefing du jour (1 fois/jour) ---
  async function loadBrief() {
    if (!hasApiKey(societe) || !aDesDonnees) return;
    setBriefBusy(true); setBriefError('');
    try {
      const b = await dailyBriefing(societe, { snapshot, alerts });
      b.actions = (b.actions || []).map((a) => ({ ...a, route: ROUTES_VALIDES.has(a.route) ? a.route : null }));
      setBrief(b);
      localStorage.setItem(BRIEF_KEY(), JSON.stringify(b));
    } catch (e) { setBriefError(e.message); }
    setBriefBusy(false);
  }
  useEffect(() => {
    if (brief) return undefined;
    const t = setTimeout(loadBrief, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Arrivée depuis une autre page (fiche contact → « Fiche IA », etc.) ---
  useEffect(() => {
    const pre = location.state?.prefill;
    if (!pre) return undefined;
    window.history.replaceState({}, '');
    const t = setTimeout(() => {
      if (pre.question) { setInput(pre.question); }
      if (pre.actionId) { const a = ACTIONS.find((x) => x.id === pre.actionId); if (a) { setAction(a); setVals(pre.vals || {}); } }
    }, 0);
    return () => clearTimeout(t);
  }, [location.state]);

  // --- Dictée (reconnaissance vocale du navigateur) ---
  function toggleDictee(onText) {
    if (!SpeechRecognition) return;
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' ';
      if (t) onText(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }
  useEffect(() => () => recRef.current?.stop(), []);

  // --- Fichiers déposés : lecture, analyse IA, mémorisation en bibliothèque ---
  async function ingererFichiers(files) {
    for (const file of files.slice(0, 5)) {
      setBusy(true); setBusyLabel(`Lecture de ${file.name}…`); setError('');
      try {
        const r = await extractTextFromFile(file, { onProgress: (m) => setBusyLabel(`${file.name} — ${m}`) });
        if (!r.texte?.trim()) throw new Error(r.avertissement || 'Aucun texte lisible dans ce fichier.');
        const att = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, nom: file.name, texte: r.texte.slice(0, 60000), methode: r.methode };
        setAttachments((a) => [...a.filter((x) => x.nom !== file.name), att].slice(-6));
        pushMsg({ role: 'user', content: `📎 Document déposé — ${file.name}` });
        scroll();
        if (hasApiKey(societe)) {
          setBusyLabel(`Analyse de ${file.name}…`);
          const analyse = await analyseDocument(societe, { nom: file.name, texte: r.texte });
          app.addDocument({ type: 'bibliotheque', nom: file.name, resume: analyse.slice(0, 2500), tags: [r.methode], statut: 'Mémorisé' });
          pushMsg({ role: 'assistant', content: analyse, actions: [{ outil: 'enregistrer_dans_bibliotheque', resume: `Mémorisé dans la bibliothèque : ${file.name}` }] });
          scroll();
        }
      } catch (e) {
        setError(`${file.name} : ${e.message}`);
      }
    }
    setBusy(false); setBusyLabel('');
  }
  const { dragging } = useFileDrop(ingererFichiers, { enabled: hasApiKey(societe) });

  // --- Productions / questions ---
  async function produire(etiquette, promesse, label, kind) {
    setBusy(true); setBusyLabel(label || ''); setError(''); setLiveActions([]);
    pushMsg({ role: 'user', content: etiquette });
    scroll();
    try {
      const out = await promesse;
      if (typeof out === 'string') pushMsg({ role: 'assistant', content: out, kind });
      else pushMsg({ role: 'assistant', content: out.texte, actions: out.actions, kind });
      scroll();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false); setBusyLabel(''); setLiveActions([]);
  }

  function agent(question) {
    const hist = history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-16).map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 12000) }));
    hist.push({ role: 'user', content: question });
    return askAgent(societe, { history: hist, snapshot, alerts, attachments, tools: TOOLS, execute, onAction: (a) => setLiveActions((l) => [...l, a]) });
  }

  async function send(text) {
    const question = (text || input).trim();
    if (!question || busy) return;
    setInput('');
    await produire(question, agent(question), 'Je m’en occupe…');
  }

  function lancerAction() {
    const manquant = action.champs.find((c) => c.requis && !String(vals[c.id] || '').trim());
    if (manquant) { setError(`Champ requis : ${manquant.label}`); return; }
    const a = action; const v = { ...vals };
    setAction(null); setVals({});
    if (a.local && a.id === 'cibles') {
      const m = app.mandats.find((x) => x.id === v.mandatId);
      const res = matcherInvestisseurs(app.contacts, { typeBien: m.typeBien, adresse: m.adresse, prix: m.prixVente, loyerAnnuel: m.loyerAnnuel, description: m.description }, { limite: 15, minimum: 25 });
      const texte = res.length
        ? `Investisseurs à cibler pour ${m.adresse} (${m.typeBien || 'bien'}${m.prixVente ? `, ${formatEUR(m.prixVente)}` : ''}) :\n\n${res.map((r, i) => `${i + 1}. ${contactLabel(r.contact)} — ${r.score} %\n   ${r.raisons.join(' · ')}${r.contact.email ? `\n   ${r.contact.email}` : ''}`).join('\n\n')}\n\nDites-moi « lance la campagne » pour préparer les emails personnalisés et tracer les envois dans le Suivi commercial.`
        : `Aucun contact du carnet ne correspond aux critères de ${m.adresse}. Complétez les profils investisseurs (classes d'actifs, zones, ticket) dans Contacts pour activer le rapprochement.`;
      pushMsg({ role: 'user', content: `⚡ Investisseurs à cibler — ${m.adresse}` });
      pushMsg({ role: 'assistant', content: texte });
      scroll();
      return;
    }
    if (a.agent) {
      produire(`⚡ ${a.etiquette(v)}`, agent(a.agent(v)), 'Je m’en occupe (compte rendu, contacts, relances)…');
      return;
    }
    produire(`⚡ ${a.etiquette(v)}`, a.run(societe, v, { snapshot }), a.web ? 'Recherche web et rédaction en cours (30 à 90 s)…' : 'Rédaction en cours…', a.kind);
  }

  function nouvelleConversation() {
    setHistory([]); setAttachments([]); setError(''); setLiveActions([]);
  }

  return (
    <div>
      <DropOverlay visible={dragging} titre="Déposez vos documents pour le Copilote" detail="Bail, état locatif, acte, diagnostic, ticket, Excel… — lus, analysés et mémorisés" />
      <PageHeader
        eyebrow="Intelligence artificielle"
        title="Copilote"
        description="Votre collaboratrice : elle connaît tout, agit dans l'application (contacts, suivi, factures, emails, IM, documents), lit ce que vous déposez, et fait le point chaque matin."
      />

      {!hasApiKey(societe) ? (
        <EmptyState icon={Bot} title="L'IA n'est pas activée" description="L'administrateur peut activer l'IA de l'application (Paramètres > Intégrations > Administrateur), ou choisissez « Ma propre clé API » dans Paramètres > Intégrations." />
      ) : (
        <div className="space-y-5">
          {aDesDonnees && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><CalendarCheck size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Le point du jour</h3></div>
                <Button variant="ghost" onClick={loadBrief} disabled={briefBusy} className="!px-2.5"><RefreshCw size={13} className={briefBusy ? 'animate-spin' : ''} /> Actualiser</Button>
              </div>
              {briefBusy && !brief && <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Loader2 size={14} className="animate-spin" /> Votre collaboratrice prépare le briefing…</div>}
              {briefError && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {briefError}</div>}
              {brief && (
                <div>
                  <p className="text-[13.5px] text-ink leading-relaxed">{brief.resume}</p>
                  {(brief.actions || []).length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {brief.actions.map((a, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-paper-raised px-3.5 py-2.5">
                          <div><div className="text-[13px] font-medium text-ink">{a.titre}</div><div className="text-[12px] text-ink-soft">{a.detail}</div></div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => send(`Occupe-toi de ceci : ${a.titre}. ${a.detail}`)} className="text-[12px] text-brass hover:text-brass-deep flex items-center gap-1" title="Confier au Copilote"><Sparkles size={12} /> Faire</button>
                            {a.route && <Link to={a.route} className="text-[12px] text-ink-faint hover:text-ink flex items-center gap-1">Ouvrir <ArrowRight size={12} /></Link>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2.5">Productions à la demande</div>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => {
                const Icon = a.icon; const actif = action?.id === a.id;
                return (
                  <button key={a.id} type="button" title={a.desc} disabled={busy} onClick={() => { setError(''); setVals({}); setAction(actif ? null : a); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${actif ? 'border-brass bg-brass-soft/50 text-ink' : 'border-line text-ink-soft hover:border-brass/50 hover:text-ink'}`}>
                    <Icon size={13} className="text-brass" /> {a.titre}
                  </button>
                );
              })}
              <button type="button" title="Déposez un bail, un état locatif, un diagnostic, une promesse, un Excel… (ou glissez-les n'importe où sur la page)" disabled={busy} onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-soft hover:border-brass/50 hover:text-ink transition-colors">
                <Paperclip size={13} className="text-brass" /> Analyser un document
              </button>
              <input ref={fileRef} type="file" multiple accept={TYPES_ACCEPTES} className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) ingererFichiers(f); }} />
            </div>

            {action && (
              <div className="mt-4 rounded-xl border border-brass/30 bg-brass-soft/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div><div className="text-[13px] font-medium text-ink">{action.titre}</div><div className="text-[11.5px] text-ink-faint">{action.desc}</div></div>
                  <button type="button" onClick={() => setAction(null)} className="text-ink-faint hover:text-ink"><X size={15} /></button>
                </div>
                <div className="space-y-3">
                  {action.champs.map((c) => (
                    <Field key={c.id} label={c.label}>
                      {c.select === 'mandats' ? (
                        <Select value={vals[c.id] || ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })}>
                          <option value="">Choisir un bien…</option>
                          {app.mandats.map((m) => <option key={m.id} value={m.id}>{m.adresse}{m.typeBien ? ` — ${m.typeBien}` : ''}</option>)}
                        </Select>
                      ) : c.textarea ? (
                        <div className="relative">
                          <Textarea rows={4} value={vals[c.id] || ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder={c.ph} className={c.dictee && SpeechRecognition ? 'pr-11' : ''} />
                          {c.dictee && SpeechRecognition && (
                            <button type="button" onClick={() => toggleDictee((t) => setVals((v) => ({ ...v, [c.id]: `${v[c.id] || ''}${t}` })))} title={listening ? 'Arrêter la dictée' : 'Dicter'}
                              className={`absolute right-2 top-2 h-8 w-8 rounded-lg flex items-center justify-center ${listening ? 'bg-rust text-white animate-pulse' : 'text-ink-faint hover:text-brass hover:bg-brass-soft'}`}>
                              {listening ? <MicOff size={15} /> : <Mic size={15} />}
                            </button>
                          )}
                        </div>
                      ) : (
                        <Input value={vals[c.id] || ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder={c.ph} onKeyDown={(e) => e.key === 'Enter' && lancerAction()} />
                      )}
                    </Field>
                  ))}
                  <Button variant="brass" onClick={lancerAction} disabled={busy}><Sparkles size={14} /> Lancer</Button>
                </div>
              </div>
            )}
          </Card>

          <Card padded={false} className="flex flex-col h-[60vh]">
            {(attachments.length > 0 || history.length > 0) && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-line-soft text-[11.5px] text-ink-faint overflow-x-auto">
                {attachments.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-paper-raised border border-line px-2 py-0.5 text-ink whitespace-nowrap">
                    <FileText size={11} className="text-brass" /> {a.nom}
                    <button type="button" onClick={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} className="hover:text-rust"><X size={10} /></button>
                  </span>
                ))}
                <button type="button" onClick={nouvelleConversation} className="ml-auto inline-flex items-center gap-1 hover:text-ink whitespace-nowrap"><Trash2 size={11} /> Nouvelle conversation</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {history.length === 0 && (
                <div>
                  <div className="text-[13px] text-ink-faint mb-3">Demandez-lui de faire, pas seulement de dire — par exemple :</div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-left text-[12.5px] px-3 py-2 rounded-lg border border-line bg-paper-raised hover:border-brass/50 hover:bg-brass-soft/30 transition-colors"><Sparkles size={11} className="inline mr-1.5 text-brass" />{s}</button>
                    ))}
                  </div>
                  <div className="mt-4 text-[12px] text-ink-faint flex items-center gap-1.5"><Paperclip size={12} /> Glissez un document n'importe où sur cette page : il est lu, analysé et mémorisé.</div>
                </div>
              )}
              {history.map((m, i) => <MessageBulle key={i} m={m} />)}
              {busy && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Loader2 size={14} className="animate-spin" /> {busyLabel || 'Analyse en cours…'}</div>
                  {liveActions.map((a, i) => <div key={i} className="flex items-center gap-1.5 text-[12px] text-ink-soft pl-5"><Wrench size={11} className="text-brass" /> {a.resume}</div>)}
                </div>
              )}
              {error && <div className="flex items-center gap-2 text-[13px] text-rust"><AlertCircle size={14} /> {error}</div>}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-line p-4 flex gap-2">
              <button type="button" title="Déposer un document" onClick={() => fileRef.current?.click()} disabled={busy} className="shrink-0 h-[42px] w-[42px] rounded-lg border border-line text-ink-faint hover:text-ink hover:border-brass/50 flex items-center justify-center transition-colors"><Paperclip size={16} /></button>
              {SpeechRecognition && (
                <button type="button" title={listening ? 'Arrêter la dictée' : 'Dicter votre demande'} onClick={() => toggleDictee((t) => setInput((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}${t}`))} disabled={busy}
                  className={`shrink-0 h-[42px] w-[42px] rounded-lg border flex items-center justify-center transition-colors ${listening ? 'border-rust bg-rust text-white animate-pulse' : 'border-line text-ink-faint hover:text-ink hover:border-brass/50'}`}>
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="« Note que j'ai eu M. Dupont, relance vendredi », « prépare l'IM du bâtiment de Lescar », « facture NCAP »…"
                className="flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13.5px] focus:outline-none focus:border-brass" />
              <Button variant="brass" onClick={() => send()} disabled={busy || !input.trim()}><Send size={15} /></Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MessageBulle({ m }) {
  const [copied, setCopied] = useState(false);
  async function copier() {
    try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* presse-papiers indisponible */ }
  }
  if (m.role === 'user') {
    return <div className="max-w-[85%] ml-auto"><div className="rounded-xl px-4 py-3 text-[13.5px] whitespace-pre-wrap bg-ink text-white">{m.content}</div></div>;
  }
  return (
    <div className="max-w-[88%] group">
      <div className="rounded-xl px-4 py-3 text-[13.5px] whitespace-pre-wrap bg-paper-raised border border-line text-ink">{m.content}</div>
      {m.actions?.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {m.actions.map((a, i) => (
            <li key={i} className={`flex items-center gap-1.5 text-[12px] ${a.erreur ? 'text-rust' : 'text-ink-soft'}`}>
              {a.outil === 'enregistrer_dans_bibliotheque' ? <BookMarked size={12} className="text-brass" /> : a.erreur ? <AlertCircle size={12} /> : <CheckCircle2 size={12} className="text-teal" />}
              {a.resume}
            </li>
          ))}
        </ul>
      )}
      <div className={`mt-1 flex items-center gap-3 transition-opacity ${m.kind === 'linkedin' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button type="button" onClick={copier} className="inline-flex items-center gap-1 text-[11px] text-ink-faint hover:text-ink">{copied ? <Check size={11} className="text-teal" /> : <Copy size={11} />} {copied ? 'Copié' : 'Copier'}</button>
        <a href={linkedinShareUrl(m.content)} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-[11px] hover:text-ink ${m.kind === 'linkedin' ? 'text-brass font-medium' : 'text-ink-faint'}`}><Share2 size={11} /> {m.kind === 'linkedin' ? 'Publier sur LinkedIn (texte pré-rempli)' : 'Publier sur LinkedIn'}</a>
      </div>
    </div>
  );
}
