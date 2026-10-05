import { useMemo, useState } from 'react';
import { Mail as MailIcon, RefreshCw, Sparkles, Send, Users, Loader2, Plug, LogOut, AlertCircle, PenLine, X, FolderOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { connectGmail, gmailConnected, gmailDisconnect, gmailList, gmailSendReply, gmailSendNew, gmailImportContacts } from '../lib/email/gmail';
import { connectOutlook, outlookConnected, outlookDisconnect, outlookList, outlookSendReply, outlookSendNew, outlookImportContacts } from '../lib/email/outlook';
import { hasApiKey, draftEmailReply, draftEmailNew, buildAppSnapshot } from '../lib/ai';
import { formatEUR, formatDate } from '../lib/calc';
import { PageHeader, Card, Button, Badge, EmptyState, Textarea, Modal, Field, Input, Select } from '../components/ui';

const mailPreconfigure = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_MS_CLIENT_ID);

// --- La secrétaire reconnaît l'expéditeur : contexte dossier instantané,
// --- sans appel IA — contact, promesses, factures, mandats liés.
function buildEmailContext(app, email) {
  if (!email) return [];
  const addr = ((email.from.match(/<(.+)>/) || [null, email.from])[1] || '').toLowerCase().trim();
  const name = email.from.replace(/<.*>/, '').trim().toLowerCase();

  const contact = (app.contacts || []).find((c) => (c.email || '').toLowerCase() === addr)
    || (app.contacts || []).find((c) => {
      const full = `${c.prenom || ''} ${c.nom || ''}`.trim().toLowerCase();
      return (full.length > 3 && name.includes(full)) || (c.societe && name.includes(String(c.societe).toLowerCase()));
    });

  // Termes identifiants : nom du contact / société / morceaux du nom expéditeur
  const terms = [
    contact && `${contact.prenom || ''} ${contact.nom || ''}`.trim(),
    contact?.societe,
    contact?.nom,
    name,
  ].filter((t) => t && t.length > 3).map((t) => t.toLowerCase());
  const hit = (field) => {
    const v = String(field || '').toLowerCase();
    return v.length > 3 && terms.some((t) => v.includes(t) || t.includes(v));
  };

  const out = [];
  if (contact) out.push({ label: `Contact : ${[contact.prenom, contact.nom].filter(Boolean).join(' ')}${contact.societe ? ` (${contact.societe})` : ''}` });
  (app.promesses || []).forEach((p) => {
    if (hit(p.vendeur) || hit(p.acquereur)) out.push({ label: `Promesse : ${p.bienAdresse || '—'}${p.dateReiteration ? ` — réitération le ${formatDate(p.dateReiteration)}` : ''} (${p.statut || 'en cours'})` });
  });
  (app.factures || []).forEach((f) => {
    if (hit(f.client)) out.push({ label: `Facture ${f.numero} — ${formatEUR(f.montantTTC)} TTC (${f.statut})` });
  });
  (app.mandats || []).forEach((m) => {
    if (hit(m.mandant)) out.push({ label: `Mandat ${m.numero || ''} — ${m.adresse || ''} (${m.statut || 'en cours'})` });
  });
  return out.slice(0, 4);
}

