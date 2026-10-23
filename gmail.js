// Connecteur Gmail — 100 % côté navigateur via Google Identity Services.
// Le Client ID identifie L'APPLICATION auprès de Google (pas l'utilisateur) :
// il est configuré UNE FOIS par l'administrateur — variable d'environnement
// VITE_GOOGLE_CLIENT_ID, ou à défaut Paramètres > Intégrations. L'utilisateur
// final, lui, clique simplement sur « Connecter Gmail » et choisit son compte
// dans la fenêtre Google officielle. Voir INSTRUCTIONS.md pour créer le
// Client ID (Google Cloud Console, APIs Gmail + People, origine = URL de
// l'appli).

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

let tokenClient = null;
let accessToken = sessionStorage.getItem('gmail_token') || null;

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Impossible de charger Google Identity Services.'));
    document.head.appendChild(s);
  });
}

export function gmailConnected() { return Boolean(accessToken); }
export function gmailDisconnect() { accessToken = null; sessionStorage.removeItem('gmail_token'); }

export async function connectGmail(clientId) {
  const id = clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error("Gmail n'est pas encore configuré pour cette application : l'administrateur doit créer un Google Client ID (voir Paramètres > Intégrations > Administrateur).");
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        sessionStorage.setItem('gmail_token', accessToken);
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function gfetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
  if (res.status === 401) { gmailDisconnect(); throw new Error('Session Gmail expirée — reconnectez-vous.'); }
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json();
}

function decodeB64(data) {
  try { return decodeURIComponent(escape(atob((data || '').replace(/-/g, '+').replace(/_/g, '/')))); } catch { return ''; }
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeB64(payload.body.data);
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const div = document.createElement('div');
    div.innerHTML = decodeB64(payload.body.data);
    return div.textContent || '';
  }
  for (const part of payload.parts || []) {
    const t = extractBody(part);
    if (t) return t;
  }
  return '';
}

function header(msg, name) {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export async function gmailList({ query = 'in:inbox', max = 25 } = {}) {
  const list = await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(query)}`);
  const ids = list.messages || [];
  const msgs = await Promise.all(ids.map((m) => gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`)));
  return msgs.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    provider: 'gmail',
    from: header(m, 'From'),
    to: header(m, 'To'),
    subject: header(m, 'Subject'),
    date: new Date(Number(m.internalDate)).toISOString(),
    snippet: m.snippet,
    body: extractBody(m.payload).slice(0, 20000),
    unread: (m.labelIds || []).includes('UNREAD'),
    messageIdHeader: header(m, 'Message-ID'),
  }));
}

export async function gmailSendReply({ to, subject, body, threadId, inReplyTo }) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    inReplyTo ? `References: ${inReplyTo}` : null,
    'Content-Type: text/plain; charset=UTF-8',
  ].filter(Boolean).join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(`${headers}\r\n\r\n${body}`)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return gfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, threadId }),
  });
}

// Envoi d'un NOUVEAU message (composer) — destinataires multiples acceptés.
export async function gmailSendNew({ to, subject, body }) {
  const headers = [
    `To: ${Array.isArray(to) ? to.join(', ') : to}`,
    `Subject: ${subject || ''}`,
    'Content-Type: text/plain; charset=UTF-8',
  ].join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(`${headers}\r\n\r\n${body}`)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return gfetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
}

// Import des contacts Google → format contacts de l'appli.
export async function gmailImportContacts() {
  let pageToken = '';
  const out = [];
  do {
    const data = await gfetch(`https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,addresses&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`);
    (data.connections || []).forEach((p) => {
      out.push({
        nom: p.names?.[0]?.familyName || p.names?.[0]?.displayName || '',
        prenom: p.names?.[0]?.givenName || '',
        email: p.emailAddresses?.[0]?.value || '',
        telephone: p.phoneNumbers?.[0]?.value || '',
        societe: p.organizations?.[0]?.name || '',
        adresse: p.addresses?.[0]?.formattedValue || '',
        categorie: '',
        notes: 'Importé depuis Gmail',
      });
    });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out.filter((c) => c.email || c.nom);
}
