// Lecture de mails exportés en fichiers — .eml (un message) et .mbox (une
// boîte entière, export Thunderbird / Gmail / Roundcube). Décodage MIME
// complet côté navigateur : en-têtes encodés (=?UTF-8?B?…?=), parties
// multipart, quoted-printable, base64, jeux de caractères, HTML → texte.

function decodeBytes(bytes, charset) {
  try { return new TextDecoder((charset || 'utf-8').toLowerCase().replace('iso8859', 'iso-8859')).decode(bytes); }
  catch { return new TextDecoder('utf-8').decode(bytes); }
}

function qpDecode(str, charset) {
  const bin = str.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return decodeBytes(Uint8Array.from(bin, (c) => c.charCodeAt(0) & 0xff), charset);
}
function b64Decode(str, charset) {
  try {
    const bin = atob(str.replace(/[^A-Za-z0-9+/=]/g, ''));
    return decodeBytes(Uint8Array.from(bin, (c) => c.charCodeAt(0)), charset);
  } catch { return ''; }
}

// En-tête encodé RFC 2047 : =?charset?B|Q?texte?=
export function decodeHeader(v) {
  return String(v || '')
    .replace(/\r?\n[ \t]+/g, ' ')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) =>
      enc.toUpperCase() === 'B' ? b64Decode(txt, cs) : qpDecode(txt.replace(/_/g, ' '), cs))
    .trim();
}

function parseHeaders(raw) {
  const headers = {};
  raw.split(/\r?\n(?![ \t])/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).replace(/\r?\n[ \t]+/g, ' ').trim();
  });
  return headers;
}

function param(headerValue, name) {
  const m = new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, 'i').exec(headerValue || '');
  return m ? m[1].trim() : '';
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Retourne { text, html } à partir d'une entité MIME (récursif sur multipart).
function extractBody(headers, body) {
  const ctype = headers['content-type'] || 'text/plain';
  const enc = (headers['content-transfer-encoding'] || '').toLowerCase();
  const charset = param(ctype, 'charset') || 'utf-8';
  if (/^multipart\//i.test(ctype)) {
    const boundary = param(ctype, 'boundary');
    if (!boundary) return { text: '', html: '' };
    const parts = body.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\r?\\n?`));
    let text = '', html = '';
    for (const p of parts.slice(1)) {
      if (!p.trim() || p.trim() === '--') continue;
      const sep = p.search(/\r?\n\r?\n/);
      if (sep === -1) continue;
      const h = parseHeaders(p.slice(0, sep));
      if (/attachment/i.test(h['content-disposition'] || '')) continue;
      const r = extractBody(h, p.slice(sep).replace(/^\r?\n\r?\n/, ''));
      if (r.text && !text) text = r.text;
      if (r.html && !html) html = r.html;
    }
    return { text, html };
  }
  let decoded = body;
  if (enc === 'quoted-printable') decoded = qpDecode(body, charset);
  else if (enc === 'base64') decoded = b64Decode(body, charset);
  if (/^text\/html/i.test(ctype)) return { text: '', html: decoded };
  if (/^text\//i.test(ctype)) return { text: decoded, html: '' };
  return { text: '', html: '' };
}

export function parseEml(raw, nomFichier = '') {
  const src = String(raw || '').replace(/^﻿/, '');
  const sep = src.search(/\r?\n\r?\n/);
  const headers = parseHeaders(sep === -1 ? src : src.slice(0, sep));
  const { text, html } = extractBody(headers, sep === -1 ? '' : src.slice(sep).replace(/^\r?\n\r?\n/, ''));
  const body = (text || htmlToText(html) || '').trim();
  const dateRaw = headers['date'] || '';
  const d = dateRaw ? new Date(dateRaw) : null;
  const from = decodeHeader(headers['from']);
  return {
    id: headers['message-id'] || `${nomFichier}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'import',
    from,
    to: decodeHeader(headers['to']),
    subject: decodeHeader(headers['subject']),
    date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString(),
    snippet: body.slice(0, 140).replace(/\s+/g, ' '),
    body: body.slice(0, 20000),
    unread: false,
    messageIdHeader: headers['message-id'] || '',
    fichier: nomFichier,
  };
}

// Un .mbox = messages séparés par des lignes « From … » en début de ligne.
export function parseMbox(raw, nomFichier = '') {
  const src = String(raw || '').replace(/^﻿/, '');
  const blocs = src.split(/^From .*\r?\n/m).filter((b) => b.trim());
  return blocs.map((b, i) => parseEml(b.replace(/^>From /gm, 'From '), `${nomFichier}#${i + 1}`)).filter((m) => m.subject || m.body);
}

export async function parseMailFile(file) {
  const text = await file.text();
  const n = file.name.toLowerCase();
  if (n.endsWith('.mbox') || /^From .*\r?\n/.test(text.slice(0, 200)) && text.split(/^From /m).length > 2) return parseMbox(text, file.name);
  return [parseEml(text, file.name)];
}
