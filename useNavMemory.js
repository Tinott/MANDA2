// Mémoire de navigation — l'application vous remet exactement là où vous
// en étiez : position de défilement de chaque page, recherche et filtres en
// cours, dernière page ouverte, conversation du Copilote.
//
//   · usePersistedState(clé, valeurInitiale) — un useState qui survit aux
//     changements de page et aux rechargements de l'onglet (sessionStorage,
//     donc propre à cet onglet et oublié à sa fermeture).
//   · <NavMemory /> — à poser une fois dans le routeur : mémorise le scroll
//     de chaque route et le restaure au retour ; rouvre la dernière page
//     visitée quand l'application est relancée sur l'accueil.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PREFIX = 'mandat.ui:';
const LAST_PATH_KEY = 'mandat:lastPath';

function read(key, fallback) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

export function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => read(key, initial));
  useEffect(() => { write(key, value); }, [key, value]);
  return [value, setValue];
}

export function NavMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  const previous = useRef(null);
  const booted = useRef(false);

  // Au démarrage sur l'accueil : rouvre la dernière page visitée.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    try {
      const last = localStorage.getItem(LAST_PATH_KEY);
      if (last && last !== '/' && location.pathname === '/') navigate(last, { replace: true });
    } catch { /* stockage indisponible */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // À chaque changement de page : mémorise le scroll de la page quittée,
  // restaure celui de la page ouverte (après son rendu).
  useEffect(() => {
    if (previous.current && previous.current !== location.pathname) {
      write(`scroll:${previous.current}`, window.scrollY);
    }
    previous.current = location.pathname;
    try { localStorage.setItem(LAST_PATH_KEY, location.pathname); } catch { /* ignore */ }

    const y = read(`scroll:${location.pathname}`, 0);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [location.pathname]);

  // Mémorise aussi en continu (si l'onglet est rechargé sans changement de page).
  useEffect(() => {
    let t = 0;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => write(`scroll:${location.pathname}`, window.scrollY), 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, [location.pathname]);

  return null;
}
