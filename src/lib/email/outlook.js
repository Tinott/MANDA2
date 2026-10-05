// Connecteur Outlook / Microsoft 365 — MSAL Browser + Microsoft Graph.
// Prérequis : `npm i @azure/msal-browser` et une App Registration Azure
// (type SPA, redirect URI = URL de l'appli, permissions déléguées
// Mail.Read, Mail.Send, Contacts.Read). Client ID saisi dans Paramètres.

const SCOPES = ['Mail.Read', 'Mail.Send', 'Contacts.Read', 'User.Read'];
let msalApp = null;
let account = null;

async function getMsal(clientId) {
  if (msalApp) return msalApp;
  const { PublicClientApplication } = await import('@azure/msal-browser');
  msalApp = new PublicClientApplication({
    auth: { clientId, authority: 'https://login.microsoftonline.com/common', redirectUri: window.location.origin },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await msalApp.initialize();
  account = msalApp.getAllAccounts()[0] || null;
  return msalApp;
}

export function outlookConnected() { return Boolean(account); }
export function outlookDisconnect() { account = null; sessionStorage.clear(); }

export async function connectOutlook(clientId) {
  const id = clientId || import.meta.env.VITE_MS_CLIENT_ID;
  if (!id) throw new Error("Outlook n'est pas encore configuré pour cette application : l'administrateur doit créer un Client ID Azure (voir Paramètres > Intégrations > Administrateur).");
  const app = await getMsal(id);
  const res = await app.loginPopup({ scopes: SCOPES });
  account = res.account;
  return account;
}

async function token() {
  const res = await msalApp.acquireTokenSilent({ scopes: SCOPES, account })
    .catch(() => msalApp.acquireTokenPopup({ scopes: SCOPES }));
  return res.accessToken;
}

async function graph(path, options = {}) {
  const t = await token();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}`);
  return res.status === 202 ? null : res.json();
}

export async function outlookList({ max = 25 } = {}) {
  const data = await graph(`/me/mailFolders/inbox/messages?$top=${max}&$select=id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead&$orderby=receivedDateTime desc`);
  return (data.value || []).map((m) => {
    const div = document.createElement('div');
    div.innerHTML = m.body?.content || '';
    return {
      id: m.id,
      threadId: m.conversationId,
      provider: 'outlook',
      from: `${m.from?.emailAddress?.name || ''} <${m.from?.emailAddress?.address || ''}>`,
      to: (m.toRecipients || []).map((r) => r.emailAddress?.address).join(', '),
      subject: m.subject || '',
      date: m.receivedDateTime,
      snippet: m.bodyPreview,
      body: (m.body?.contentType === 'html' ? div.textContent : m.body?.content || '').slice(0, 20000),
      unread: !m.isRead,
    };
  });
}

export async function outlookSendReply({ messageId, body }) {
  return graph(`/me/messages/${messageId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ comment: body }),
  });
}

// Envoi d'un NOUVEAU message (composer) — destinataires multiples acceptés.
export async function outlookSendNew({ to, subject, body }) {
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  return graph('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: subject || '',
        body: { contentType: 'Text', content: body },
        toRecipients: list.map((a) => ({ emailAddress: { address: a } })),
      },
    }),
  });
}

export async function outlookImportContacts() {
  const out = [];
  let url = '/me/contacts?$top=200&$select=givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,businessAddress';
  while (url) {
    const data = await graph(url.replace('https://graph.microsoft.com/v1.0', ''));
    (data.value || []).forEach((c) => {
      out.push({
        nom: c.surname || '',
        prenom: c.givenName || '',
        email: c.emailAddresses?.[0]?.address || '',
        telephone: c.mobilePhone || c.businessPhones?.[0] || '',
        societe: c.companyName || '',
        adresse: [c.businessAddress?.street, c.businessAddress?.postalCode, c.businessAddress?.city].filter(Boolean).join(', '),
        categorie: '',
        notes: 'Importé depuis Outlook',
      });
    });
    url = data['@odata.nextLink'] || null;
  }
  return out.filter((c) => c.email || c.nom);
}
