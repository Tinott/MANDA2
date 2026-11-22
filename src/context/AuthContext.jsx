
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
  const [orgError, setOrgError] = useState(false);
  const [tentative, setTentative] = useState(0);

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

  // Recherche du cabinet de l'utilisateur. Deux précautions :
  //  · on ne relance la recherche que si l'UTILISATEUR change (pas à chaque
  //    renouvellement silencieux de la session, qui rechargeait toute
  //    l'application et fermait les fenêtres de saisie en cours) ;
  //  · une erreur réseau n'est jamais confondue avec « aucun cabinet » —
  //    sinon l'écran « Créer votre cabinet » s'afficherait à quelqu'un qui en
  //    a déjà un, au risque d'en créer un second, vide.
  const userId = session?.user?.id || null;
  useEffect(() => {
    if (!userId) { setOrgId(null); setOrgName(''); setOrgError(false); return undefined; }
    let annule = false;
    setLoadingOrg(true); setOrgError(false);
    (async () => {
      for (let essai = 0; essai < 4 && !annule; essai += 1) {
        let res = null;
        try {
          res = await supabase.from('memberships').select('org_id, organizations(name)').eq('user_id', userId).limit(1).maybeSingle();
        } catch { res = { error: true }; }
        if (annule) return;
        if (!res?.error) {
          if (res.data) { setOrgId(res.data.org_id); setOrgName(res.data.organizations?.name || ''); }
          else { setOrgId(null); setOrgName(''); }
          setLoadingOrg(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 700 * (essai + 1)));
      }
      if (!annule) { setOrgError(true); setLoadingOrg(false); }
    })();
    return () => { annule = true; };
  }, [userId, tentative]);

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
      session, orgId, orgName, loadingOrg, error, recoveryMode, orgError, retryOrg: () => setTentative((n) => n + 1),
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
