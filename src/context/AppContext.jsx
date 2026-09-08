
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadState, saveState, uid } from '../lib/storage';
import { buildRegistre } from '../lib/calc';
import { ROLES } from '../lib/seed';
import { trashEntryLabel } from '../lib/trashLabels';

const AppCtx = createContext(null);

const DEFAULT_SOCIETE = {
  onboarded: false,
  nom: '',
  siret: '',
  adresse: '',
  carteT: '',
  rcp: '',
  cpi: '',
  rcs: '',
  tvaIntra: '',
  banque: '',
  iban: '',
  bic: '',
  capitalSocial: 10000,
  immobilisationsNettes: 0,
  dettesDiverses: 0,
  regimeTva: 'reel_normal',
  tauxTvaDefaut: 20,
  couleurAccent: '#a06a2c',
  contactNom: '',
  telephone: '',
  email: '',
  photoContact: '',
  soldeTresorerieInitial: 0,
  remunerationGerantAnnuelle: 24000,
  chargesSocialesAnnuelle: 18000,
  dotationAmortissementAnnuelle: 1500,
  impotsTaxesAnnuel: 500,
  produitsFinanciersAnnuel: 0,
  chargesFinancieresAnnuel: 0,
  bareme: {
    type: 'degressif',
    tranches: [
      { jusqu_a: 200000, taux: 5 },
      { jusqu_a: 500000, taux: 4 },
      { jusqu_a: null, taux: 3 },
    ],
  },
};

