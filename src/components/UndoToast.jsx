import { RotateCcw, X, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Reste affiché indéfiniment — jusqu'à fermeture manuelle ou jusqu'à ce
// qu'une nouvelle suppression le remplace. La Corbeille garde de toute
// façon tout, sans limite de temps ; ce bandeau n'est qu'un raccourci pour
// annuler la toute dernière action sans quitter la page.
export default function UndoToast() {
  const { toast, dismissToast, restoreMany } = useApp();

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60]">
      <div className="flex items-center gap-3 bg-ink text-white rounded-full pl-4 pr-2 py-2 shadow-2xl border border-white/10 animate-rise">
        <Trash2 size={14} className="text-white/50 shrink-0" />
        <span className="text-[12.5px] truncate max-w-[280px]">{toast.label} supprimé{toast.trashIds.length > 1 ? 's' : ''}</span>
        <button
          onClick={() => restoreMany(toast.trashIds)}
          className="flex items-center gap-1 text-[12.5px] font-medium text-brass hover:text-brass-soft px-2.5 py-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
        >
          <RotateCcw size={12} /> Annuler
        </button>
        <button
          onClick={dismissToast}
          className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
          title="Fermer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
