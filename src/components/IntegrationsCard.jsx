import { useState } from 'react';
import { Bot, Check, Eye, EyeOff, ChevronDown, ChevronRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_MODEL, hasApiKey } from '../lib/ai';
import { Card, Field, Input, Select, Button, Badge } from './ui';

// Carte Intégrations — deux niveaux :
//   · pour l'UTILISATEUR : l'état des services, et quoi faire (en un clic) ;
//   · pour l'ADMINISTRATEUR : les tutos pas à pas et les champs techniques,
//     repliés — à configurer UNE SEULE FOIS pour toute l'application.
// Stocke dans `societe` : anthropicApiKey (optionnelle), aiModel,
// googleClientId, msClientId (tous optionnels si variables d'environnement).

const envGoogle = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const envMs = import.meta.env.VITE_MS_CLIENT_ID;
const envSupabase = import.meta.env.VITE_SUPABASE_URL;

function Etat({ ok, okLabel, koLabel }) {
  return <Badge tone={ok ? 'teal' : 'rust'}>{ok ? okLabel : koLabel}</Badge>;
}

function Tuto({ titre, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line bg-paper-raised">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
        <span className="text-[12.5px] font-medium text-ink">{titre}</span>
        {open ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-3">{children}</div>}
    </div>
  );
}

function Etapes({ items }) {
  return (
    <ol className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-[12px] text-ink-soft leading-relaxed">
          <span className="shrink-0 h-[18px] w-[18px] rounded-full bg-brass-soft text-brass text-[10.5px] font-semibold flex items-center justify-center mt-[1px]">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Lien({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brass hover:text-brass-deep inline-flex items-center gap-0.5">
      {children} <ExternalLink size={10} />
    </a>
  );
}

export default function IntegrationsCard() {
  const { societe, setSociete } = useApp();
  const [form, setForm] = useState({
    anthropicApiKey: societe.anthropicApiKey || '',
    aiModel: societe.aiModel || DEFAULT_MODEL,
    googleClientId: societe.googleClientId || '',
    msClientId: societe.msClientId || '',
  });
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const iaOk = hasApiKey(societe);
  const iaMode = societe.anthropicApiKey ? 'clé personnelle' : envSupabase ? 'partagée' : null;
  const gmailOk = Boolean(envGoogle || societe.googleClientId);
  const outlookOk = Boolean(envMs || societe.msClientId);

  function save(e) {
    e.preventDefault();
    setSociete(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Bot size={16} className="text-brass" />
        <div className="font-display text-[15px] text-ink">Intégrations — IA & messagerie</div>
      </div>
      <p className="text-[12px] text-ink-faint mb-4">
        L'état de vos services. Tout est pensé pour que vous n'ayez rien à configurer : la partie technique est l'affaire de l'administrateur, une seule fois.
      </p>

      {/* --- État pour l'utilisateur --- */}
      <div className="space-y-2.5 mb-5">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-ink">Intelligence artificielle{iaMode ? <span className="text-ink-faint"> — {iaMode}</span> : null}</span>
          <Etat ok={iaOk} okLabel="Active" koLabel="À configurer" />
        </div>
        <div className="text-[11.5px] text-ink-faint -mt-1.5">
          {iaOk ? 'Copilote, briefing du jour, rédaction d\u2019emails, extraction d\u2019actes et textes d\u2019IM : tout est prêt.' : 'Voir la section Administrateur ci-dessous, ou saisissez une clé personnelle.'}
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-ink">Gmail</span>
          <Etat ok={gmailOk} okLabel="Prêt — connectez-vous dans la Boîte mail" koLabel="À configurer (administrateur)" />
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-ink">Outlook / Microsoft 365</span>
          <Etat ok={outlookOk} okLabel="Prêt — connectez-vous dans la Boîte mail" koLabel="À configurer (administrateur)" />
        </div>
        {(gmailOk || outlookOk) && (
          <div className="text-[11.5px] text-ink-faint">
            Pour vos mails : ouvrez la <span className="font-medium text-ink">Boîte mail</span>, cliquez sur « Gmail » ou « Outlook », choisissez votre compte dans la fenêtre officielle — c'est tout. Vos identifiants restent chez Google/Microsoft.
          </div>
        )}
      </div>

      {/* --- Section Administrateur --- */}
      <button type="button" onClick={() => setAdminOpen((o) => !o)} className="w-full flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 hover:bg-paper-raised transition-colors">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink"><ShieldCheck size={14} className="text-brass" /> Administrateur — configuration (une seule fois)</span>
        {adminOpen ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
      </button>

      {adminOpen && (
        <form onSubmit={save} className="mt-4 space-y-4">
          <Tuto titre="1 · Activer l'IA pour tous les utilisateurs (recommandé)">
            <Etapes items={[
              <>Créez un compte sur <Lien href="https://console.anthropic.com">console.anthropic.com</Lien> (c'est l'offre API d'Anthropic, indépendante d'un abonnement Claude).</>,
              <>Dans <em>Billing</em>, achetez des crédits prépayés (5–10 € suffisent pour commencer) et définissez un <strong>plafond de dépense</strong> : au pire, l'IA s'arrête, jamais de mauvaise surprise.</>,
              <>Dans <em>API keys</em>, créez une clé (sk-ant-…).</>,
              <>Dans votre projet Supabase : <em>Edge Functions → Deploy new function</em>, nom <code>claude-proxy</code>, collez le fichier <code>supabase/functions/claude-proxy/index.ts</code> du projet, puis dans <em>Edge Functions → Secrets</em> ajoutez <code>ANTHROPIC_API_KEY</code> = votre clé. (En ligne de commande : <code>supabase functions deploy claude-proxy</code> puis <code>supabase secrets set ANTHROPIC_API_KEY=…</code>.)</>,
              <>C'est tout : chaque utilisateur connecté profite de l'IA, sans rien saisir. La clé ne quitte jamais le serveur.</>,
            ]} />
          </Tuto>

          <Tuto titre="2 · Activer Gmail pour tous les utilisateurs">
            <Etapes items={[
              <>Sur <Lien href="https://console.cloud.google.com">console.cloud.google.com</Lien>, créez un projet (ex. « Mandat »).</>,
              <>Dans <em>API et services → Bibliothèque</em>, activez <strong>Gmail API</strong> et <strong>People API</strong>.</>,
              <>Dans <em>Écran de consentement OAuth</em> : type <em>Externe</em>, renseignez le nom de l'appli et votre email. Tant que l'appli est « En test », ajoutez dans <em>Utilisateurs test</em> les adresses Gmail autorisées à se connecter (la vôtre et celles de vos utilisateurs).</>,
              <>Dans <em>Identifiants → Créer des identifiants → ID client OAuth</em> : type <strong>Application Web</strong>, et dans <em>Origines JavaScript autorisées</em> ajoutez <code>http://localhost:5173</code> et l'URL de production de l'appli.</>,
              <>Copiez l'ID client (…apps.googleusercontent.com) dans le champ ci-dessous, ou en variable d'environnement <code>VITE_GOOGLE_CLIENT_ID</code> sur l'hébergeur.</>,
              <>Ensuite, chaque utilisateur clique simplement « Connecter Gmail » et choisit son compte. Pour ouvrir à n'importe quel Gmail sans liste de testeurs, il faudra passer l'appli en « Production » (vérification Google, à prévoir avant commercialisation).</>,
            ]} />
            <Field label="Google Client ID" hint={envGoogle ? 'Déjà fourni par la variable d\u2019environnement — ce champ peut rester vide.' : 'xxxxx.apps.googleusercontent.com'}>
              <Input value={form.googleClientId} onChange={(e) => setForm({ ...form, googleClientId: e.target.value })} placeholder={envGoogle ? '(configuré via l\u2019environnement)' : 'xxxxx.apps.googleusercontent.com'} />
            </Field>
          </Tuto>

          <Tuto titre="3 · Activer Outlook / Microsoft 365 (optionnel)">
            <Etapes items={[
              <>Sur <Lien href="https://portal.azure.com">portal.azure.com</Lien> : <em>Microsoft Entra ID → Inscriptions d'applications → Nouvelle inscription</em>.</>,
              <>Types de comptes : <em>Comptes dans un annuaire organisationnel et comptes Microsoft personnels</em>. Plateforme : <strong>Application monopage (SPA)</strong>, URI de redirection = <code>http://localhost:5173</code> puis l'URL de production.</>,
              <>Dans <em>API autorisées</em>, ajoutez Microsoft Graph (déléguées) : <code>Mail.Read</code>, <code>Mail.Send</code>, <code>Contacts.Read</code>, <code>User.Read</code>.</>,
              <>Copiez l'« ID d'application (client) » ci-dessous, ou en variable <code>VITE_MS_CLIENT_ID</code>.</>,
            ]} />
            <Field label="Microsoft Client ID" hint={envMs ? 'Déjà fourni par la variable d\u2019environnement — ce champ peut rester vide.' : ''}>
              <Input value={form.msClientId} onChange={(e) => setForm({ ...form, msClientId: e.target.value })} placeholder={envMs ? '(configuré via l\u2019environnement)' : 'xxxxxxxx-xxxx-…'} />
            </Field>
          </Tuto>

          <Tuto titre="Avancé · Clé IA personnelle (optionnelle)">
            <p className="text-[12px] text-ink-soft leading-relaxed">
              Si une clé est saisie ici, elle est utilisée à la place de l'IA partagée (utile pour isoler votre consommation). Elle est stockée avec les données de votre organisation : utilisez une clé dédiée avec un plafond de dépense.
            </p>
            <Field label="Clé API Anthropic" hint="console.anthropic.com → API keys">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={form.anthropicApiKey} onChange={(e) => setForm({ ...form, anthropicApiKey: e.target.value })} placeholder="sk-ant-…" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="Modèle IA">
              <Select value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })}>
                <option value="claude-sonnet-5-5">Claude Sonnet — recommandé (qualité/prix)</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku — le plus rapide et économique</option>
                <option value="claude-opus-5-5">Claude Opus — qualité maximale</option>
              </Select>
            </Field>
          </Tuto>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="brass">Enregistrer</Button>
            {saved && <span className="text-[12.5px] text-teal flex items-center gap-1"><Check size={14} /> Enregistré</span>}
          </div>
        </form>
      )}
    </Card>
  );
}
