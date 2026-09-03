
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadState, saveState, uid } from '../lib/storage';
import { buildRegistre } from '../lib/calc';
import { ROLES } from '../lib/seed';

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

// Types d'éléments passant par la corbeille, et vers quel tableau ils
// retournent lors d'une restauration.
const TRASH_TYPES = ['mandat', 'facture', 'frais', 'promesse', 'contact'];

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
  const [trash, setTrash] = useState(() => loadState('trash', []));

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
  useEffect(() => saveState('trash', trash), [trash]);

  const registre = useMemo(() => buildRegistre(factures, notesFrais), [factures, notesFrais]);

  // Suppression réversible — utilisée par tous les modules (mandats,
  // factures, notes de frais, promesses, contacts) : rien n'est perdu
  // immédiatement, l'élément part dans la corbeille avec toutes ses
  // données, restaurable à l'identique depuis la page Corbeille.
  function softDelete(type, list, setList, id) {
    const item = list.find((x) => x.id === id);
    if (!item) return;
    setTrash((t) => [{ id: uid('trash'), type, data: item, deletedAt: new Date().toISOString() }, ...t]);
    setList((arr) => arr.filter((x) => x.id !== id));
  }

  const setterByType = { mandat: setMandats, facture: setFactures, frais: setNotesFrais, promesse: setPromesses, contact: setContacts };

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

      dossiers,
      addDossier: (d) => {
        const rec = { id: uid('dossier'), createdAt: new Date().toISOString(), fichiers: [], partages: [], ...d };
        setDossiers((arr) => [rec, ...arr]);
        return rec;
      },
      updateDossier: (id, patch) => setDossiers((arr) => arr.map((d) => (d.id === id ? { ...d, ...patch } : d))),

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

      users,
      addUser: (u) => setUsers((arr) => [...arr, { id: uid('user'), role: 'agent', ...u }]),
      removeUser: (id) => setUsers((arr) => arr.filter((u) => u.id !== id)),
      roles: ROLES,

      kmCumules,
      addKm: (n) => setKmCumules((v) => v + n),

      registre,

      // Corbeille — restauration ou suppression définitive d'un élément
      // supprimé depuis n'importe quel module.
      trash,
      restoreFromTrash: (trashId) => {
        const entry = trash.find((t) => t.id === trashId);
        if (!entry) return;
        const setter = setterByType[entry.type];
        if (setter) setter((arr) => [entry.data, ...arr]);
        setTrash((t) => t.filter((x) => x.id !== trashId));
      },
      permanentlyDelete: (trashId) => setTrash((t) => t.filter((x) => x.id !== trashId)),
      emptyTrash: () => setTrash([]),

      // Sauvegarde & transfert — voir Paramètres. Tout est en local ;
      // ces fonctions donnent une trace exportable/restaurable.
      lastBackupAt,
      exportSnapshot: async () => {
        const { downloadSnapshot } = await import('../lib/backup');
        const at = downloadSnapshot({ societe, mandats, factures, notesFrais, dossiers, users, kmCumules, promesses, contacts, trash });
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
        setTrash(data.trash || []);
        return data;
      },
      exportSynthese: async () => {
        const { downloadSynthesePdf } = await import('../lib/pdfSynthese');
        downloadSynthesePdf({ societe, mandats, factures, notesFrais, registre });
      },
    }),
    [societe, mandats, factures, notesFrais, dossiers, users, kmCumules, registre, lastBackupAt, promesses, contacts, trash]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