export function AppProvider({ children }) {
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
  const [prospects, setProspects] = useState(() => loadState('prospects', []));
  const [courriers, setCourriers] = useState(() => loadState('courriers', []));
  const [trash, setTrash] = useState(() => loadState('trash', []));
  const [toast, setToast] = useState(null); // { trashIds: string[], label } — éphémère, non persisté

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
  useEffect(() => saveState('prospects', prospects), [prospects]);
  useEffect(() => saveState('courriers', courriers), [courriers]);
  useEffect(() => saveState('trash', trash), [trash]);

  const registre = useMemo(() => buildRegistre(factures, notesFrais), [factures, notesFrais]);

  // Suppression réversible — utilisée par tous les modules : rien n'est
  // perdu immédiatement, l'élément part dans la corbeille avec toutes ses
  // données. Un toast "Annuler" apparaît aussitôt (voir UndoToast) et reste
  // affiché indéfiniment (jusqu'à fermeture ou action suivante) — la
  // Corbeille reste de toute façon disponible sans limite de temps.
  function softDelete(type, list, setList, id) {
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const trashId = uid('trash');
    setTrash((t) => [{ id: trashId, type, data: item, deletedAt: new Date().toISOString() }, ...t]);
    setList((arr) => arr.filter((x) => x.id !== id));
    setToast({ trashIds: [trashId], label: trashEntryLabel(type, item) });
  }

  // Suppression groupée — "Tout supprimer" sur une section (respecte les
  // filtres déjà appliqués côté page). Chaque élément part individuellement
  // en corbeille ; un seul toast permet de tout restaurer d'un coup.
  function softDeleteMany(type, list, setList, ids) {
    const idSet = new Set(ids);
    const items = list.filter((x) => idSet.has(x.id));
    if (!items.length) return;
    const entries = items.map((item) => ({ id: uid('trash'), type, data: item, deletedAt: new Date().toISOString() }));
    setTrash((t) => [...entries, ...t]);
    setList((arr) => arr.filter((x) => !idSet.has(x.id)));
    setToast({ trashIds: entries.map((e) => e.id), label: `${items.length} élément${items.length > 1 ? 's' : ''}` });
  }

  const listByType = {
    mandat: mandats, facture: factures, frais: notesFrais, promesse: promesses,
    contact: contacts, prospect: prospects, courrier: courriers, dossier: dossiers,
  };
  const setterByType = {
    mandat: setMandats, facture: setFactures, frais: setNotesFrais,
    promesse: setPromesses, contact: setContacts, prospect: setProspects,
    courrier: setCourriers, dossier: setDossiers,
  };

  const value = useMemo(
    () => ({
      societe,
      setSociete: (patch) => setSocieteState((s) => ({ ...s, ...patch })),
      completeOnboarding: (patch) => setSocieteState((s) => ({ ...s, ...patch, onboarded: true })),

      mandats,
      addMandat: (m) => {
        const rec = { id: uid('mandat'), createdAt: new Date().toISOString(), statut: 'En cours', ...m };
        setMandats((arr) => [rec, ...arr]);
        return rec;
      },
      updateMandat: (id, patch) => setMandats((arr) => arr.map((m) => (m.id === id ? { ...m, ...patch } : m))),
      removeMandat: (id) => softDelete('mandat', mandats, setMandats, id),

      factures,
      addFacture: (f) => {
        const rec = { id: uid('fact'), createdAt: new Date().toISOString(), ...f };
        setFactures((arr) => [rec, ...arr]);
        return rec;
      },
      updateFacture: (id, patch) => setFactures((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f))),
      removeFacture: (id) => softDelete('facture', factures, setFactures, id),

      notesFrais,
      addNoteFrais: (n) => {
        const rec = { id: uid('frais'), createdAt: new Date().toISOString(), ...n };
        setNotesFrais((arr) => [rec, ...arr]);
        return rec;
      },
      updateNoteFrais: (id, patch) => setNotesFrais((arr) => arr.map((n) => (n.id === id ? { ...n, ...patch } : n))),
      removeNoteFrais: (id) => softDelete('frais', notesFrais, setNotesFrais, id),

      // Dossiers — classeurs libres, indépendants d'un mandat. Un mandat
      // reste utilisable comme dossier de classement (voir Suivi commercial),
      // mais un dossier peut aussi exister seul, pour un travail de
      // prospection qui n'a pas encore (ou n'aura jamais) de mandat signé.
      dossiers,
      addDossier: (d) => {
        const rec = { id: uid('dossier'), createdAt: new Date().toISOString(), fichiers: [], partages: [], ...d };
        setDossiers((arr) => [rec, ...arr]);
        return rec;
      },
      updateDossier: (id, patch) => setDossiers((arr) => arr.map((d) => (d.id === id ? { ...d, ...patch } : d))),
      removeDossier: (id) => softDelete('dossier', dossiers, setDossiers, id),

      promesses,
      addPromesse: (p) => {
        const rec = { id: uid('promesse'), createdAt: new Date().toISOString(), statut: 'En cours', ...p };
        setPromesses((arr) => [rec, ...arr]);
        return rec;
      },
      updatePromesse: (id, patch) => setPromesses((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removePromesse: (id) => softDelete('promesse', promesses, setPromesses, id),

      contacts,
      addContact: (c) => {
        const rec = { id: uid('contact'), createdAt: new Date().toISOString(), ...c };
        setContacts((arr) => [rec, ...arr]);
        return rec;
      },
      addContactsBulk: (list) => {
        const recs = list.map((c) => ({ id: uid('contact'), createdAt: new Date().toISOString(), ...c }));
        setContacts((arr) => [...recs, ...arr]);
        return recs;
      },
      updateContact: (id, patch) => setContacts((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      removeContact: (id) => softDelete('contact', contacts, setContacts, id),

      // Pipeline commercial — suivi des prospects investisseurs et des
      // courriers/mails de prospection, rattachables à un dossier libre.
      prospects,
      addProspect: (p) => {
        const rec = { id: uid('prospect'), createdAt: new Date().toISOString(), statut: 'À contacter', ...p };
        setProspects((arr) => [rec, ...arr]);
        return rec;
      },
      addProspectsBulk: (list) => {
        const recs = list.map((p) => ({ id: uid('prospect'), createdAt: new Date().toISOString(), statut: 'À contacter', ...p }));
        setProspects((arr) => [...recs, ...arr]);
        return recs;
      },
      updateProspect: (id, patch) => setProspects((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeProspect: (id) => softDelete('prospect', prospects, setProspects, id),

      courriers,
      addCourrier: (c) => {
        const rec = { id: uid('courrier'), createdAt: new Date().toISOString(), statut: 'Envoyé', ...c };
        setCourriers((arr) => [rec, ...arr]);
        return rec;
      },
      addCourriersBulk: (list) => {
        const recs = list.map((c) => ({ id: uid('courrier'), createdAt: new Date().toISOString(), statut: 'Envoyé', ...c }));
        setCourriers((arr) => [...recs, ...arr]);
        return recs;
      },
      updateCourrier: (id, patch) => setCourriers((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      removeCourrier: (id) => softDelete('courrier', courriers, setCourriers, id),

      users,
      addUser: (u) => setUsers((arr) => [...arr, { id: uid('user'), role: 'agent', ...u }]),
      removeUser: (id) => setUsers((arr) => arr.filter((u) => u.id !== id)),
      roles: ROLES,

      kmCumules,
      addKm: (n) => setKmCumules((v) => v + n),

      registre,

      // "Tout supprimer" sur une section — type + liste d'ids à supprimer
      // (la page appelante passe déjà la liste filtrée/affichée).
      removeMany: (type, ids) => softDeleteMany(type, listByType[type], setterByType[type], ids),

      // Corbeille — restauration ou suppression définitive d'un élément
      // supprimé depuis n'importe quel module.
      trash,
      restoreFromTrash: (trashId) => {
        const entry = trash.find((t) => t.id === trashId);
        if (!entry) return;
        const setter = setterByType[entry.type];
        if (setter) setter((arr) => [entry.data, ...arr]);
        setTrash((t) => t.filter((x) => x.id !== trashId));
        setToast((cur) => (cur?.trashIds?.includes(trashId) ? null : cur));
      },
      restoreMany: (trashIds) => {
        const idSet = new Set(trashIds);
        const entries = trash.filter((t) => idSet.has(t.id));
        const byType = {};
        entries.forEach((e) => { (byType[e.type] ||= []).push(e.data); });
        Object.entries(byType).forEach(([type, items]) => {
          const setter = setterByType[type];
          if (setter) setter((arr) => [...items, ...arr]);
        });
        setTrash((t) => t.filter((x) => !idSet.has(x.id)));
        setToast((cur) => (cur?.trashIds?.some((id) => idSet.has(id)) ? null : cur));
      },
      permanentlyDelete: (trashId) => setTrash((t) => t.filter((x) => x.id !== trashId)),
      emptyTrash: () => setTrash([]),

      // Toast d'annulation — affiché juste après toute suppression, partout
      // dans l'app, jusqu'à fermeture manuelle ou suppression suivante.
      toast,
      dismissToast: () => setToast(null),

      // Sauvegarde & transfert — voir Paramètres. Tout est en local ;
      // ces fonctions donnent une trace exportable/restaurable.
      lastBackupAt,
      exportSnapshot: async () => {
        const { downloadSnapshot } = await import('../lib/backup');
        const at = downloadSnapshot({
          societe, mandats, factures, notesFrais, dossiers, users, kmCumules,
          promesses, contacts, prospects, courriers, trash,
        });
        setLastBackupAt(at);
        return at;
      },
      importSnapshot: async (file) => {
        const { readSnapshotFile } = await import('../lib/backup');
        const data = await readSnapshotFile(file);
        setSocieteState(data.societe || DEFAULT_SOCIETE);
        setMandats(data.mandats || []);
        setFactures(data.factures || []);
        setNotesFrais(data.notesFrais || []);
        setDossiers(data.dossiers || []);
        setUsers(data.users || []);
        setKmCumules(data.kmCumules || 0);
        setPromesses(data.promesses || []);
        setContacts(data.contacts || []);
        setProspects(data.prospects || []);
        setCourriers(data.courriers || []);
        setTrash(data.trash || []);
        return data;
      },
      exportSynthese: async () => {
        const { downloadSynthesePdf } = await import('../lib/pdfSynthese');
        downloadSynthesePdf({ societe, mandats, factures, notesFrais, registre });
      },
    }),
    [societe, mandats, factures, notesFrais, dossiers, users, kmCumules, registre, lastBackupAt, promesses, contacts, prospects, courriers, trash, toast]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
