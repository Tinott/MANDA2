// Export des rappels au format calendrier (.ics) — s'ouvre dans Outlook,
// Google Agenda, Apple Calendrier. Aucun compte à connecter.

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
const compact = (d) => String(d || '').replace(/-/g, '');

function lendemain(date) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function plusUneHeure(date, heure) {
  const d = new Date(`${date}T${heure}:00`);
  d.setHours(d.getHours() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function buildIcs(taches, nomCalendrier = 'Mandat') {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mandat//Rappels//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(nomCalendrier)}`];
  (taches || []).filter((t) => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '')).forEach((t) => {
    const heure = /^\d{2}:\d{2}$/.test(t.heure || '') ? t.heure : null;
    lignes.push('BEGIN:VEVENT', `UID:${t.id}@mandat`, `DTSTAMP:${now}`);
    if (heure) lignes.push(`DTSTART:${compact(t.date)}T${heure.replace(':', '')}00`, `DTEND:${plusUneHeure(t.date, heure)}`);
    else lignes.push(`DTSTART;VALUE=DATE:${compact(t.date)}`, `DTEND;VALUE=DATE:${lendemain(t.date)}`);
    lignes.push(`SUMMARY:${esc(t.titre)}`);
    const desc = [t.contactNom ? `Contact : ${t.contactNom}` : '', t.note || ''].filter(Boolean).join('\n');
    if (desc) lignes.push(`DESCRIPTION:${esc(desc)}`);
    lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(t.titre)}`, `TRIGGER:${heure ? '-PT30M' : 'PT9H'}`, 'END:VALARM', 'END:VEVENT');
  });
  lignes.push('END:VCALENDAR');
  return lignes.join('\r\n');
}

export function downloadIcs(taches, fichier = 'rappels.ics') {
  const blob = new Blob([buildIcs(taches)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
