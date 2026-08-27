import { useState, useRef } from 'react';
import { Plus, Trash2, Users, Building2, Percent, ShieldCheck, AlertTriangle, FileSignature, Landmark, Download, Upload, FileDown, CloudOff, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { clearAll } from '../lib/storage';
import { formatDate } from '../lib/calc';
import { PageHeader, Card, Button, Field, Input, Select, Badge } from '../components/ui';

export default function Parametres() {
  const { societe, setSociete, users, addUser, removeUser, roles, lastBackupAt, exportSnapshot, importSnapshot, exportSynthese } = useApp();
  const [form, setForm] = useState(societe);
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    setSociete({ ...form, capitalSocial: Number(form.capitalSocial) || 0, tauxTvaDefaut: Number(form.tauxTvaDefaut) || 20 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateTranche(i, patch) {
    const tranches = form.bareme.tranches.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setForm({ ...form, bareme: { ...form.bareme, tranches } });
  }

  function resetApp() {
    if (confirm('Réinitialiser toutes les données de démonstration ? Cette action est irréversible.')) {
      clearAll();
      window.location.reload();
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Paramètres" description="Informations de la société, barème d'honoraires et accès collaborateurs." />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-5">
        <BackupCard lastBackupAt={lastBackupAt} exportSnapshot={exportSnapshot} importSnapshot={importSnapshot} exportSynthese={exportSynthese} />
        <Card>
          <div className="flex items-center gap-2 mb-4"><Building2 size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Société</h3></div>
          <form onSubmit={save} className="space-y-4">
            <Field label="Raison sociale"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SIRET"><Input value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} /></Field>
              <Field label="Capital social"><Input type="number" value={form.capitalSocial} onChange={(e) => setForm({ ...form, capitalSocial: e.target.value })} /></Field>
            </div>
            <Field label="Adresse du siège"><Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Carte T"><Input value={form.carteT} onChange={(e) => setForm({ ...form, carteT: e.target.value })} /></Field>
              <Field label="RCP"><Input value={form.rcp} onChange={(e) => setForm({ ...form, rcp: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Régime de TVA">
                <Select value={form.regimeTva} onChange={(e) => setForm({ ...form, regimeTva: e.target.value })}>
                  <option value="reel_normal">Réel normal</option>
                  <option value="reel_simplifie">Réel simplifié</option>
                  <option value="franchise">Franchise en base</option>
                </Select>
              </Field>
              <Field label="TVA par défaut">
                <Select value={form.tauxTvaDefaut} onChange={(e) => setForm({ ...form, tauxTvaDefaut: e.target.value })}>
                  <option value={20}>20 %</option><option value={10}>10 %</option><option value={0}>0 %</option>
                </Select>
              </Field>
            </div>
            <Field label="Solde de trésorerie initial"><Input type="number" value={form.soldeTresorerieInitial} onChange={(e) => setForm({ ...form, soldeTresorerieInitial: Number(e.target.value) })} /></Field>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" variant="brass">Enregistrer</Button>
              {saved && <span className="text-[12px] text-teal flex items-center gap-1"><ShieldCheck size={13} /> Enregistré</span>}
            </div>
          </form>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4"><FileSignature size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Mentions légales & coordonnées bancaires</h3></div>
          <p className="text-[12px] text-ink-soft mb-3">Reprises en pied de vos factures, comme sur les documents de vos confrères.</p>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="N° carte professionnelle (CPI)" hint="Habilitation transaction"><Input value={form.cpi} onChange={(e) => setForm({ ...form, cpi: e.target.value })} /></Field>
              <Field label="Assurance RC Pro (RCP)"><Input value={form.rcp} onChange={(e) => setForm({ ...form, rcp: e.target.value })} /></Field>
              <Field label="N° RCS"><Input value={form.rcs} onChange={(e) => setForm({ ...form, rcs: e.target.value })} /></Field>
              <Field label="N° TVA intracommunautaire"><Input value={form.tvaIntra} onChange={(e) => setForm({ ...form, tvaIntra: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Banque"><Input value={form.banque} onChange={(e) => setForm({ ...form, banque: e.target.value })} /></Field>
              <Field label="IBAN"><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></Field>
              <Field label="BIC"><Input value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} /></Field>
            </div>
            <Button type="submit" variant="outline" size="sm">Enregistrer</Button>
          </form>
        </Card>

        <Card  >
          <div className="flex items-center gap-2 mb-4"><Landmark size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Charges de structure annuelles</h3></div>
          <p className="text-[12px] text-ink-soft mb-3">
            Utilisées pour construire le compte de résultat (valeur ajoutée, EBE, résultat d'exploitation) — proratisées sur la période choisie en Comptabilité.
          </p>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rémunération annuelle du gérant"><Input type="number" value={form.remunerationGerantAnnuelle} onChange={(e) => setForm({ ...form, remunerationGerantAnnuelle: e.target.value })} /></Field>
              <Field label="Charges sociales annuelles"><Input type="number" value={form.chargesSocialesAnnuelle} onChange={(e) => setForm({ ...form, chargesSocialesAnnuelle: e.target.value })} /></Field>
              <Field label="Impôts et taxes annuels" hint="CFE, taxe foncière…"><Input type="number" value={form.impotsTaxesAnnuel} onChange={(e) => setForm({ ...form, impotsTaxesAnnuel: e.target.value })} /></Field>
              <Field label="Dotation aux amortissements annuelle"><Input type="number" value={form.dotationAmortissementAnnuelle} onChange={(e) => setForm({ ...form, dotationAmortissementAnnuelle: e.target.value })} /></Field>
            </div>
            <Button type="submit" variant="outline" size="sm">Enregistrer</Button>
          </form>
        </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 mb-4"><Percent size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Barème d'honoraires</h3></div>
            <p className="text-[12px] text-ink-soft mb-3">Barème dégressif par tranches de prix de vente, utilisé par le générateur de factures.</p>
            <div className="space-y-2">
              {form.bareme.tranches.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[12px] text-ink-faint w-24 shrink-0">
                    {i === 0 ? 'Jusqu\u2019à' : `De ${form.bareme.tranches[i - 1].jusqu_a?.toLocaleString('fr-FR')} à`}
                  </span>
                  <Input
                    type="number"
                    disabled={t.jusqu_a === null}
                    value={t.jusqu_a ?? ''}
                    placeholder="∞"
                    onChange={(e) => updateTranche(i, { jusqu_a: e.target.value ? Number(e.target.value) : null })}
                    className="!py-1.5"
                  />
                  <Input type="number" value={t.taux} onChange={(e) => updateTranche(i, { taux: Number(e.target.value) })} className="!py-1.5 w-20" />
                  <span className="text-[12px] text-ink-faint">%</span>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={save}>Enregistrer le barème</Button>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Users size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Utilisateurs & rôles</h3></div>
            </div>
            <UserAdder onAdd={addUser} roles={roles} />
            <ul className="mt-4 space-y-2">
              {users.length === 0 && <p className="text-[12px] text-ink-faint">Aucun collaborateur ajouté — vous êtes seul utilisateur.</p>}
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-[13px] border border-line rounded-lg px-3 py-2">
                  <div>
                    <div className="text-ink">{u.nom}</div>
                    <div className="text-[11px] text-ink-faint">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="brass">{roles.find((r) => r.id === u.role)?.label}</Badge>
                    <button onClick={() => removeUser(u.id)} className="p-1.5 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-rust/20">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-rust" /><h3 className="font-display text-[16px] text-ink">Zone sensible</h3></div>
            <p className="text-[12px] text-ink-soft mb-3">Réinitialise toutes les données saisies dans cet espace de démonstration.</p>
            <Button variant="danger" onClick={resetApp}>Réinitialiser les données</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackupCard({ lastBackupAt, exportSnapshot, importSnapshot, exportSynthese }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'ok'|'error', message }

  async function handleExport() {
    setBusy(true);
    try {
      await exportSnapshot();
      setFeedback({ type: 'ok', message: 'Sauvegarde téléchargée.' });
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Restaurer ce fichier remplacera toutes les données actuellement enregistrées sur cet appareil. Continuer ?')) {
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      await importSnapshot(file);
      alert('Compte restauré avec succès. La page va se recharger.');
      window.location.reload();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Restauration impossible.' });
      setBusy(false);
      e.target.value = '';
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  async function handleSynthese() {
    setBusy(true);
    try {
      await exportSynthese();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-brass/25">
      <div className="flex items-center gap-2 mb-2"><CloudOff size={16} className="text-brass" /><h3 className="font-display text-[16px] text-ink">Sauvegarde & transfert du compte</h3></div>
      <p className="text-[12px] text-ink-soft mb-4">
        Toutes vos données (mandats, factures, notes de frais…) sont enregistrées uniquement sur cet
        appareil, dans ce navigateur — rien n'est envoyé à un serveur. Cela veut dire qu'un cache vidé
        ou un changement d'ordinateur peut faire disparaître ces données si elles n'ont pas été
        sauvegardées. Téléchargez une sauvegarde régulièrement, ou pour passer d'un appareil à l'autre.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-line rounded-lg p-3.5">
          <div className="text-[12.5px] font-medium text-ink mb-1">Sauvegarde complète (.json)</div>
          <div className="text-[11.5px] text-ink-faint mb-3">
            {lastBackupAt ? `Dernière sauvegarde : ${formatDate(lastBackupAt)}` : 'Aucune sauvegarde téléchargée pour l\u2019instant.'}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="brass" size="sm" onClick={handleExport} disabled={busy}>
              <Download size={13} /> Télécharger la sauvegarde
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={13} /> Restaurer depuis un fichier
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          </div>
        </div>

        <div className="border border-line rounded-lg p-3.5">
          <div className="text-[12.5px] font-medium text-ink mb-1">Synthèse du compte (.pdf)</div>
          <div className="text-[11.5px] text-ink-faint mb-3">
            Récapitulatif lisible de tout ce qui a été saisi — mandats, factures, notes de frais — à
            garder pour vos archives ou à transmettre à votre comptable.
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleSynthese} disabled={busy}>
            <FileDown size={13} /> Générer la synthèse
          </Button>
        </div>
      </div>

      {feedback && (
        <div className={`mt-3 flex items-center gap-1.5 text-[12px] ${feedback.type === 'ok' ? 'text-teal' : 'text-rust'}`}>
          {feedback.type === 'ok' ? <Check size={13} /> : <AlertTriangle size={13} />} {feedback.message}
        </div>
      )}

      <p className="text-[11px] text-ink-faint mt-3">
        Pour transférer le compte vers un autre appareil ou navigateur : téléchargez la sauvegarde ici,
        transmettez le fichier .json (email, clé USB…), puis ouvrez Mandat sur l'autre appareil et
        utilisez « Restaurer depuis un fichier ».
      </p>
    </Card>
  );
}

function UserAdder({ onAdd, roles }) {
  const [form, setForm] = useState({ nom: '', email: '', role: 'agent' });
  function submit(e) {
    e.preventDefault();
    if (!form.nom) return;
    onAdd(form);
    setForm({ nom: '', email: '', role: 'agent' });
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="flex-1 min-w-[120px] !py-2" />
      <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="flex-1 min-w-[140px] !py-2" />
      <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-auto !py-2">
        {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </Select>
      <Button type="submit" variant="outline" size="sm"><Plus size={14} /> Ajouter</Button>
    </form>
  );
}
