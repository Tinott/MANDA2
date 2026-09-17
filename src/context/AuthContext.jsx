
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  // session === undefined : encore en train de vérifier. null : pas connecté.
  const [session, setSession] = useState(undefined);
  const [orgId, setOrgId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [error, setError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Déclenché quand la personne arrive via le lien reçu par email pour
      // réinitialiser son mot de passe — on l'amène directement à l'écran
      // "nouveau mot de passe", peu importe où elle en était avant.
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setOrgId(null); setOrgName(''); return; }
    setLoadingOrg(true);
    supabase
      .from('memberships')
      .select('org_id, organizations(name)')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setOrgId(data.org_id); setOrgName(data.organizations?.name || ''); }
        setLoadingOrg(false);
      });
  }, [session]);

  async function signUp(email, password) {
    setError('');
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(err.message); return { ok: false }; }
    return { ok: true, needsConfirmation: !data.session };
  }

  async function signIn(email, password) {
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); return { ok: false }; }
    return { ok: true };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Envoie un email avec un lien de réinitialisation — c'est le bon chemin
  // quand on a oublié son mot de passe, jamais recréer un compte.
  async function requestPasswordReset(email) {
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (err) { setError(err.message); return { ok: false }; }
    return { ok: true };
  }

  // Appelé depuis l'écran affiché après avoir cliqué le lien reçu par
  // email — fixe le nouveau mot de passe puis sort du mode récupération.
  async function updatePassword(newPassword) {
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) { setError(err.message); return { ok: false }; }
    setRecoveryMode(false);
    return { ok: true };
  }

  // Appelé une seule fois, quand un compte tout juste connecté n'a encore
  // aucune organisation — crée le cabinet et l'y rattache comme gérant.
  async function createOrganization(name) {
    if (!session) return { ok: false };
    setError('');
    const { data: org, error: orgErr } = await supabase.from('organizations').insert({ name }).select().single();
    if (orgErr) { setError(orgErr.message); return { ok: false }; }
    const { error: memErr } = await supabase.from('memberships').insert({ user_id: session.user.id, org_id: org.id, role: 'gerant' });
    if (memErr) { setError(memErr.message); return { ok: false }; }
    const { error: dataErr } = await supabase.from('org_data').insert({ org_id: org.id, data: {} });
    if (dataErr) { setError(dataErr.message); return { ok: false }; }
    setOrgId(org.id);
    setOrgName(org.name);
    return { ok: true };
  }

  return (
    <AuthCtx.Provider value={{
      session, orgId, orgName, loadingOrg, error, recoveryMode,
      signUp, signIn, signOut, createOrganization, requestPasswordReset, updatePassword,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
