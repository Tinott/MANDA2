import { UploadCloud } from 'lucide-react';

// Voile plein écran affiché pendant un glisser-déposer de fichiers.
export default function DropOverlay({ visible, titre = 'Déposez vos fichiers', detail = 'PDF, images, Word, Excel, texte' }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] flex items-center justify-center pointer-events-none animate-rise">
      <div className="rounded-2xl border-2 border-dashed border-brass bg-paper px-10 py-8 text-center shadow-xl">
        <UploadCloud size={34} className="mx-auto text-brass mb-3" />
        <div className="font-display text-[19px] text-ink">{titre}</div>
        <div className="text-[12.5px] text-ink-faint mt-1">{detail}</div>
      </div>
    </div>
  );
}
