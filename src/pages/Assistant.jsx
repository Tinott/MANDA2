import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Send, Loader2, Sparkles, AlertCircle, RefreshCw, ArrowRight, CalendarCheck,
  UserSearch, Scale, Globe2, Megaphone, Mails, Paperclip, Copy, Check, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  hasApiKey, askAssistant, dailyBriefing, buildAppSnapshot,
  ficheProspect, avisDeValeur, veilleMarche, analyseDocument, genererTeaser, sequenceProspection,
} from '../lib/ai';
import { buildAlerts } from '../lib/relances';
import { PageHeader, Card, Button, EmptyState, Field, Input, Textarea } from '../components/ui';

const SUGGESTIONS = [
  'Quelles sont mes échéances à risque ce mois-ci ?',
  'Fais-moi le point sur chaque promesse en cours.',
  "Quel CA ai-je facturé cette année et qu'est-ce qui reste à encaisser ?",
  'Rédige un NDA pour la cession d’un actif, acquéreur à compléter.',
  'Prépare une lettre de process et un index de data room pour un appel d’offres.',
  'Rédige un post LinkedIn sobre annonçant la signature d’un mandat exclusif.',
];

// --- Actions métier (plan CARDO) : chacune ouvre un mini-formulaire et
// --- pousse sa production dans le fil de conversation.
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
    champs: [
      { id: 'bien', label: 'Décrivez le bien (type, surface, loyer, bail, localisation…)', ph: 'Bâtiment d’activité 3 475 m² à Champagnier (38), loué TESLA, 288 000 € HT/an, bail 3/6/9 du 01/01/2024…', textarea: true, requis: true },
    ],
    run: (societe, v) => avisDeValeur(societe, { bien: { description: v.bien } }),
    etiquette: (v) => `Avis de valeur — ${v.bien.slice(0, 60)}…`,
  },
  {
    id: 'teaser', icon: Megaphone, titre: 'Teaser anonymisé',
    desc: 'Une page pré-NDA : jamais le vendeur ni l’adresse exacte.',
    champs: [
      { id: 'bien', label: 'Le bien et ses indicateurs clés', ph: 'Type, agglomération, surface, locataire (secteur), loyer, durée ferme, prix ou « sur demande »…', textarea: true, requis: true },
    ],
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
];

const ROUTES_VALIDES = new Set(['/promesses', '/mandats', '/facturation', '/suivi', '/mail', '/documents', '/im', '/frais', '/comptabilite']);
const BRIEF_KEY = () => `manda2.briefing.${new Date().toISOString().slice(0, 10)}`;

