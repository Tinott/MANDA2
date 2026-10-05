import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Loader2, Sparkles, AlertCircle, RefreshCw, ArrowRight, CalendarCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasApiKey, askAssistant, dailyBriefing, buildAppSnapshot } from '../lib/ai';
import { buildAlerts } from '../lib/relances';
import { PageHeader, Card, Button, EmptyState } from '../components/ui';

const SUGGESTIONS = [
  'Quelles sont mes échéances à risque ce mois-ci ?',
  'Fais-moi le point sur chaque promesse en cours.',
  "Quel CA ai-je facturé cette année et qu'est-ce qui reste à encaisser ?",
  'Quels prospects dois-je relancer cette semaine ?',
  'Rédige un point hebdo à envoyer à mon mandant pour le dossier le plus avancé.',
];

const ROUTES_VALIDES = new Set(['/promesses', '/mandats', '/facturation', '/suivi', '/mail', '/documents', '/im', '/frais', '/comptabilite']);
const BRIEF_KEY = () => `manda2.briefing.${new Date().toISOString().slice(0, 10)}`;

export default function Assistant() {
  const app = useApp();
  const { societe } = app;
  const [history, setHistory] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [brief, setBrief] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BRIEF_KEY()) || 'null'); } catch { return null; }
  });
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState('');
  const bottomRef = useRef(null);

  const snapshot = useMemo(() => buildAppSnapshot(app), [app]);
  const alerts = useMemo(() => buildAlerts(app), [app]);
  const aDesDonnees = (app.mandats?.length || 0) + (app.promesses?.length || 0) + (app.factures?.length || 0) + (app.prospects?.length || 0) > 0;

  // --- Briefing automatique : la secrétaire fait le point à l'ouverture,
  // --- une fois par jour (cache local), sans rien demander.
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

  async function send(text) {
    const question = (text || input).trim();
    if (!question || busy) return;
    setInput('');
    setError('');
    const next = [...history, { role: 'user', content: question }];
    setHistory(next);
    setBusy(true);
    try {
      const answer = await askAssistant(societe, { history: next, snapshot, alerts });
      setHistory([...next, { role: 'assistant', content: answer }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setError(e.message);
      setHistory(history);
    }
    setBusy(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence artificielle"
        title="Copilote"
        description="Votre secrétaire de direction : elle connaît l'intégralité de vos données, fait le point du jour sans qu'on lui demande, et répond à toutes vos questions métier."
      />

      {!hasApiKey(societe) ? (
        <EmptyState icon={Bot} title="L'IA n'est pas activée" description="L'administrateur peut activer l'IA partagée (voir Paramètres > Intégrations > Administrateur), ou vous pouvez saisir votre propre clé API dans Paramètres > Intégrations." />
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

          {/* --- Conversation --- */}
          <Card padded={false} className="flex flex-col h-[58vh]">
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
                <div key={i} className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
                  <div className={`rounded-xl px-4 py-3 text-[13.5px] whitespace-pre-wrap ${m.role === 'user' ? 'bg-ink text-white' : 'bg-paper-raised border border-line text-ink'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Loader2 size={14} className="animate-spin" /> Analyse des données en cours…</div>}
              {error && <div className="flex items-center gap-2 text-[13px] text-rust"><AlertCircle size={14} /> {error}</div>}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-line p-4 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Posez une question sur vos dossiers, votre pipeline, votre compta…"
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
