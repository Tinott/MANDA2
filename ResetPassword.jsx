import { useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field, Input, Button } from '../components/ui';

export default function ResetPassword() {
  const { error, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setMismatch('Les deux mots de passe ne correspondent pas.'); return; }
    setMismatch('');
    setSubmitting(true);
    const res = await updatePassword(password);
    setSubmitting(false);
    if (res.ok) setDone(true);
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brass/60 text-brass font-display text-xl mb-4">
            M
          </span>
          <h1 className="font-display text-[24px] text-white">Mandat</h1>
        </div>

        {done ? (
          <div className="bg-surface rounded-2xl border border-line p-7 shadow-2xl text-center">
            <CheckCircle2 size={30} className="mx-auto text-teal mb-3" />
            <div className="font-display text-[18px] text-ink">Mot de passe modifié</div>
            <p className="text-ink-soft text-[13px] mt-2">Vous pouvez continuer normalement.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <KeyRound size={24} className="mx-auto text-brass mb-3" />
              <h2 className="font-display text-[19px] text-white">Nouveau mot de passe</h2>
            </div>
            <form onSubmit={submit} className="bg-surface rounded-2xl border border-line p-7 shadow-2xl space-y-4">
              <Field label="Nouveau mot de passe" required>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />
              </Field>
              <Field label="Confirmer le mot de passe" required>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
              </Field>
              {(mismatch || error) && <div className="text-[12.5px] text-rust">{mismatch || error}</div>}
              <Button type="submit" variant="brass" className="w-full" disabled={submitting}>
                Valider <ArrowRight size={15} />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
