
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { loadState, saveState, uid } from '../lib/storage';
import { buildRegistre } from '../lib/calc';
import { ROLES } from '../lib/seed';
import { trashEntryLabel } from '../lib/trashLabels';
import { pullOrgData, pushOrgData, peekOrgVersion } from '../lib/orgSync';
import { createSyncEngine } from '../lib/syncEngine';
import { mergeSnapshots, normalizeSnapshot, countItems, LISTES } from '../lib/syncMerge';
import { saveLocalBackup } from '../lib/localBackups';

const AppCtx = createContext(null);

const DEFAULT_SOCIETE = {
  onboarded: false,
  nom: '', siret: '', adresse: '', carteT: '', rcp: '', cpi: '', rcs: '', tvaIntra: '',
  banque: '', iban: '', bic: '', capitalSocial: 10000, immobilisationsNettes: 0, dettesDiverses: 0,
  regimeTva: 'reel_normal', tauxTvaDefaut: 20, couleurAccent: '#a06a2c',
  contactNom: '', telephone: '', email: '', photoContact: '', soldeTresorerieInitial: 0,
  remunerationGerantAnnuelle: 24000, chargesSocialesAnnuelle: 18000, dotationAmortissementAnnuelle: 1500,
  impotsTaxesAnnuel: 500, produitsFinanciersAnnuel: 0, chargesFinancieresAnnuel: 0,
  bareme: {
    type: 'degressif',
    tranches: [
      { jusqu_a: 200000, taux: 5 },
      { jusqu_a: 500000, taux: 4 },
      { jusqu_a: null, taux: 3 },
    ],
  },
};

const DEFAULT_CONTACT_CATEGORIES = ['Propriétaire', 'Investisseur', 'Notaire', 'Banque'];

const now = () => new Date().toISOString();

