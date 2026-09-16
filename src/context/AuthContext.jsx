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

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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

  // Appelé une seule fois, quand un compte tout juste connecté n'a encore
  // aucune organisation — crée le cabinet et l'y rattache comme gérant.
  async function createOrganization(name) {
    if (!session) return { ok: false };
    setError('');
    const { data: org, error: orgErr } = await supabase.from('organizations').insert({ name }).select().single();
    if (orgErr) { setError(orgErr.message); return { ok: false }; }
    const { error: memErr } = await supabase.from('memberships').insert({ user_id: session.user.id, org_id: org.id, role: 'gerant' });
    if (memErr) { setError(memErr.message); return { ok: false }; }
    await supabase.from('org_data').insert({ org_id: org.id, data: {} });
    setOrgId(org.id);
    setOrgName(org.name);
    return { ok: true };
  }

  return (
    <AuthCtx.Provider value={{ session, orgId, orgName, loadingOrg, error, signUp, signIn, signOut, createOrganization }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
