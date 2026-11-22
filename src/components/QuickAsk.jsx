import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Send, X } from 'lucide-react';

const EXEMPLES = [
  'Rappelle-moi de relancer … lundi',
  'Note que j\'ai eu … au téléphone : …',
  'Passe la facture … en payée',
];

// Bouton Copilote présent sur toutes les pages : on dicte ou on tape une
// demande sans quitter ce qu'on fait ; elle part directement au Copilote.
// Raccourci : Ctrl/Cmd + K.
export default function QuickAsk() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  if (pathname === '/assistant') return null;

  function envoyer(e) {
    e?.preventDefault();
    const q = text.trim();
    if (!q) return;
    setText(''); setOpen(false);
    navigate('/assistant', { state: { prefill: { question: q, auto: true } } });
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden">
      {open && (
        <form onSubmit={envoyer} className="mb-3 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface shadow-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[13px] font-medium text-ink"><Bot size={15} className="text-brass" /> Demander au Copilote</div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-ink-faint hover:text-ink" aria-label="Fermer"><X size={14} /></button>
          </div>
          <textarea
            ref={ref} rows={3} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) envoyer(e); }}
            placeholder="Dites ce qu'il faut faire, il s'en occupe…"
            className="w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brass resize-none"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {EXEMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => { setText(ex); ref.current?.focus(); }} className="text-[10.5px] px-2 py-0.5 rounded-full border border-line text-ink-faint hover:text-ink hover:border-brass/50">{ex}</button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10.5px] text-ink-faint">Entrée pour envoyer · Ctrl/⌘ K</span>
            <button type="submit" disabled={!text.trim()} className="flex items-center gap-1.5 rounded-lg bg-ink text-white text-[12.5px] px-3 py-1.5 disabled:opacity-40"><Send size={12} /> Envoyer</button>
          </div>
        </form>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full bg-ink text-white shadow-lg pl-3.5 pr-4 py-2.5 text-[13px] hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass" aria-expanded={open} title="Demander au Copilote (Ctrl/⌘ K)">
          <Bot size={16} className="text-brass" /> Copilote
        </button>
      </div>
    </div>
  );
}