export default function Assistant() {
  const app = useApp();
  const { societe } = app;
  const [history, setHistory] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  const [action, setAction] = useState(null); // action ouverte
  const [vals, setVals] = useState({});
  const [brief, setBrief] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BRIEF_KEY()) || 'null'); } catch { return null; }
  });
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState('');
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const snapshot = useMemo(() => buildAppSnapshot(app), [app]);
  const alerts = useMemo(() => buildAlerts(app), [app]);
  const aDesDonnees = (app.mandats?.length || 0) + (app.promesses?.length || 0) + (app.factures?.length || 0) + (app.prospects?.length || 0) > 0;

  function scroll() { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); }

  async function loadBrief() {
    if (!hasApiKey(societe) || !aDesDonnees) return;
    setBriefBusy(true);
    setBriefError('');
    try {
      const b = await dailyBriefing(societe, { snapshot, alerts });
      b.actions = (b.actions || []).map((a) => ({ ...a, route: ROUTES_VALIDES.has(a.route) ? a.route : null }));
      setBrief(b);
      localStorage.setItem(BRIEF_KEY(), JSON.stringify(b));
    } catch (e) {
      setBriefError(e.message);
    }
    setBriefBusy(false);
  }
  useEffect(() => {
    if (brief) return;
    const t = setTimeout(loadBrief, 0); // hors du rendu : pas de setState synchrone dans l'effet
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pousse une production (action métier ou analyse de document) dans le fil.
  async function produire(etiquette, promesse, label) {
    setBusy(true);
    setBusyLabel(label || '');
    setError('');
    const next = [...history, { role: 'user', content: etiquette }];
    setHistory(next);
    scroll();
    try {
      const out = await promesse;
      setHistory([...next, { role: 'assistant', content: out }]);
      scroll();
    } catch (e) {
      setError(e.message);
      setHistory(history);
    }
    setBusy(false);
    setBusyLabel('');
  }

  function lancerAction() {
    const manquant = action.champs.find((c) => c.requis && !String(vals[c.id] || '').trim());
    if (manquant) { setError(`Champ requis : ${manquant.label}`); return; }
    const a = action;
    const v = { ...vals };
    setAction(null); setVals({});
    produire(
      `⚡ ${a.etiquette(v)}`,
      a.run(societe, v, { snapshot }),
      a.web ? 'Recherche web et rédaction en cours (30 à 90 s)…' : 'Rédaction en cours…'
    );
  }

  async function analyserFichier(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBusy(true); setBusyLabel(`Lecture de ${file.name}…`); setError('');
      const { extractPdfText } = await import('../lib/pdfExtract');
      const texte = await extractPdfText(file);
      setBusy(false);
      await produire(`📄 Analyse du document — ${file.name}`, analyseDocument(societe, { nom: file.name, texte }), 'Analyse du document en cours…');
    } catch (err) {
      setBusy(false); setBusyLabel('');
      setError(`Impossible de lire ce fichier (PDF texte attendu) : ${err.message}`);
    }
  }

  async function send(text) {
    const question = (text || input).trim();
    if (!question || busy) return;
    setInput('');
    const next = [...history, { role: 'user', content: question }];
    await produire(question, askAssistant(societe, { history: next, snapshot, alerts }), 'Analyse des données en cours…');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence artificielle"
        title="Copilote"
        description="Votre secrétaire de direction : briefing du jour automatique, fiches prospect et avis de valeur avec recherche web, analyse de vos documents, teasers, séquences de prospection — et toutes vos questions métier."
      />

      {!hasApiKey(societe) ? (
        <EmptyState icon={Bot} title="L'IA n'est pas activée" description="L'administrateur peut activer l'IA de l'application (Paramètres > Intégrations > Administrateur), ou choisissez « Ma propre clé API » dans Paramètres > Intégrations." />
      ) : (
        <div className="space-y-5">
          {/* --- Briefing du jour --- */}
          {aDesDonnees && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={16} className="text-brass" />
                  <h3 className="font-display text-[16px] text-ink">Le point du jour</h3>
                </div>
                <Button variant="ghost" onClick={loadBrief} disabled={briefBusy} className="!px-2.5">
                  <RefreshCw size={13} className={briefBusy ? 'animate-spin' : ''} /> Actualiser
                </Button>
              </div>
              {briefBusy && !brief && (
                <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Loader2 size={14} className="animate-spin" /> Votre secrétaire prépare le briefing…</div>
              )}
              {briefError && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {briefError}</div>}
              {brief && (
                <div>
                  <p className="text-[13.5px] text-ink leading-relaxed">{brief.resume}</p>
                  {(brief.actions || []).length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {brief.actions.map((a, i) => (
                        <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-paper-raised px-3.5 py-2.5">
                          <div>
                            <div className="text-[13px] font-medium text-ink">{a.titre}</div>
                            <div className="text-[12px] text-ink-soft">{a.detail}</div>
                          </div>
                          {a.route && (
                            <Link to={a.route} className="shrink-0 text-[12px] text-brass hover:text-brass-deep flex items-center gap-1 mt-0.5">
                              Ouvrir <ArrowRight size={12} />
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* --- Actions métier --- */}
          <Card>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-2.5">Productions à la demande</div>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                const actif = action?.id === a.id;
                return (
                  <button key={a.id} type="button" title={a.desc} disabled={busy}
                    onClick={() => { setError(''); setVals({}); setAction(actif ? null : a); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${actif ? 'border-brass bg-brass-soft/50 text-ink' : 'border-line text-ink-soft hover:border-brass/50 hover:text-ink'}`}>
                    <Icon size={13} className="text-brass" /> {a.titre}
                  </button>
                );
              })}
              <button type="button" title="Déposez un bail, un état locatif, un diagnostic, une promesse… (PDF)" disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-ink-soft hover:border-brass/50 hover:text-ink transition-colors">
                <Paperclip size={13} className="text-brass" /> Analyser un document
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={analyserFichier} />
            </div>

            {action && (
              <div className="mt-4 rounded-xl border border-brass/30 bg-brass-soft/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[13px] font-medium text-ink">{action.titre}</div>
                    <div className="text-[11.5px] text-ink-faint">{action.desc}</div>
                  </div>
                  <button type="button" onClick={() => setAction(null)} className="text-ink-faint hover:text-ink"><X size={15} /></button>
                </div>
                <div className="space-y-3">
                  {action.champs.map((c) => (
                    <Field key={c.id} label={c.label}>
                      {c.textarea
                        ? <Textarea rows={3} value={vals[c.id] || ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder={c.ph} />
                        : <Input value={vals[c.id] || ''} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder={c.ph}
                            onKeyDown={(e) => e.key === 'Enter' && lancerAction()} />}
                    </Field>
                  ))}
                  <Button variant="brass" onClick={lancerAction} disabled={busy}><Sparkles size={14} /> Lancer</Button>
                </div>
              </div>
            )}
          </Card>

          {/* --- Conversation --- */}
          <Card padded={false} className="flex flex-col h-[56vh]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {history.length === 0 && (
                <div>
                  <div className="text-[13px] text-ink-faint mb-3">Exemples de questions :</div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-left text-[12.5px] px-3 py-2 rounded-lg border border-line bg-paper-raised hover:border-brass/50 hover:bg-brass-soft/30 transition-colors">
                        <Sparkles size={11} className="inline mr-1.5 text-brass" />{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {history.map((m, i) => (
                <MessageBulle key={i} role={m.role} content={m.content} />
              ))}
              {busy && <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Loader2 size={14} className="animate-spin" /> {busyLabel || 'Analyse en cours…'}</div>}
              {error && <div className="flex items-center gap-2 text-[13px] text-rust"><AlertCircle size={14} /> {error}</div>}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-line p-4 flex gap-2">
              <button type="button" title="Analyser un document (PDF)" onClick={() => fileRef.current?.click()} disabled={busy}
                className="shrink-0 h-[42px] w-[42px] rounded-lg border border-line text-ink-faint hover:text-ink hover:border-brass/50 flex items-center justify-center transition-colors">
                <Paperclip size={16} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Posez une question, demandez un NDA, un compte rendu, un tableau comparatif d'offres…"
                className="flex-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-[13.5px] focus:outline-none focus:border-brass"
              />
              <Button variant="brass" onClick={() => send()} disabled={busy || !input.trim()}><Send size={15} /></Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MessageBulle({ role, content }) {
  const [copied, setCopied] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* presse-papiers indisponible */ }
  }
  if (role === 'user') {
    return (
      <div className="max-w-[85%] ml-auto">
        <div className="rounded-xl px-4 py-3 text-[13.5px] whitespace-pre-wrap bg-ink text-white">{content}</div>
      </div>
    );
  }
  return (
    <div className="max-w-[85%] group">
      <div className="rounded-xl px-4 py-3 text-[13.5px] whitespace-pre-wrap bg-paper-raised border border-line text-ink">{content}</div>
      <button type="button" onClick={copier}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-faint hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-teal" /> : <Copy size={11} />} {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}
