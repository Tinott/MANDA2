import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Check, Trash2, CalendarPlus, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/calc';
import { downloadIcs } from '../lib/ics';
import { Card, Input, Button } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

function echeance(t) {
  const d = Math.round((new Date(t.date) - new Date(today())) / 86400000);
  if (Number.isNaN(d)) return { label: '', cls: 'text-ink-faint' };
  if (d < 0) return { label: `En retard (${-d} j)`, cls: 'text-rust font-medium' };
  if (d === 0) return { label: "Aujourd'hui", cls: 'text-brass-deep font-medium' };
  if (d === 1) return { label: 'Demain', cls: 'text-ink-soft' };
  return { label: formatDate(t.date), cls: 'text-ink-faint' };
}

// Rappels & agenda : ce que l'utilisateur (ou le Copilote) a noté « à faire »,
// avec une date. Saisie en une ligne, export vers le calendrier.
export default function RappelsCard() {
  const { taches, addTache, updateTache, removeTache } = useApp();
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState(today());
  const [heure, setHeure] = useState('');
  const [tout, setTout] = useState(false);

  const ouverts = useMemo(
    () => (taches || []).filter((t) => !t.fait).sort((a, b) => `${a.date || ''} ${a.heure || ''}`.localeCompare(`${b.date || ''} ${b.heure || ''}`)),
    [taches]
  );
  const faits = useMemo(() => (taches || []).filter((t) => t.fait).sort((a, b) => (b.faitLe || '').localeCompare(a.faitLe || '')).slice(0, 5), [taches]);
  const visibles = tout ? ouverts : ouverts.slice(0, 6);

  function ajouter(e) {
    e.preventDefault();
    if (!titre.trim()) return;
    addTache({ titre: titre.trim(), date: date || today(), ...(heure ? { heure } : {}) });
    setTitre(''); setHeure('');
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={16} className="text-brass" />
        <div className="font-display text-[15px] text-ink">Rappels & agenda</div>
        {ouverts.length > 0 && (
          <button type="button" onClick={() => downloadIcs(ouverts)} className="ml-auto flex items-center gap-1.5 text-[11.5px] text-ink-soft hover:text-brass" title="Ajouter tous les rappels à votre calendrier (Outlook, Google, Apple)">
            <CalendarPlus size={13} /> Vers mon calendrier
          </button>
        )}
      </div>

      <form onSubmit={ajouter} className="space-y-2 mb-3">
        <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Rappeler M. Dupont, envoyer l'IM…" aria-label="Nouveau rappel" />
        <div className="flex gap-2">
          <div className="flex-1 min-w-0"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" /></div>
          <div className="w-[118px] shrink-0"><Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} aria-label="Heure (optionnel)" /></div>
          <Button type="submit" variant="brass" disabled={!titre.trim()} className="shrink-0"><Plus size={14} /> Ajouter</Button>
        </div>
      </form>

      {ouverts.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint py-1">Aucun rappel en attente. Ajoutez-en un ci-dessus, ou dites au Copilote « rappelle-moi de… ».</p>
      ) : (
        <ul className="space-y-1.5">
          {visibles.map((t) => {
            const e = echeance(t);
            return (
              <li key={t.id} className="group flex items-start gap-2.5 rounded-lg border border-line px-3 py-2">
                <button type="button" onClick={() => updateTache(t.id, { fait: true, faitLe: today() })} className="mt-0.5 w-[18px] h-[18px] shrink-0 rounded border border-ink-faint/50 hover:border-teal hover:bg-teal/10 flex items-center justify-center text-transparent hover:text-teal" title="Marquer comme fait" aria-label={`Marquer « ${t.titre} » comme fait`}>
                  <Check size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-ink break-words">{t.titre}</div>
                  <div className="text-[11.5px] mt-0.5">
                    <span className={e.cls}>{e.label}{t.heure ? ` · ${t.heure}` : ''}</span>
                    {t.contactNom && <span className="text-ink-faint"> · {t.contactNom}</span>}
                    {t.note && <span className="text-ink-faint"> · {t.note}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => downloadIcs([t], 'rappel.ics')} className="p-1 text-ink-faint hover:text-brass opacity-60 group-hover:opacity-100" title="Ajouter à mon calendrier"><CalendarPlus size={13} /></button>
                <button type="button" onClick={() => removeTache(t.id)} className="p-1 text-ink-faint hover:text-rust opacity-60 group-hover:opacity-100" title="Supprimer"><Trash2 size={13} /></button>
              </li>
            );
          })}
        </ul>
      )}
      {ouverts.length > 6 && (
        <button type="button" onClick={() => setTout((v) => !v)} className="mt-2 flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink">
          <ChevronDown size={13} className={tout ? 'rotate-180' : ''} /> {tout ? 'Réduire' : `Voir les ${ouverts.length - 6} autres`}
        </button>
      )}
      {faits.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-line">
          <div className="text-[10.5px] uppercase tracking-wide text-ink-faint mb-1">Faits récemment</div>
          <ul className="space-y-0.5">
            {faits.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[12px] text-ink-faint">
                <Check size={12} className="text-teal shrink-0" />
                <span className="line-through truncate flex-1">{t.titre}</span>
                <button type="button" onClick={() => updateTache(t.id, { fait: false, faitLe: '' })} className="hover:text-ink shrink-0">Rouvrir</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
