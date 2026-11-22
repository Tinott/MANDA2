// Faux client Supabase pour les tests de bout en bout : authentification
// simulée, org_data servi par le serveur de test local (/api).
const params = new URLSearchParams(window.location.search);
const ORG = params.get('org') || 'org-test';
const api = async (path, body) => {
  const res = await fetch(`/api${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
function query(table) {
  const q = { table, filters: {}, isNull: {}, cols: '*', op: 'select', payload: null };
  const run = async () => {
    try {
      if (table === 'memberships') return { data: { org_id: ORG, organizations: { name: 'Cabinet Test' } }, error: null };
      if (table === 'org_data_history') return { data: [], error: null };
      if (table === 'org_data') {
        const org = q.filters.org_id;
        if (q.op === 'select') {
          const row = await api(`/row?org=${org}&cols=${encodeURIComponent(q.cols)}`);
          if (row.fail) return { data: null, error: { message: 'réseau' } };
          return { data: row.row, error: null };
        }
        const r = await api('/update', { org, data: q.payload.data, updated_at: q.payload.updated_at, expect: 'updated_at' in q.filters ? q.filters.updated_at : ('updated_at' in q.isNull ? null : undefined) });
        if (r.fail) return { data: null, error: { message: 'réseau' } };
        return { data: r.rows, error: null };
      }
      return { data: null, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  };
  const b = {
    select(cols) { if (q.op === 'select') q.cols = cols || '*'; return b; },
    update(payload) { q.op = 'update'; q.payload = payload; return b; },
    insert() { return Promise.resolve({ data: null, error: null }); },
    eq(k, v) { q.filters[k] = v; return b; },
    is(k) { q.isNull[k] = true; return b; },
    order() { return b; }, limit() { return b; },
    maybeSingle() { return run(); },
    then(res, rej) { return run().then(res, rej); },
  };
  return b;
}
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'test@cabinet.fr' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({}),
  },
  from: (t) => query(t),
  functions: { invoke: async (_n, { body } = {}) => {
    (window.__aiCalls = window.__aiCalls || []).push(body);
    if (body?.tools && window.__aiScript?.length) return { data: window.__aiScript.shift(), error: null };
    return { data: { content: [{ type: 'text', text: '{"resume":"Test","actions":[]}' }], stop_reason: 'end_turn' }, error: null };
  } },
};
