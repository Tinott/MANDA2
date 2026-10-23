// Rapprochement investisseurs ↔ biens — déterministe, instantané, explicable.
// Sert au panneau « Investisseurs à cibler » d'un IM, à la fiche contact
// (« Biens à lui proposer ») et au Copilote (outil matcher_investisseurs).

import { estInvestisseur, normalizeContact } from './contactsSchema';

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Déduit la classe d'actif d'un bien à partir de son type libre.
export function classeDuBien(bien) {
  const t = norm(`${bien?.typeBien || ''} ${bien?.description || ''}`);
  if (/retail park|parc commercial/.test(t)) return 'Retail park';
  if (/bureau/.test(t)) return 'Bureaux';
  if (/logist|entrepot|plateforme|messagerie/.test(t)) return 'Logistique';
  if (/activit|atelier|industri/.test(t)) return 'Activité';
  if (/commerc|boutique|magasin|supermarch|enseigne|restaur/.test(t)) return 'Commerces';
  if (/hotel|hebergement/.test(t)) return 'Hôtellerie';
  if (/resid|appartement|logement|immeuble d.habitation/.test(t)) return 'Résidentiel';
  if (/terrain|foncier/.test(t)) return 'Terrain';
  if (/mixte/.test(t)) return 'Mixte';
  return '';
}

function zoneMatch(zones, adresse) {
  if (!zones?.length) return null; // critère non renseigné
  const a = norm(adresse);
  for (const z of zones) {
    const zz = norm(z);
    if (!zz) continue;
    if (zz === 'national' || zz === 'france' || /france entiere|toute la france|tout le territoire|partout/.test(zz)) return true;
    if (zz.length >= 3 && a.includes(zz)) return true;
    // Code postal / département : « 69 », « 33000 »
    const dep = zz.match(/^\d{2}$/);
    if (dep && new RegExp(`\\b${dep[0]}\\d{3}\\b`).test(a)) return true;
  }
  return false;
}

export function scoreContactPourBien(contactBrut, bien) {
  const c = normalizeContact(contactBrut);
  if (!estInvestisseur(c)) return { score: 0, raisons: [], exclu: true };
  const raisons = [];
  let score = 0;

  // 1. Classe d'actif (40)
  const classe = classeDuBien(bien);
  if (!c.classesActifs.length) { score += 20; raisons.push('Classe d’actif non précisée'); }
  else if (classe && (c.classesActifs.includes(classe) || c.classesActifs.includes('Mixte') ||
    (classe === 'Retail park' && c.classesActifs.includes('Commerces')) ||
    (classe === 'Activité' && c.classesActifs.includes('Logistique')))) { score += 40; raisons.push(`Cible : ${classe.toLowerCase()}`); }
  else if (!classe) { score += 15; raisons.push('Type de bien à préciser'); }
  else { raisons.push(`Ne cible pas : ${classe.toLowerCase()}`); }

  // 2. Zone (25)
  const zm = zoneMatch(c.zones, bien?.adresse);
  if (zm === null) { score += 12; raisons.push('Zone non précisée'); }
  else if (zm) { score += 25; raisons.push('Zone recherchée'); }
  else { raisons.push('Hors de ses zones'); }

  // 3. Ticket (25)
  const prix = Number(bien?.prix || bien?.prixVente) || 0;
  const min = Number(c.ticketMin) || 0, max = Number(c.ticketMax) || 0;
  if (!prix || (!min && !max)) { score += 12; raisons.push('Ticket non comparé'); }
  else if ((!min || prix >= min * 0.9) && (!max || prix <= max * 1.1)) { score += 25; raisons.push('Dans son ticket'); }
  else if ((!min || prix >= min * 0.6) && (!max || prix <= max * 1.5)) { score += 10; raisons.push('Ticket à la marge'); }
  else { raisons.push(prix < min ? 'Ticket trop petit pour lui' : 'Ticket trop gros pour lui'); }

  // 4. Rendement (10)
  const loyer = Number(bien?.loyerAnnuel) || 0;
  const cible = Number(c.rendementCible) || 0;
  if (loyer && prix && cible) {
    const rdt = (loyer / prix) * 100;
    if (rdt >= cible - 0.3) { score += 10; raisons.push(`Rendement ${rdt.toFixed(2).replace('.', ',')} % ≥ cible ${String(cible).replace('.', ',')} %`); }
    else { raisons.push(`Rendement ${rdt.toFixed(2).replace('.', ',')} % < cible ${String(cible).replace('.', ',')} %`); }
  } else { score += 5; }

  // Bonus relation active
  if (c.statutRelation === 'Client' || c.statutRelation === 'Actif') score += 3;
  if (c.statutRelation === 'Inactif') score -= 10;

  return { score: Math.max(0, Math.min(100, Math.round(score))), raisons, exclu: false };
}

// Investisseurs les plus pertinents pour un bien.
export function matcherInvestisseurs(contacts, bien, { limite = 12, minimum = 30 } = {}) {
  return (contacts || [])
    .map((c) => ({ contact: c, ...scoreContactPourBien(c, bien) }))
    .filter((r) => !r.exclu && r.score >= minimum)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

// Biens (mandats) les plus pertinents pour un contact.
export function matcherBiens(contact, mandats, { limite = 8, minimum = 30 } = {}) {
  return (mandats || [])
    .filter((m) => !m.statut || /cours|actif/i.test(m.statut))
    .map((m) => ({ mandat: m, ...scoreContactPourBien(contact, { typeBien: m.typeBien, description: m.description, adresse: m.adresse, prix: m.prixVente, loyerAnnuel: m.loyerAnnuel }) }))
    .filter((r) => !r.exclu && r.score >= minimum)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}
