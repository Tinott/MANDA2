import { supabase } from './supabase';

// Accès à la ligne de données de l'organisation (table org_data).
// La logique de synchronisation elle-même est dans syncEngine.js / syncMerge.js.

// Lecture. { ok:true, data, version } — data vaut {} pour une organisation
// neuve ; version = updated_at de la ligne, utilisée pour l'envoi conditionnel.
// { ok:false } si le serveur n'a pas répondu : dans ce cas RIEN n'est envoyé.
export async function pullOrgData(orgId) {
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    const { data, error } = await supabase.from('org_data').select('data, updated_at').eq('org_id', orgId).maybeSingle();
    if (error) return { ok: false, error: error.message || 'erreur' };
    if (!data) return { ok: false, error: 'ligne introuvable' };
    return { ok: true, data: data.data || {}, version: data.updated_at || null };
  } catch (e) {
    return { ok: false, error: e?.message || 'réseau' };
  }
}

// Lecture légère : seulement la version (quelques octets), pour savoir si
// quelqu'un d'autre a écrit, sans retélécharger les données.
export async function peekOrgVersion(orgId) {
  if (!supabase) return { ok: false };
  try {
    const { data, error } = await supabase.from('org_data').select('updated_at').eq('org_id', orgId).maybeSingle();
    if (error || !data) return { ok: false };
    return { ok: true, version: data.updated_at || null };
  } catch {
    return { ok: false };
  }
}

// Écriture conditionnelle : n'aboutit que si personne n'a écrit depuis la
// lecture (même updated_at). Sinon { conflict:true } → le moteur relit,
// refusionne et réessaie. `forcer` : envoi sans condition (repli technique).
export async function pushOrgData(orgId, data, version, forcer = false) {
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    const updated_at = new Date().toISOString();
    let q = supabase.from('org_data').update({ data, updated_at }).eq('org_id', orgId);
    if (!forcer) q = version ? q.eq('updated_at', version) : q.is('updated_at', null);
    const { data: rows, error } = await q.select('updated_at');
    if (error) return { ok: false, error: error.message || 'erreur' };
    if (!rows || rows.length === 0) return forcer ? { ok: false, error: 'écriture refusée' } : { ok: false, conflict: true };
    return { ok: true, version: rows[0].updated_at };
  } catch (e) {
    return { ok: false, error: e?.message || 'réseau' };
  }
}

// Historique des versions côté serveur (table org_data_history, alimentée
// par un trigger SQL — voir supabase/migrations/).
export async function listOrgHistory(orgId, limit = 30) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('org_data_history')
    .select('id, created_at, items_count')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function getOrgHistoryVersion(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('org_data_history').select('data').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data.data;
}