export function AppProvider({ children, orgId }) {
  const [societe, setSocieteState] = useState(() => loadState('societe', DEFAULT_SOCIETE));
  const [mandats, setMandats] = useState(() => loadState('mandats', []));
  const [factures, setFactures] = useState(() => loadState('factures', []));
  const [notesFrais, setNotesFrais] = useState(() => loadState('notesFrais', []));
  const [dossiers, setDossiers] = useState(() => loadState('dossiers', []));
  const [users, setUsers] = useState(() => loadState('users', []));
  const [kmCumules, setKmCumules] = useState(() => loadState('kmCumules', 0));
  const [lastBackupAt, setLastBackupAt] = useState(() => loadState('lastBackupAt', null));
  const [promesses, setPromesses] = useState(() => loadState('promesses', []));
  const [contacts, setContacts] = useState(() => loadState('contacts', []));
  const [contactCategories, setContactCategories] = useState(() => loadState('contactCategories', DEFAULT_CONTACT_CATEGORIES));
  const [prospects, setProspects] = useState(() => loadState('prospects', []));
  const [courriers, setCourriers] = useState(() => loadState('courriers', []));
  const [trash, setTrash] = useState(() => loadState('trash', []));
  const [documents, setDocuments] = useState(() => loadState('documents', []));
  // Rappels & tâches (agenda de travail tenu par l'utilisateur et le Copilote).
  const [taches, setTaches] = useState(() => loadState('taches', []));
  // Suppressions définitives (identifiant → date) et dates des réglages
  // uniques : nécessaires à la fusion entre appareils (voir lib/syncMerge.js).
  const [deleted, setDeleted] = useState(() => loadState('deleted', {}));
  const [meta, setMeta] = useState(() => loadState('meta', {}));
  const [toast, setToast] = useState(null); // { trashIds: string[], label } — éphémère, non persisté

  // Chaque organisation a une seule ligne de données sur le serveur
  // (org_data), partagée entre ses appareils et ses utilisateurs.
  // localStorage en garde une copie locale (affichage immédiat, travail hors
  // connexion). Les deux ne s'écrasent jamais : ils sont FUSIONNÉS
  // enregistrement par enregistrement — voir lib/syncEngine.js.
  const [cloudStatus, setCloudStatus] = useState('idle'); // idle | syncing | synced | error
  const [cloudReady, setCloudReady] = useState(false);    // le serveur a répondu au moins une fois

  useEffect(() => saveState('societe', societe), [societe]);
  useEffect(() => saveState('mandats', mandats), [mandats]);
  useEffect(() => saveState('factures', factures), [factures]);
  useEffect(() => saveState('notesFrais', notesFrais), [notesFrais]);
  useEffect(() => saveState('dossiers', dossiers), [dossiers]);
  useEffect(() => saveState('users', users), [users]);
  useEffect(() => saveState('kmCumules', kmCumules), [kmCumules]);
  useEffect(() => saveState('lastBackupAt', lastBackupAt), [lastBackupAt]);
  useEffect(() => saveState('promesses', promesses), [promesses]);
  useEffect(() => saveState('contacts', contacts), [contacts]);
  useEffect(() => saveState('contactCategories', contactCategories), [contactCategories]);
  useEffect(() => saveState('prospects', prospects), [prospects]);
  useEffect(() => saveState('courriers', courriers), [courriers]);
  useEffect(() => saveState('trash', trash), [trash]);
  useEffect(() => saveState('documents', documents), [documents]);
  useEffect(() => saveState('taches', taches), [taches]);
  useEffect(() => saveState('deleted', deleted), [deleted]);
  useEffect(() => saveState('meta', meta), [meta]);

  // Instantané courant, toujours à jour, lisible hors du cycle de rendu
  // (par le moteur de synchronisation).
  const stateRef = useRef(null);
  const currentSnapshot = () => ({
    societe, mandats, factures, notesFrais, dossiers, users, kmCumules, promesses, contacts,
    prospects, courriers, trash, contactCategories, documents, taches, deleted, meta,
  });
  useLayoutEffect(() => { stateRef.current = currentSnapshot(); });

  // Remplace tout l'état par un instantané (résultat d'une fusion).
  const applying = useRef(false);
  function applySnapshot(data) {
    const d = normalizeSnapshot(data);
    const complet = {
      ...d,
      societe: d.societe || DEFAULT_SOCIETE,
      kmCumules: d.kmCumules || 0,
      contactCategories: Array.isArray(d.contactCategories) ? d.contactCategories : DEFAULT_CONTACT_CATEGORIES,
    };
    applying.current = true;
    stateRef.current = complet;
    setSocieteState(complet.societe);
    setMandats(complet.mandats);
    setFactures(complet.factures);
    setNotesFrais(complet.notesFrais);
    setDossiers(complet.dossiers);
    setUsers(complet.users);
    setKmCumules(complet.kmCumules);
    setPromesses(complet.promesses);
    setContacts(complet.contacts);
    setContactCategories(complet.contactCategories);
    setProspects(complet.prospects);
    setCourriers(complet.courriers);
    setTrash(complet.trash);
    setDocuments(complet.documents);
    setTaches(complet.taches);
    setDeleted(complet.deleted);
    setMeta(complet.meta);
    // Filet : si, pour une raison quelconque, le rendu ne suivait pas, le
    // marqueur ne doit pas rester levé (il masquerait la saisie suivante).
    setTimeout(() => { applying.current = false; }, 400);
  }

  // ---------------------------------------------------------------------
  // Synchronisation avec le serveur.
  // ---------------------------------------------------------------------
  const engineRef = useRef(null);
  useEffect(() => {
    if (!orgId) return undefined;

    // La copie locale appartient-elle à une AUTRE organisation (autre compte
    // utilisé sur ce navigateur) ? Elle est alors mise de côté — jamais
    // mélangée ni envoyée dans l'organisation courante.
    const cacheOrg = loadState('sync.org', null);
    if (cacheOrg && cacheOrg !== orgId) {
      const ancien = stateRef.current;
      if (ancien && countItems(ancien) > 0) saveLocalBackup(cacheOrg, ancien, 'changement-organisation', countItems(ancien));
      applySnapshot({});
      saveState('sync.dirty', false);
    }
    saveState('sync.org', orgId);

    const engine = createSyncEngine({
      pull: () => pullOrgData(orgId),
      peek: () => peekOrgVersion(orgId),
      push: (data, version, forcer) => pushOrgData(orgId, { app: 'mandat', version: 1, ...data, exportedAt: now() }, version, forcer),
      getLocal: () => stateRef.current,
      applyMerged: applySnapshot,
      onStatus: setCloudStatus,
      isDirty: () => loadState('sync.dirty', false),
      setDirty: (d) => saveState('sync.dirty', d),
      isFirstRun: () => !loadState('sync.v2', false),
      markRun: () => saveState('sync.v2', true),
      backup: (snap, raison) => saveLocalBackup(orgId, snap, raison, countItems(snap)),
    });
    engineRef.current = engine;

    // Copie de sécurité locale quotidienne (IndexedDB), après une synchro réussie.
    const copieQuotidienne = () => {
      const snap = stateRef.current;
      if (!snap || countItems(snap) === 0) return;
      if (Date.now() - (loadState('sync.lastLocalBackup', 0) || 0) < 20 * 3600 * 1000) return;
      saveState('sync.lastLocalBackup', Date.now());
      saveLocalBackup(orgId, snap, 'quotidienne', countItems(snap));
    };

    let retry = null;
    const demarrer = async (essai = 0) => {
      const ok = await engine.sync();
      if (engine.isHydrated()) setCloudReady(true);
      if (ok) copieQuotidienne();
      else if (!engine.isHydrated() && essai < 10) retry = setTimeout(() => demarrer(essai + 1), Math.min(30000, 3000 * (essai + 1)));
    };
    demarrer();

    // Vérifications légères : toutes les 60 s et au retour sur l'onglet.
    let dernier = 0;
    const verifier = () => {
      if (document.visibilityState !== 'visible' || Date.now() - dernier < 15000) return;
      dernier = Date.now();
      engine.sync({ leger: true }).then((ok) => { if (ok) copieQuotidienne(); });
    };
    const minuterie = setInterval(verifier, 60000);
    window.addEventListener('focus', verifier);
    window.addEventListener('online', verifier);
    document.addEventListener('visibilitychange', verifier);

    return () => {
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
      clearTimeout(retry);
      clearInterval(minuterie);
      window.removeEventListener('focus', verifier);
      window.removeEventListener('online', verifier);
      document.removeEventListener('visibilitychange', verifier);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Toute saisie locale est marquée « à envoyer » et déclenche une
  // synchronisation (les changements venus du serveur, eux, ne le font pas).
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    if (applying.current) { applying.current = false; return; }
    if (!orgId) return;
    if (engineRef.current) engineRef.current.notifyLocalChange();
    else saveState('sync.dirty', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societe, mandats, factures, notesFrais, dossiers, users, kmCumules, promesses, contacts, prospects, courriers, trash, contactCategories, documents, taches, deleted, meta]);

  // Restauration d'un instantané (sauvegarde exportée, version de
  // l'historique, copie locale) : tout ce qu'il contient revient et
  // l'emporte ; ce qui a été créé depuis est conservé. Rien ne disparaît.
  function restoreSnapshot(data) {
    if (!data || typeof data !== 'object') return false;
    const t = now();
    const r = normalizeSnapshot(data);
    LISTES.forEach((k) => { r[k] = r[k].map((x) => (x && typeof x === 'object' ? { ...x, updatedAt: t } : x)); });
    r.meta = { ...r.meta, societeAt: t, kmAt: t, categoriesAt: t };
    const fusion = mergeSnapshots(r, stateRef.current || {});
    const avant = stateRef.current;
    if (avant && countItems(avant) > 0) saveLocalBackup(orgId, avant, 'avant-restauration', countItems(avant));
    applySnapshot(fusion);
    applying.current = false; // c'est une action de l'utilisateur : à envoyer
    if (orgId) { if (engineRef.current) engineRef.current.notifyLocalChange(); else saveState('sync.dirty', true); }
    return true;
  }

  const registre = useMemo(() => buildRegistre(factures, notesFrais), [factures, notesFrais]);

  // --- Fabriques : tout enregistrement porte sa date de dernière modification.
  const creer = (prefixe, defauts, rec) => { const t = now(); return { id: uid(prefixe), createdAt: t, updatedAt: t, ...defauts, ...rec }; };
  const modifier = (setter) => (id, patch) => setter((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)));
  const marquerSupprimes = (ids) => {
    const t = now();
    setDeleted((d) => ({ ...d, ...Object.fromEntries(ids.filter(Boolean).map((id) => [id, t])) }));
  };

  function softDelete(type, list, setList, id) {
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const trashId = uid('trash');
    setTrash((t) => [{ id: trashId, type, data: item, deletedAt: now() }, ...t]);
    setList((arr) => arr.filter((x) => x.id !== id));
    setToast({ trashIds: [trashId], label: trashEntryLabel(type, item) });
  }

  function softDeleteMany(type, list, setList, ids) {
    const idSet = new Set(ids);
    const items = list.filter((x) => idSet.has(x.id));
    if (!items.length) return;
    const t = now();
    const entries = items.map((item) => ({ id: uid('trash'), type, data: item, deletedAt: t }));
    setTrash((tr) => [...entries, ...tr]);
    setList((arr) => arr.filter((x) => !idSet.has(x.id)));
    setToast({ trashIds: entries.map((e) => e.id), label: `${items.length} élément${items.length > 1 ? 's' : ''}` });
  }

  const listByType = {
    mandat: mandats, facture: factures, frais: notesFrais, promesse: promesses,
    contact: contacts, prospect: prospects, courrier: courriers, dossier: dossiers,
    document: documents, tache: taches,
  };
  const setterByType = {
    mandat: setMandats, facture: setFactures, frais: setNotesFrais,
    promesse: setPromesses, contact: setContacts, prospect: setProspects,
    courrier: setCourriers, dossier: setDossiers, document: setDocuments, tache: setTaches,
  };

  const value = useMemo(
    () => ({
      societe,
      setSociete: (patch) => { setSocieteState((s) => ({ ...s, ...patch })); setMeta((m) => ({ ...m, societeAt: now() })); },
      completeOnboarding: (patch) => { setSocieteState((s) => ({ ...s, ...patch, onboarded: true })); setMeta((m) => ({ ...m, societeAt: now() })); },

      mandats,
      addMandat: (m) => { const rec = creer('mandat', { statut: 'En cours' }, m); setMandats((arr) => [rec, ...arr]); return rec; },
      updateMandat: modifier(setMandats),
      removeMandat: (id) => softDelete('mandat', mandats, setMandats, id),

      factures,
      addFacture: (f) => { const rec = creer('fact', {}, f); setFactures((arr) => [rec, ...arr]); return rec; },
      updateFacture: modifier(setFactures),
      removeFacture: (id) => softDelete('facture', factures, setFactures, id),

      notesFrais,
      addNoteFrais: (n) => { const rec = creer('frais', {}, n); setNotesFrais((arr) => [rec, ...arr]); return rec; },
      updateNoteFrais: modifier(setNotesFrais),
      removeNoteFrais: (id) => softDelete('frais', notesFrais, setNotesFrais, id),

      dossiers,
      addDossier: (d) => { const rec = creer('dossier', { fichiers: [], partages: [] }, d); setDossiers((arr) => [rec, ...arr]); return rec; },
      updateDossier: modifier(setDossiers),
      removeDossier: (id) => softDelete('dossier', dossiers, setDossiers, id),

      // Documents juridiques — mandats, avenants, offre d'achat, générés
      // depuis les modèles dynamiques (voir lib/documentEngine.js) — et
      // bibliothèque du Copilote (type « bibliotheque »).
      documents,
      addDocument: (d) => { const rec = creer('document', { statut: 'Brouillon' }, d); setDocuments((arr) => [rec, ...arr]); return rec; },
      updateDocument: modifier(setDocuments),
      removeDocument: (id) => softDelete('document', documents, setDocuments, id),

      promesses,
      addPromesse: (p) => { const rec = creer('promesse', { statut: 'En cours' }, p); setPromesses((arr) => [rec, ...arr]); return rec; },
      updatePromesse: modifier(setPromesses),
      removePromesse: (id) => softDelete('promesse', promesses, setPromesses, id),

      contacts,
      addContact: (c) => { const rec = creer('contact', {}, c); setContacts((arr) => [rec, ...arr]); return rec; },
      addContactsBulk: (list) => { const recs = list.map((c) => creer('contact', {}, c)); setContacts((arr) => [...recs, ...arr]); return recs; },
      updateContact: modifier(setContacts),
      removeContact: (id) => softDelete('contact', contacts, setContacts, id),

      // Catégories de contacts — onglets renommables librement par le
      // client (ex. "Contact" → "Contacts acheteurs"). Renommer une
      // catégorie met à jour tous les contacts qui la portent déjà.
      contactCategories,
      addContactCategory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setContactCategories((arr) => (arr.includes(trimmed) ? arr : [...arr, trimmed]));
        setMeta((m) => ({ ...m, categoriesAt: now() }));
      },
      renameContactCategory: (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === oldName) return;
        const t = now();
        setContactCategories((arr) => arr.map((c) => (c === oldName ? trimmed : c)));
        setContacts((arr) => arr.map((c) => (c.categorie === oldName ? { ...c, categorie: trimmed, updatedAt: t } : c)));
        setMeta((m) => ({ ...m, categoriesAt: t }));
      },
      removeContactCategory: (name) => {
        const t = now();
        setContactCategories((arr) => arr.filter((c) => c !== name));
        setContacts((arr) => arr.map((c) => (c.categorie === name ? { ...c, categorie: '', updatedAt: t } : c)));
        setMeta((m) => ({ ...m, categoriesAt: t }));
      },

      prospects,
      addProspect: (p) => { const rec = creer('prospect', { statut: 'À contacter' }, p); setProspects((arr) => [rec, ...arr]); return rec; },
      addProspectsBulk: (list) => { const recs = list.map((p) => creer('prospect', { statut: 'À contacter' }, p)); setProspects((arr) => [...recs, ...arr]); return recs; },
      updateProspect: modifier(setProspects),
      removeProspect: (id) => softDelete('prospect', prospects, setProspects, id),

      courriers,
      addCourrier: (c) => { const rec = creer('courrier', { statut: 'Envoyé' }, c); setCourriers((arr) => [rec, ...arr]); return rec; },
      addCourriersBulk: (list) => { const recs = list.map((c) => creer('courrier', { statut: 'Envoyé' }, c)); setCourriers((arr) => [...recs, ...arr]); return recs; },
      updateCourrier: modifier(setCourriers),
      removeCourrier: (id) => softDelete('courrier', courriers, setCourriers, id),

      // Rappels & tâches.
      taches,
      addTache: (t) => { const rec = creer('tache', { fait: false }, t); setTaches((arr) => [rec, ...arr]); return rec; },
      updateTache: modifier(setTaches),
      removeTache: (id) => softDelete('tache', taches, setTaches, id),

      users,
      addUser: (u) => setUsers((arr) => [...arr, creer('user', { role: 'agent' }, u)]),
      removeUser: (id) => { setUsers((arr) => arr.filter((u) => u.id !== id)); marquerSupprimes([id]); },
      roles: ROLES,

      kmCumules,
      addKm: (n) => { setKmCumules((v) => v + n); setMeta((m) => ({ ...m, kmAt: now() })); },

      registre,

      removeMany: (type, ids) => softDeleteMany(type, listByType[type], setterByType[type], ids),

      trash,
      restoreFromTrash: (trashId) => {
        const entry = trash.find((t) => t.id === trashId);
        if (!entry) return;
        const setter = setterByType[entry.type];
        const rec = { ...entry.data, updatedAt: now() };
        if (setter) setter((arr) => [rec, ...arr.filter((x) => x.id !== rec.id)]);
        setTrash((t) => t.filter((x) => x.id !== trashId));
        setToast((cur) => (cur?.trashIds?.includes(trashId) ? null : cur));
      },
      restoreMany: (trashIds) => {
        const idSet = new Set(trashIds);
        const entries = trash.filter((t) => idSet.has(t.id));
        const t = now();
        const byType = {};
        entries.forEach((e) => { (byType[e.type] ||= []).push({ ...e.data, updatedAt: t }); });
        Object.entries(byType).forEach(([type, items]) => {
          const setter = setterByType[type];
          const ids = new Set(items.map((x) => x.id));
          if (setter) setter((arr) => [...items, ...arr.filter((x) => !ids.has(x.id))]);
        });
        setTrash((tr) => tr.filter((x) => !idSet.has(x.id)));
        setToast((cur) => (cur?.trashIds?.some((id) => idSet.has(id)) ? null : cur));
      },
      permanentlyDelete: (trashId) => {
        const entry = trash.find((t) => t.id === trashId);
        if (entry) marquerSupprimes([entry.id, entry.data?.id]);
        setTrash((t) => t.filter((x) => x.id !== trashId));
      },
      emptyTrash: () => {
        marquerSupprimes(trash.flatMap((e) => [e.id, e.data?.id]));
        setTrash([]);
      },

      toast,
      dismissToast: () => setToast(null),

      // Statut de synchronisation — la donnée vit sur le serveur (org_data),
      // rattachée à l'organisation authentifiée ; voir AuthContext.
      cloudStatus,
      cloudReady,
      syncNow: () => engineRef.current?.sync({ leger: true }),
      restoreSnapshot,

      lastBackupAt,
      exportSnapshot: async () => {
        const { downloadSnapshot } = await import('../lib/backup');
        const at = downloadSnapshot(currentSnapshot());
        setLastBackupAt(at);
        return at;
      },
      importSnapshot: async (file) => {
        const { readSnapshotFile } = await import('../lib/backup');
        const data = await readSnapshotFile(file);
        restoreSnapshot(data);
        return data;
      },
      exportSynthese: async () => {
        const { downloadSynthesePdf } = await import('../lib/pdfSynthese');
        downloadSynthesePdf({ societe, mandats, factures, notesFrais, registre });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [societe, mandats, factures, notesFrais, dossiers, users, kmCumules, registre, lastBackupAt, promesses, contacts, contactCategories, prospects, courriers, trash, toast, documents, taches, deleted, meta, cloudStatus, cloudReady]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
