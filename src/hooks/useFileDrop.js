// Glisser-déposer de fichiers sur une page entière — renvoie l'état
// « survol » pour afficher un voile, et appelle onFiles(files) au dépôt.
// Les dépôts dans les champs de saisie et les zones déjà équipées d'un
// <input type="file"> ne sont pas interceptés.

import { useCallback, useEffect, useRef, useState } from 'react';

export function useFileDrop(onFiles, { enabled = true } = {}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  useEffect(() => { cb.current = onFiles; }, [onFiles]);

  useEffect(() => {
    if (!enabled) return undefined;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current += 1; setDragging(true); };
    const onOver = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const onLeave = (e) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (e.target?.closest?.('input[type="file"]')) return;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) cb.current?.(files);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled]);

  const reset = useCallback(() => { depth.current = 0; setDragging(false); }, []);
  return { dragging, reset };
}
