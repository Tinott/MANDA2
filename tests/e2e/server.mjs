import http from 'http'; import fs from 'fs'; import path from 'path';
const DIST = '/tmp/e2e/dist';
const orgs = new Map(); // org → { data, updated_at, writes, fail }
const get = (o) => { if (!orgs.has(o)) orgs.set(o, { data: {}, updated_at: null, writes: 0, fail: false, reads: 0 }); return orgs.get(o); };
const same = (a, b) => (a === null || b === null) ? a === b : new Date(a).getTime() === new Date(b).getTime();
const body = (req) => new Promise((r) => { let s = ''; req.on('data', (c) => s += c); req.on('end', () => r(s ? JSON.parse(s) : {})); });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/api/row') { const o = get(u.searchParams.get('org')); if (o.fail) return json({ fail: true }); const cols = u.searchParams.get('cols'); if (cols.includes('data')) o.reads++; return json({ row: cols.includes('data') ? { data: o.data, updated_at: o.updated_at } : { updated_at: o.updated_at } }); }
  if (u.pathname === '/api/update') { const b = await body(req); const o = get(b.org); if (o.fail) return json({ fail: true }); if (b.expect !== undefined && !same(b.expect, o.updated_at)) return json({ rows: [] }); o.data = b.data; o.updated_at = b.updated_at; o.writes++; return json({ rows: [{ updated_at: o.updated_at }] }); }
  if (u.pathname === '/api/admin') { const b = await body(req); const o = get(b.org); if ('data' in b) { o.data = b.data; o.updated_at = b.updated_at ?? new Date().toISOString(); } if ('fail' in b) o.fail = b.fail; if (b.reset) { o.writes = 0; o.reads = 0; } return json({ data: o.data, updated_at: o.updated_at, writes: o.writes, reads: o.reads }); }
  let f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(f)) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(4599, () => console.log('serveur de test sur 4599'));
