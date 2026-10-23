import { supabase } from './supabase';

export async function pullOrgData(orgId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('org_data').select('data').eq('org_id', orgId).maybeSingle();
  if (error || !data) return null;
  return data.data;
}

let pending = null;
export function scheduleOrgPush(orgId, buildData, delayMs = 2000) {
  if (!supabase) return;
  clearTimeout(pending);
  pending = setTimeout(async () => {
    await supabase
      .from('org_data')
      .update({ data: buildData(), updated_at: new Date().toISOString() })
      .eq('org_id', orgId);
  }, delayMs);
}