export default function Mail() {
  const app = useApp();
  const { societe, addContactsBulk } = app;
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sent, setSent] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [, force] = useState(0);

  const connected = gmailConnected() || outlookConnected();
  const snapshot = useMemo(() => buildAppSnapshot(app), [app]);
  const contexte = useMemo(() => buildEmailContext(app, selected), [app, selected]);

  async function run(fn) {
    setError('');
    try { await fn(); } catch (e) { setError(e.message); }
  }

  async function refresh() {
    setLoading(true);
    await run(async () => {
      const lists = [];
      if (gmailConnected()) lists.push(gmailList({ max: 25 }));
      if (outlookConnected()) lists.push(outlookList({ max: 25 }));
      const all = (await Promise.all(lists)).flat().sort((a, b) => new Date(b.date) - new Date(a.date));
      setEmails(all);
    });
    setLoading(false);
  }

  async function doConnect(provider) {
    await run(async () => {
      if (provider === 'gmail') await connectGmail(societe.googleClientId);
      else await connectOutlook(societe.msClientId);
      force((n) => n + 1);
      await refresh();
    });
  }

  async function doImportContacts() {
    setImporting(true);
    await run(async () => {
      const lists = [];
      if (gmailConnected()) lists.push(gmailImportContacts());
      if (outlookConnected()) lists.push(outlookImportContacts());
      const all = (await Promise.all(lists)).flat();
      // Dédoublonnage simple par email contre les contacts existants
      const known = new Set(app.contacts.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
      const fresh = all.filter((c) => !c.email || !known.has(c.email.toLowerCase()));
      if (fresh.length) addContactsBulk(fresh);
      alert(`${fresh.length} contact(s) importé(s) (${all.length - fresh.length} déjà présents).`);
    });
    setImporting(false);
  }

  async function doDraft() {
    if (!selected) return;
    setDrafting(true);
    await run(async () => {
      const text = await draftEmailReply(societe, {
        from: selected.from, subject: selected.subject, body: selected.body, snapshot,
      });
      setDraft(text);
    });
    setDrafting(false);
  }

  async function doSend() {
    if (!selected || !draft) return;
    setSending(true);
    await run(async () => {
      if (selected.provider === 'gmail') {
        const to = (selected.from.match(/<(.+)>/) || [null, selected.from])[1];
        await gmailSendReply({ to, subject: selected.subject, body: draft, threadId: selected.threadId, inReplyTo: selected.messageIdHeader });
      } else {
        await outlookSendReply({ messageId: selected.id, body: draft });
      }
      setSent(true); setTimeout(() => setSent(false), 2500);
      setDraft('');
    });
    setSending(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Communication"
        title="Boîte mail"
        description="Connectez votre compte en un clic : lecture, envoi, réponses rédigées par l'IA avec le contexte de vos dossiers, import des contacts."
        action={
          <div className="flex gap-2">
            {connected && <Button variant="outline" onClick={doImportContacts} disabled={importing}>{importing ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Importer les contacts</Button>}
            {connected && <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser</Button>}
            {connected && <Button variant="brass" onClick={() => setComposeOpen(true)}><PenLine size={15} /> Nouveau message</Button>}
          </div>
        }
      />

      {error && <div className="mb-4 flex items-center gap-2 text-[13px] text-rust bg-rust/5 border border-rust/20 rounded-lg px-4 py-3"><AlertCircle size={15} /> {error}</div>}

      <div className="flex flex-wrap gap-2 mb-5">
        <Button variant={gmailConnected() ? 'outline' : 'brass'} onClick={() => (gmailConnected() ? (gmailDisconnect(), force((n) => n + 1)) : doConnect('gmail'))}>
          {gmailConnected() ? <LogOut size={14} /> : <Plug size={14} />} Gmail {gmailConnected() ? '— déconnecter' : ''}
        </Button>
        <Button variant={outlookConnected() ? 'outline' : 'brass'} onClick={() => (outlookConnected() ? (outlookDisconnect(), force((n) => n + 1)) : doConnect('outlook'))}>
          {outlookConnected() ? <LogOut size={14} /> : <Plug size={14} />} Outlook {outlookConnected() ? '— déconnecter' : ''}
        </Button>
      </div>

      {!connected ? (
        <EmptyState
          icon={MailIcon}
          title="Connectez votre messagerie"
          description={mailPreconfigure || societe.googleClientId || societe.msClientId
            ? "Cliquez sur Gmail ou Outlook ci-dessus, puis choisissez votre compte dans la fenêtre qui s'ouvre — c'est tout. Vos identifiants restent chez Google/Microsoft, rien ne transite par un serveur tiers."
            : "La messagerie n'est pas encore configurée pour cette application : l'administrateur doit créer les Client ID (guide pas à pas dans Paramètres > Intégrations > Administrateur)."}
        />
      ) : (
        <div className="grid lg:grid-cols-[380px_1fr] gap-5">
          <Card padded={false} className="overflow-hidden max-h-[70vh] overflow-y-auto">
            {emails.length === 0 && <div className="p-5 text-[13px] text-ink-faint">Cliquez sur « Actualiser » pour charger la boîte de réception.</div>}
            {emails.map((m) => (
              <button key={m.provider + m.id} onClick={() => { setSelected(m); setDraft(''); }}
                className={`w-full text-left px-4 py-3 border-b border-line-soft hover:bg-paper-raised ${selected?.id === m.id ? 'bg-paper-raised' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12.5px] truncate ${m.unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{m.from.replace(/<.*>/, '').trim()}</span>
                  <span className="text-[10.5px] text-ink-faint shrink-0">{new Date(m.date).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className={`text-[12.5px] truncate ${m.unread ? 'font-medium text-ink' : 'text-ink-soft'}`}>{m.subject || '(sans objet)'}</div>
                <div className="text-[11.5px] text-ink-faint truncate">{m.snippet}</div>
              </button>
            ))}
          </Card>

          <div>
            {!selected ? (
              <EmptyState icon={MailIcon} title="Sélectionnez un message" description="Le contenu s'affiche ici, avec le contexte de vos dossiers et la réponse proposée par l'IA." />
            ) : (
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-[16px] text-ink">{selected.subject || '(sans objet)'}</div>
                    <div className="text-[12px] text-ink-faint mt-1">{selected.from} — {new Date(selected.date).toLocaleString('fr-FR')}</div>
                  </div>
                  <Badge tone="default">{selected.provider}</Badge>
                </div>

                {contexte.length > 0 && (
                  <div className="mt-3 rounded-lg border border-brass/25 bg-brass-soft/30 px-3.5 py-2.5">
                    <div className="text-[10.5px] uppercase tracking-wide text-brass mb-1.5 flex items-center gap-1"><FolderOpen size={11} /> Dans vos dossiers</div>
                    <div className="space-y-1">
                      {contexte.map((c, i) => (
                        <div key={i} className="text-[12px] text-ink">{c.label}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 text-[13px] text-ink-soft whitespace-pre-wrap max-h-[30vh] overflow-y-auto border-t border-line-soft pt-4">{selected.body || selected.snippet}</div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] uppercase tracking-wide text-ink-faint">Réponse</div>
                    <Button variant="outline" onClick={doDraft} disabled={drafting || !hasApiKey(societe)} title={!hasApiKey(societe) ? "IA non configurée (Paramètres > Intégrations)" : ''}>
                      {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Rédiger avec l'IA
                    </Button>
                  </div>
                  <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Rédigez votre réponse, ou laissez l'IA proposer un brouillon à partir du contexte de vos dossiers…" />
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="brass" onClick={doSend} disabled={!draft || sending}>
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer la réponse
                    </Button>
                    {sent && <span className="text-[12.5px] text-teal">Réponse envoyée ✓</span>}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} snapshot={snapshot} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer — nouveau message avec sélection des contacts de l'appli (chips +
// suggestions), brouillon IA sur consigne, envoi Gmail ou Outlook.
// ---------------------------------------------------------------------------
function ComposeModal({ open, onClose, snapshot }) {
  const { societe, contacts } = useApp();
  const [to, setTo] = useState([]); // adresses email retenues
  const [input, setInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [consigne, setConsigne] = useState('');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const providers = [gmailConnected() && 'gmail', outlookConnected() && 'outlook'].filter(Boolean);
  const activeProvider = provider || providers[0];

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return (contacts || [])
      .filter((c) => c.email && !to.includes(c.email))
      .filter((c) => [`${c.prenom || ''} ${c.nom || ''}`, c.societe, c.email].some((v) => String(v || '').toLowerCase().includes(q)))
      .slice(0, 6);
  }, [input, contacts, to]);

  function addAddr(addr) {
    const a = addr.trim().replace(/[;,]$/, '');
    if (a && /\S+@\S+\.\S+/.test(a) && !to.includes(a)) setTo((t) => [...t, a]);
    setInput('');
  }
  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && input.trim()) { e.preventDefault(); addAddr(input); }
    if (e.key === 'Backspace' && !input && to.length) setTo(to.slice(0, -1));
  }

  async function doDraft() {
    setBusy(true); setError('');
    try {
      const text = await draftEmailNew(societe, { to: to.join(', '), subject, instructions: consigne, snapshot });
      setBody(text);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function doSend() {
    if (!to.length || !body) return;
    setSending(true); setError('');
    try {
      if (activeProvider === 'gmail') await gmailSendNew({ to, subject, body });
      else await outlookSendNew({ to, subject, body });
      setDone(true);
      setTimeout(() => { setDone(false); setTo([]); setSubject(''); setBody(''); setConsigne(''); onClose(); }, 1200);
    } catch (e) { setError(e.message); }
    setSending(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau message" width="max-w-2xl">
      <div className="space-y-4">
        <Field label="Destinataires" hint="Tapez un nom, une société ou un email — vos contacts sont proposés automatiquement.">
          <div className="rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brass">
            <div className="flex flex-wrap gap-1.5 items-center">
              {to.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brass-soft text-ink text-[12px] pl-2.5 pr-1 py-0.5">
                  {a}
                  <button type="button" onClick={() => setTo(to.filter((x) => x !== a))} className="h-4 w-4 rounded-full hover:bg-rust hover:text-white flex items-center justify-center"><X size={10} /></button>
                </span>
              ))}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                onBlur={() => input.trim() && addAddr(input)}
                placeholder={to.length ? '' : 'Nom, société ou adresse email…'}
                className="flex-1 min-w-[160px] bg-transparent px-1.5 py-1 text-[13px] focus:outline-none"
              />
            </div>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1 rounded-lg border border-line bg-surface shadow-sm overflow-hidden">
              {suggestions.map((c, i) => (
                <button key={c.id || c.email || i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addAddr(c.email)}
                  className="w-full text-left px-3 py-2 hover:bg-brass-soft/40 flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-ink truncate">{[c.prenom, c.nom].filter(Boolean).join(' ') || c.email}{c.societe ? ` — ${c.societe}` : ''}</span>
                  <span className="text-[11.5px] text-ink-faint truncate">{c.email}</span>
                </button>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="Objet"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          {providers.length > 1 && (
            <Field label="Envoyer via">
              <Select value={activeProvider} onChange={(e) => setProvider(e.target.value)}>
                {providers.map((p) => <option key={p} value={p}>{p === 'gmail' ? 'Gmail' : 'Outlook'}</option>)}
              </Select>
            </Field>
          )}
        </div>

        {hasApiKey(societe) && (
          <Field label="Demander à l'IA" hint="Ex. « Propose une visite du bâtiment de Lescar mardi ou jeudi après-midi » — l'IA connaît vos dossiers.">
            <div className="flex gap-2">
              <Input value={consigne} onChange={(e) => setConsigne(e.target.value)} placeholder="Consigne pour le brouillon…" className="flex-1" />
              <Button variant="outline" onClick={doDraft} disabled={busy || !to.length}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Rédiger
              </Button>
            </div>
          </Field>
        )}

        <Field label="Message"><Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" /></Field>

        {error && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {error}</div>}

        <div className="flex items-center justify-end gap-3 pt-1">
          {done && <span className="text-[12.5px] text-teal">Message envoyé ✓</span>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="brass" onClick={doSend} disabled={!to.length || !body || sending}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
