import { useState } from 'react';
import { ArrowRight, Mail, Lock, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field, Input, Button } from '../components/ui';

export default function Login() {
  const { session, orgId, loadingOrg, signUp, signIn, error, createOrganization } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setSubmitting(false);
    if (res.ok && res.needsConfirmation) setNeedsConfirmation(true);
  }

  async function submitOrg(e) {
    e.preventDefault();
    if (!orgNameInput.trim()) return;
    setSubmitting(true);
    await createOrganization(orgNameInput.trim());
    setSubmitting(false);
  }

  // Étape "créer votre cabinet" — affichée une fois connecté, tant qu'aucune
  // organisation n'est encore rattachée à ce compte.
  if (session && !loadingOrg && !orgId) {
    return (
      <Shell>
        <div className="text-center mb-6">
          <Building2 size={26} className="mx-auto text-brass mb-3" />
          <h1 className="font-display text-[22px] text-white">Nommez votre cabinet</h1>
          <p className="text-white/50 text-[13px] mt-1.5">C'est l'espace où vos données seront rattachées.</p>
        </div>
        <form onSubmit={submitOrg} className="bg-surface rounded-2xl border border-line p-7 shadow-2xl space-y-4">
          <Field label="Nom du cabinet" required>
            <Input value={orgNameInput} onChange={(e) => setOrgNameInput(e.target.value)} placeholder="Ex. Cabinet Cobalt Immobilier" autoFocus />
          </Field>
          {error && <div className="text-[12.5px] text-rust">{error}</div>}
          <Button type="submit" variant="brass" className="w-full" disabled={submitting}>
            Créer mon espace <ArrowRight size={15} />
          </Button>
        </form>
      </Shell>
    );
  }

  if (needsConfirmation) {
    return (
      <Shell>
        <div className="bg-surface rounded-2xl border border-line p-7 shadow-2xl text-center">
          <CheckCircle2 size={30} className="mx-auto text-teal mb-3" />
          <div className="font-display text-[18px] text-ink">Vérifiez votre email</div>
          <p className="text-ink-soft text-[13px] mt-2">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus, puis revenez
            vous connecter ici.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => { setNeedsConfirmation(false); setMode('signin'); }}>
            Retour à la connexion
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex gap-1 mb-5 border border-white/15 rounded-lg p-1 bg-white/5 w-fit mx-auto">
        <button onClick={() => setMode('signin')} className={`px-4 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${mode === 'signin' ? 'bg-white text-ink' : 'text-white/60'}`}>
          Connexion
        </button>
        <button onClick={() => setMode('signup')} className={`px-4 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${mode === 'signup' ? 'bg-white text-ink' : 'text-white/60'}`}>
          Créer un compte
        </button>
      </div>

      <form onSubmit={submit} className="bg-surface rounded-2xl border border-line p-7 shadow-2xl space-y-4">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Mot de passe" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        {error && <div className="text-[12.5px] text-rust">{error}</div>}
        <Button type="submit" variant="brass" className="w-full" disabled={submitting}>
          {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'} <ArrowRight size={15} />
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brass/60 text-brass font-display text-xl mb-4">
            M
          </span>
          <h1 className="font-display text-[24px] text-white">Mandat</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

