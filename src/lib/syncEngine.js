// Moteur de synchronisation — indépendant de React et du réseau (les accès
// sont injectés), donc testable par simulation.
//
// Principes :
//   1. Rien n'est jamais « remplacé » : l'état local et l'état du serveur
//      sont fusionnés enregistrement par enregistrement (syncMerge.js).
//   2. Avant chaque envoi, le serveur est relu ; l'envoi est conditionnel
//      (« seulement si personne n'a écrit entre-temps »), sinon on refusionne.
//   3. Tant que le serveur n'a pas répondu, rien n'est envoyé. Les saisies
//      faites hors connexion restent sur l'appareil (marquées « à envoyer »)
//      et partent à la reconnexion.
//   4. Un serveur vide ne vide jamais un appareil rempli : c'est l'appareil
//      qui re-remplit le serveur.

import { mergeSnapshots, sameSnapshot, countItems, normalizeSnapshot } from './syncMerge.js';

export function createSyncEngine({
  pull,          // async () => { ok, data, version } | { ok:false, error }
  peek,          // (optionnel) async () => { ok, version } — lecture légère de la seule version
  push,          // async (data, version, forcer) => { ok, version } | { ok:false, conflict?:true, error }
  getLocal,      // () => instantané local courant
  applyMerged,   // (instantané) => void — remplace l'état local par la fusion
  onStatus = () => {},   // (statut) : 'syncing' | 'synced' | 'error'
  isDirty,       // () => bool : des saisies locales n'ont pas encore été envoyées
  setDirty,      // (bool) => void
  isFirstRun = () => false, // () => bool : premier lancement de ce moteur sur cet appareil
  markRun = () => {},
  backup = async () => {},  // (instantané, raison) : copie de sécurité locale avant remplacement
  debounceMs = 1500,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
}) {
  let hydrated = false;
  let running = null;      // promesse du cycle en cours
  let again = false;       // un nouveau cycle a été demandé pendant le cycle en cours
  let timer = null;
  let changes = 0;         // compteur de saisies locales
  let stopped = false;
  let lastRemote = null;   // dernier état connu du serveur (évite de le relire avant chaque envoi)
  let lastVersion;         // sa version
  let needFull = true;     // une vraie relecture du serveur est nécessaire

  async function cycle() {
    const depart = changes;
    let versionEnConflit; // version du serveur lors du dernier envoi refusé
    onStatus('syncing');
    for (let essai = 0; essai < 5; essai++) {
      // Après le premier chargement, on repart du dernier état connu du
      // serveur : l'envoi conditionnel détecte toute écriture intermédiaire
      // (→ relecture complète), sans retélécharger les données à chaque saisie.
      let r;
      let relu = false;
      if (hydrated && !needFull && lastRemote) r = { ok: true, data: lastRemote, version: lastVersion };
      else {
        relu = true;
        r = await pull();
        if (stopped) return false;
        if (!r.ok) { onStatus('error'); return false; }
        lastRemote = normalizeSnapshot(r.data); lastVersion = r.version; needFull = false;
      }

      const local = getLocal();
      const distant = normalizeSnapshot(r.data);
      const nLocal = countItems(local), nDistant = countItems(distant);
      let fusion;

      if (!hydrated && nLocal > 0 && nDistant === 0) {
        // Serveur vide, appareil rempli : l'appareil re-remplit le serveur.
        fusion = mergeSnapshots(local, distant);
      } else if (!hydrated && isFirstRun() && !isDirty() && nLocal <= nDistant * 3) {
        // Premier lancement du nouveau moteur : la copie locale n'est qu'un
        // cache de l'ancien système — le serveur fait foi, à l'identique.
        // (Sauf si l'appareil contient bien plus que le serveur : on fusionne.)
        fusion = distant;
      } else {
        fusion = mergeSnapshots(local, distant);
      }

      if (!sameSnapshot(fusion, local)) {
        if (nLocal > 0 && countItems(fusion) < nLocal) await backup(local, 'avant-synchronisation');
        if (stopped) return false;
        applyMerged(fusion);
      }
      if (!hydrated) { hydrated = true; markRun(); }

      if (sameSnapshot(fusion, distant)) {
        if (changes === depart) setDirty(false);
        onStatus('synced');
        return true;
      }
      // Si l'envoi conditionnel vient d'être refusé alors que le serveur n'a
      // PAS changé depuis, le refus est technique (et non une écriture
      // concurrente) : on envoie sans condition — la fusion vient d'être
      // refaite sur l'état exact du serveur, c'est sans risque.
      const forcer = versionEnConflit !== undefined && versionEnConflit === r.version && relu;
      const w = await push(fusion, r.version, forcer);
      if (stopped) return false;
      if (w.ok) {
        lastRemote = fusion; lastVersion = w.version;
        if (changes === depart) setDirty(false);
        onStatus('synced');
        return true;
      }
      if (!w.conflict) { onStatus('error'); return false; }
      // Quelqu'un a écrit entre la lecture et l'écriture : on relit et on refusionne.
      versionEnConflit = forcer ? undefined : r.version;
      needFull = true;
    }
    onStatus('error');
    return false;
  }

  // `leger` : simple vérification (minuterie, retour sur l'onglet). Si rien
  // n'est à envoyer et que la version du serveur n'a pas bougé, on ne fait rien.
  function sync({ leger = false } = {}) {
    if (stopped) return Promise.resolve(false);
    if (running) { if (!leger) again = true; return running; }
    running = (async () => {
      try {
        if (leger && hydrated && peek) {
          const p = await peek();
          if (stopped) return false;
          if (!p.ok) { if (isDirty()) onStatus('error'); return false; }
          // Rien à envoyer, rien de nouveau sur le serveur, et l'appareil est
          // bien identique au dernier état connu : rien à faire.
          if (p.version === lastVersion && !isDirty() && lastRemote && sameSnapshot(getLocal(), lastRemote)) return true;
          if (p.version !== lastVersion) needFull = true;
        }
        let ok = await cycle();
        while (again && !stopped) { again = false; ok = await cycle(); }
        return ok;
      } catch {
        onStatus('error');
        return false;
      } finally {
        running = null;
        again = false;
      }
    })();
    return running;
  }

  return {
    // À appeler à chaque saisie locale.
    notifyLocalChange() {
      changes += 1;
      setDirty(true);
      clearTimer(timer);
      timer = setTimer(() => { sync(); }, debounceMs);
    },
    // Synchronisation immédiate (chargement, retour sur l'onglet, minuterie).
    sync,
    isHydrated: () => hydrated,
    stop() { stopped = true; clearTimer(timer); },
  };
}
