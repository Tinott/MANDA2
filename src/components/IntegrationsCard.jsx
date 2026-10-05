import { useState } from 'react';
import { Bot, Check, Eye, EyeOff, ChevronDown, ChevronRight, ShieldCheck, ExternalLink, Mail as MailIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_MODEL, aiMode } from '../lib/ai';
import { Card, Field, Input, Select, Button, Badge } from './ui';

// Carte Intégrations — pensée côté utilisateur :
//   · IA : deux options équivalentes, au choix — « IA de l'application »
//     (rien à saisir) ou « Ma propre clé API » (compte Anthropic personnel) ;
//   · Messagerie : Gmail et Outlook, présentés exactement de la même façon —
//     on configure celui qu'on utilise, ou les deux ; ensuite chacun connecte
//     SON compte en un clic dans la Boîte mail.
// La partie technique (à faire une seule fois pour toute l'application) est
// repliée dans « Administrateur ».

const envGoogle = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const envMs = import.meta.env.VITE_MS_CLIENT_ID;
const envSupabase = import.meta.env.VITE_SUPABASE_URL;

function Tuto({ titre, etat, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line bg-paper-raised">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left">
        <span className="text-[12.5px] font-medium text-ink">{titre}</span>
        <span className="flex items-center gap-2 shrink-0">
          {etat}
          {open ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
        </span>
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

function ChoixIA({ actif, onClick, titre, description, badge }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 text-left rounded-xl border-2 px-4 py-3.5 transition-colors ${actif ? 'border-brass bg-brass-soft/30' : 'border-line hover:border-brass/40'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-2">
          <span className={`h-3.5 w-3.5 rounded-full border-2 ${actif ? 'border-brass bg-brass' : 'border-line'}`} />
          <span className="text-[13px] font-medium text-ink">{titre}</span>
        </span>
        {badge}
      </div>
      <div className="text-[11.5px] text-ink-faint leading-relaxed pl-[22px]">{description}</div>
    </button>
  );
}

export default function IntegrationsCard() {
  const { societe, setSociete } = useApp();
  const [form, setForm] = useState({
    aiMode: aiMode(societe),
    anthropicApiKey: societe.anthropicApiKey || '',
    aiModel: societe.aiModel || DEFAULT_MODEL,
    googleClientId: societe.googleClientId || '',
    msClientId: societe.msClientId || '',
  });
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const gmailOk = Boolean(envGoogle || form.googleClientId);
  const outlookOk = Boolean(envMs || form.msClientId);
  const partageeOk = Boolean(envSupabase);
  const perso = form.aiMode === 'personnelle';

  function save(e) {
    e.preventDefault();
    setSociete(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card className="mb-5">
      <form onSubmit={save}>
        {/* ============================ IA ============================ */}
        <div className="flex items-center gap-2 mb-1">
          <Bot size={16} className="text-brass" />
          <div className="font-display text-[15px] text-ink">Intelligence artificielle</div>
        </div>
        <p className="text-[12px] text-ink-faint mb-3">
          Copilote, briefing du jour, rédaction d'emails, extraction d'actes, textes d'IM. Choisissez comment l'IA est fournie :
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <ChoixIA
            actif={!perso}
            onClick={() => setForm({ ...form, aiMode: 'partagee' })}
            titre="IA de l'application"
            description="Rien à saisir : l'IA est fournie par l'application, pour tous les comptes."
            badge={<Badge tone={partageeOk ? 'teal' : 'rust'}>{partageeOk ? 'Disponible' : 'Non configurée'}</Badge>}
          />
          <ChoixIA
            actif={perso}
            onClick={() => setForm({ ...form, aiMode: 'personnelle' })}
            titre="Ma propre clé API"
            description="J'utilise mon compte Anthropic (console.anthropic.com) : ma consommation, ma facture."
            badge={form.anthropicApiKey ? <Badge tone="teal">Clé saisie</Badge> : null}
          />
        </div>
        {perso && (
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            <Field label="Clé API Anthropic" hint="console.anthropic.com → API keys — pensez au plafond de dépense">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={form.anthropicApiKey} onChange={(e) => setForm({ ...form, anthropicApiKey: e.target.value })} placeholder="sk-ant-…" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="Modèle IA">
              <Select value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })}>
                <option value="claude-sonnet-5-5">Claude Sonnet — équilibre qualité/prix</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku — le plus rapide et économique</option>
                <option value="claude-opus-5-5">Claude Opus — qualité maximale</option>
              </Select>
            </Field>
          </div>
        )}

        {/* ========================= Messagerie ========================= */}
        <div className="flex items-center gap-2 mt-6 mb-1">
          <MailIcon size={16} className="text-brass" />
          <div className="font-display text-[15px] text-ink">Messagerie</div>
        </div>
        <p className="text-[12px] text-ink-faint mb-3">
          Gmail et Outlook fonctionnent exactement de la même façon : une fois le service configuré pour l'application (ci-dessous, une seule fois), chaque utilisateur ouvre la <span className="font-medium text-ink">Boîte mail</span>, clique sur « Connecter », et choisit son propre compte dans la fenêtre officielle. Ses identifiants restent chez Google/Microsoft.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-line px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink">Gmail</span>
            <Badge tone={gmailOk ? 'teal' : 'rust'}>{gmailOk ? 'Prêt' : 'À configurer'}</Badge>
          </div>
          <div className="rounded-xl border border-line px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink">Outlook / Microsoft 365</span>
            <Badge tone={outlookOk ? 'teal' : 'rust'}>{outlookOk ? 'Prêt' : 'À configurer'}</Badge>
          </div>
        </div>

        {/* ======================= Administrateur ======================= */}
        <button type="button" onClick={() => setAdminOpen((o) => !o)} className="mt-6 w-full flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 hover:bg-paper-raised transition-colors">
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink"><ShieldCheck size={14} className="text-brass" /> Administrateur — configurer l'application (une seule fois)</span>
          {adminOpen ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
        </button>

        {adminOpen && (
          <div className="mt-4 space-y-3">
            <Tuto titre="IA de l'application" etat={<Badge tone={partageeOk ? 'teal' : 'rust'}>{partageeOk ? 'Disponible' : 'Non configurée'}</Badge>}>
              <Etapes items={[
                <>Créez un compte sur <Lien href="https://console.anthropic.com">console.anthropic.com</Lien> (l'offre API d'Anthropic, indépendante d'un abonnement Claude).</>,
                <>Dans <em>Billing</em> : crédits prépayés (5–10 € suffisent pour commencer) et <strong>plafond de dépense</strong> — au pire l'IA s'arrête, jamais de mauvaise surprise.</>,
                <>Dans <em>API keys</em> : créez une clé (sk-ant-…).</>,
                <>Dashboard Supabase → <em>Edge Functions → Deploy new function</em> → nom <code>claude-proxy</code> → collez le fichier <code>supabase/functions/claude-proxy/index.ts</code> du projet ; puis <em>Edge Functions → Secrets</em> → <code>ANTHROPIC_API_KEY</code> = votre clé.</>,
                <>Terminé : l'option « IA de l'application » fonctionne pour tous les comptes connectés ; la clé ne quitte jamais le serveur. Seuls les utilisateurs authentifiés y ont accès, modèles et volumes verrouillés.</>,
              ]} />
            </Tuto>

            <Tuto titre="Gmail — identifier l'application auprès de Google" etat={<Badge tone={gmailOk ? 'teal' : 'rust'}>{gmailOk ? 'Prêt' : 'À configurer'}</Badge>}>
              <Etapes items={[
                <>Sur <Lien href="https://console.cloud.google.com">console.cloud.google.com</Lien> : créez un projet (ex. « Mandat »).</>,
                <><em>API et services → Bibliothèque</em> : activez <strong>Gmail API</strong> et <strong>People API</strong>.</>,
                <><em>Écran de consentement OAuth</em> : type <em>Externe</em>. Tant que l'appli est « En test », ajoutez dans <em>Utilisateurs test</em> les adresses Gmail autorisées (la vôtre et celles de vos utilisateurs). Pour ouvrir à n'importe quel Gmail : passer en « Production » (vérification Google, à prévoir avant commercialisation).</>,
                <><em>Identifiants → Créer des identifiants → ID client OAuth</em> : type <strong>Application Web</strong> ; <em>Origines JavaScript autorisées</em> : <code>http://localhost:5173</code> et l'URL de production de l'appli.</>,
                <>Collez l'ID client ci-dessous et Enregistrer (ou variable d'environnement <code>VITE_GOOGLE_CLIENT_ID</code> chez l'hébergeur).</>,
              ]} />
              <Field label="Google Client ID" hint={envGoogle ? "Déjà fourni par l'environnement — ce champ peut rester vide." : 'xxxxx.apps.googleusercontent.com'}>
                <Input value={form.googleClientId} onChange={(e) => setForm({ ...form, googleClientId: e.target.value })} placeholder={envGoogle ? "(configuré via l'environnement)" : 'xxxxx.apps.googleusercontent.com'} />
              </Field>
            </Tuto>

            <Tuto titre="Outlook / Microsoft 365 — identifier l'application auprès de Microsoft" etat={<Badge tone={outlookOk ? 'teal' : 'rust'}>{outlookOk ? 'Prêt' : 'À configurer'}</Badge>}>
              <Etapes items={[
                <>Sur <Lien href="https://portal.azure.com">portal.azure.com</Lien> : <em>Microsoft Entra ID → Inscriptions d'applications → Nouvelle inscription</em>.</>,
                <>Types de comptes : <em>annuaire organisationnel + comptes Microsoft personnels</em>. Plateforme : <strong>Application monopage (SPA)</strong> ; URI de redirection : <code>http://localhost:5173</code> puis l'URL de production.</>,
                <><em>API autorisées</em> → Microsoft Graph (déléguées) : <code>Mail.Read</code>, <code>Mail.Send</code>, <code>Contacts.Read</code>, <code>User.Read</code>.</>,
                <>Collez l'« ID d'application (client) » ci-dessous et Enregistrer (ou variable <code>VITE_MS_CLIENT_ID</code>).</>,
              ]} />
              <Field label="Microsoft Client ID" hint={envMs ? "Déjà fourni par l'environnement — ce champ peut rester vide." : ''}>
                <Input value={form.msClientId} onChange={(e) => setForm({ ...form, msClientId: e.target.value })} placeholder={envMs ? "(configuré via l'environnement)" : 'xxxxxxxx-xxxx-…'} />
              </Field>
            </Tuto>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5">
          <Button type="submit" variant="brass">Enregistrer</Button>
          {saved && <span className="text-[12.5px] text-teal flex items-center gap-1"><Check size={14} /> Enregistré</span>}
        </div>
      </form>
    </Card>
  );
}
