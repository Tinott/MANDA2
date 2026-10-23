import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, Search, Pencil, Trash2, Mail, Phone, MapPin, UploadCloud, Loader2, AlertCircle,
  CheckCircle2, ChevronDown, ChevronRight, X, Link2, Globe, Briefcase, Target, History, Sparkles,
  CalendarClock, Building2, ArrowRight, MessageSquarePlus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatEUR, formatDate } from '../lib/calc';
import { usePersistedState } from '../hooks/useNavMemory';
import { uid } from '../lib/storage';
import {
  CONTACT_EMPTY, CLASSES_ACTIFS, VEHICULES, STRATEGIES, STATUTS_RELATION, TYPES_INTERACTION,
  normalizeContact, contactLabel, dernierContact, estInvestisseur,
} from '../lib/contactsSchema';
import { matcherBiens } from '../lib/matching';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState, BulkDeleteButton } from '../components/ui';

const TONES = ['brass', 'teal', 'rust', 'default'];

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function toneFor(categorie) {
  if (!categorie) return 'default';
  let h = 0;
  for (let i = 0; i < categorie.length; i += 1) h = (h * 31 + categorie.charCodeAt(i)) % 997;
  return TONES[h % TONES.length];
}
function today() { return new Date().toISOString().slice(0, 10); }
function relanceTone(d) {
  if (!d) return null;
  const diff = Math.round((new Date(d) - new Date(today())) / 86400000);
  if (diff < 0) return { tone: 'rust', label: `Relance en retard (${-diff} j)` };
  if (diff <= 7) return { tone: 'brass', label: diff === 0 ? 'Relance aujourd’hui' : `Relance J-${diff}` };
  return { tone: 'default', label: `Relance le ${formatDate(d)}` };
}
function ticketLabel(c) {
  const min = Number(c.ticketMin) || 0, max = Number(c.ticketMax) || 0;
  if (!min && !max) return '';
  if (min && max) return `${formatEUR(min)} – ${formatEUR(max)}`;
  return min ? `≥ ${formatEUR(min)}` : `≤ ${formatEUR(max)}`;
}

// Normalise les contacts importés (champs listes saisis en texte).
function normalizeImported(c) {
  const split = (v) => (Array.isArray(v) ? v : String(v || '').split(/[;,/]/).map((x) => x.trim()).filter(Boolean));
  const classes = split(c.classesActifs).map((x) => CLASSES_ACTIFS.find((k) => normalize(k) === normalize(x)) || x);
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : ''; };
  const money = (v) => { const n = num(v); if (n === '') return ''; return /k€|k\b/i.test(String(v)) ? n * 1000 : /m€|m\b/i.test(String(v)) ? n * 1e6 : n; };
  return normalizeContact({ ...c, classesActifs: classes, zones: split(c.zones), ticketMin: money(c.ticketMin), ticketMax: money(c.ticketMax), rendementCible: num(c.rendementCible), statutRelation: c.statutRelation || 'Prospect' });
}

export default function Contacts() {
  const { contacts, removeContact, addContactsBulk, mandats } = useApp();
  const navigate = useNavigate();
  const [ui, setUi] = usePersistedState('contacts.ui', { query: '', categorie: '', classe: '', statut: '', selectedId: null });
  const [editing, setEditing] = useState(null); // null fermé | 'new' | objet
  const [importOpen, setImportOpen] = useState(false);
  const setU = (patch) => setUi((u) => ({ ...u, ...patch }));

  const tags = useMemo(() => {
    const set = new Set(contacts.map((c) => c.categorie).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = normalize(ui.query.trim());
    return contacts.map(normalizeContact).filter((c) => {
      if (ui.categorie && c.categorie !== ui.categorie) return false;
      if (ui.classe && !c.classesActifs.includes(ui.classe)) return false;
      if (ui.statut === 'relance' ? !(c.prochaineRelance && c.prochaineRelance <= today()) : (ui.statut && c.statutRelation !== ui.statut)) return false;
      if (!q) return true;
      const haystack = normalize([
        c.societe, c.nom, c.prenom, c.fonction, c.email, c.telephone, c.adresse, c.notes, c.categorie, c.vehicule,
        c.classesActifs.join(' '), c.zones.join(' '), c.patrimoine, c.source, c.strategie,
      ].join(' '));
      return haystack.includes(q);
    });
  }, [contacts, ui]);

  const relancesDues = useMemo(() => contacts.filter((c) => c.prochaineRelance && c.prochaineRelance <= today()).length, [contacts]);
  const selected = ui.selectedId ? contacts.find((c) => c.id === ui.selectedId) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Réseau"
        title="Contacts"
        description="Investisseurs, propriétaires, notaires… tout votre carnet, structuré pour que l'IA sache à qui proposer quoi."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>
            <Button variant="brass" onClick={() => setEditing('new')}><Plus size={15} /> Nouveau contact</Button>
          </div>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun contact enregistré"
          description="Ajoutez vos contacts un par un, ou importez-les d'un coup depuis votre fichier Excel existant."
          action={
            <div className="flex gap-3">
              <Button variant="brass" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer Excel</Button>
              <Button variant="outline" onClick={() => setEditing('new')}><Plus size={15} /> Saisir manuellement</Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input value={ui.query} onChange={(e) => setU({ query: e.target.value })} placeholder="Nom, société, zone, classe d'actif, note…" className="pl-9" />
            </div>
            <Select value={ui.categorie} onChange={(e) => setU({ categorie: e.target.value })} className="lg:w-44">
              <option value="">Toutes catégories</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={ui.classe} onChange={(e) => setU({ classe: e.target.value })} className="lg:w-44">
              <option value="">Toutes classes d'actifs</option>
              {CLASSES_ACTIFS.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
            <Select value={ui.statut} onChange={(e) => setU({ statut: e.target.value })} className="lg:w-48">
              <option value="">Tous statuts</option>
              <option value="relance">À relancer{relancesDues ? ` (${relancesDues})` : ''}</option>
              {STATUTS_RELATION.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-ink-faint">
              {filtered.length} contact{filtered.length > 1 ? 's' : ''}{filtered.length !== contacts.length ? ` sur ${contacts.length}` : ''}
            </div>
            <BulkDeleteButton type="contact" items={filtered} label="contact" size="sm" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Aucun résultat" description="Essayez un autre terme, ou changez de filtre." />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => {
                const rel = relanceTone(c.prochaineRelance);
                const dc = dernierContact(c);
                return (
                  <Card key={c.id} className="animate-rise flex flex-col cursor-pointer hover:border-brass/50 transition-colors" onClick={() => setU({ selectedId: c.id })}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display text-[15.5px] text-ink leading-snug truncate">{contactLabel(c)}</div>
                        {(c.societe && (c.nom || c.prenom)) || c.fonction ? (
                          <div className="text-[12px] text-ink-faint truncate">
                            {c.societe ? [c.prenom, c.nom].filter(Boolean).join(' ') : ''}{c.fonction ? `${c.societe && (c.nom || c.prenom) ? ' · ' : ''}${c.fonction}` : ''}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {c.categorie && <Badge tone={toneFor(c.categorie)}>{c.categorie}</Badge>}
                        {rel && rel.tone !== 'default' && <Badge tone={rel.tone}>{rel.label}</Badge>}
                      </div>
                    </div>

                    {(c.classesActifs.length > 0 || c.zones.length > 0 || ticketLabel(c)) && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {c.classesActifs.map((k) => <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded bg-brass-soft text-ink">{k}</span>)}
                        {c.zones.slice(0, 3).map((z) => <span key={z} className="text-[10.5px] px-1.5 py-0.5 rounded bg-paper-raised border border-line text-ink-soft">{z}</span>)}
                        {ticketLabel(c) && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-paper-raised border border-line text-ink-soft tabular">{ticketLabel(c)}</span>}
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5 text-[12.5px]">
                      {c.email && <div className="flex items-center gap-2 text-ink-soft truncate"><Mail size={13} className="shrink-0" /> <span className="truncate">{c.email}</span></div>}
                      {c.telephone && <div className="flex items-center gap-2 text-ink-soft truncate"><Phone size={13} className="shrink-0" /> <span className="truncate">{c.telephone}</span></div>}
                      {!c.email && !c.telephone && c.adresse && <div className="flex items-center gap-2 text-ink-soft truncate"><MapPin size={13} className="shrink-0" /> <span className="truncate">{c.adresse}</span></div>}
                    </div>

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-ink-faint">{dc ? `Dernier contact le ${formatDate(dc)}` : c.statutRelation || ''}</span>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier"><Pencil size={14} /></button>
                        <button onClick={() => removeContact(c.id)} className="p-1.5 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <ContactDetail
        contact={selected ? normalizeContact(selected) : null}
        mandats={mandats}
        onClose={() => setU({ selectedId: null })}
        onEdit={() => { setEditing(selected); }}
        onAsk={(prefill) => navigate('/assistant', { state: { prefill } })}
      />
      <ContactEditor open={editing !== null} contact={editing === 'new' ? null : editing} existingTags={tags} onClose={() => setEditing(null)} />
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} onImport={(list) => addContactsBulk(list.map(normalizeImported))} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fiche détaillée — identité, critères, historique des échanges, biens à
// proposer (rapprochement instantané avec les mandats en cours), actions IA.
// ---------------------------------------------------------------------------
function ContactDetail({ contact, mandats, onClose, onEdit, onAsk }) {
  const { updateContact } = useApp();
  const [tab, setTab] = useState('fiche');
  const [inter, setInter] = useState({ date: today(), type: 'Appel', note: '', relance: '' });
  if (!contact) return null;
  const c = contact;
  const rel = relanceTone(c.prochaineRelance);
  const biens = estInvestisseur(c) ? matcherBiens(c, mandats) : [];

  function ajouterInteraction(e) {
    e.preventDefault();
    if (!inter.note.trim() && !inter.relance) return;
    const nouvelle = { id: uid('inter'), date: inter.date || today(), type: inter.type, note: inter.note.trim() };
    const patch = { interactions: [nouvelle, ...(c.interactions || [])] };
    if (inter.relance) patch.prochaineRelance = inter.relance;
    updateContact(c.id, patch);
    setInter({ date: today(), type: 'Appel', note: '', relance: '' });
  }

  const TABS = [
    ['fiche', 'Fiche', Briefcase], ['criteres', 'Critères', Target], ['historique', `Historique${c.interactions.length ? ` (${c.interactions.length})` : ''}`, History],
    ...(estInvestisseur(c) ? [['biens', `Biens à proposer${biens.length ? ` (${biens.length})` : ''}`, Building2]] : []),
  ];

  return (
    <Modal open onClose={onClose} title={contactLabel(c)} width="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4">
        {c.categorie && <Badge tone={toneFor(c.categorie)}>{c.categorie}</Badge>}
        {c.vehicule && <Badge>{c.vehicule}</Badge>}
        {c.statutRelation && <Badge tone={c.statutRelation === 'Client' ? 'teal' : c.statutRelation === 'Inactif' ? 'rust' : 'default'}>{c.statutRelation}</Badge>}
        {rel && <Badge tone={rel.tone}>{rel.label}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onAsk({ actionId: 'prospect', vals: { cible: contactLabel(c) + (c.fonction ? ` (${c.fonction})` : ''), contexte: c.notes || '' } })}><Sparkles size={13} /> Fiche IA</Button>
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={13} /> Modifier</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] border-b-2 -mb-px whitespace-nowrap ${tab === id ? 'border-brass text-ink font-medium' : 'border-transparent text-ink-faint hover:text-ink'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'fiche' && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Ligne label="Société" v={c.societe} />
          <Ligne label="Interlocuteur" v={[c.prenom, c.nom].filter(Boolean).join(' ')} />
          <Ligne label="Fonction" v={c.fonction} />
          <Ligne label="Email" v={c.email} href={c.email ? `mailto:${c.email.split(' / ')[0]}` : ''} />
          <Ligne label="Téléphone" v={c.telephone} href={c.telephone ? `tel:${c.telephone.split(' / ')[0].replace(/[^\d+]/g, '')}` : ''} />
          <Ligne label="Adresse" v={c.adresse} />
          <Ligne label="LinkedIn" v={c.linkedin} href={c.linkedin} icon={Link2} />
          <Ligne label="Site web" v={c.siteWeb} href={c.siteWeb} icon={Globe} />
          <Ligne label="Source" v={c.source} />
          <Ligne label="Dernier contact" v={dernierContact(c) ? formatDate(dernierContact(c)) : ''} />
          {c.patrimoine && <div className="sm:col-span-2"><div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1">Patrimoine / biens détenus</div><div className="text-ink whitespace-pre-wrap">{c.patrimoine}</div></div>}
          {c.notes && <div className="sm:col-span-2"><div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1">Notes</div><div className="text-ink whitespace-pre-wrap">{c.notes}</div></div>}
        </div>
      )}

      {tab === 'criteres' && (
        <div className="space-y-4 text-[13px]">
          {!estInvestisseur(c) && <p className="text-[12.5px] text-ink-faint">Aucun critère d'investissement renseigné — cliquez sur Modifier pour compléter le profil (classes d'actifs, zones, ticket…) et permettre à l'IA de lui proposer les bons biens.</p>}
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Ligne label="Véhicule" v={c.vehicule} />
            <Ligne label="Stratégie" v={c.strategie} />
            <Ligne label="Ticket" v={ticketLabel(c)} />
            <Ligne label="Rendement cible" v={c.rendementCible ? `${String(c.rendementCible).replace('.', ',')} %` : ''} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1.5">Classes d'actifs</div>
            <div className="flex flex-wrap gap-1.5">{c.classesActifs.length ? c.classesActifs.map((k) => <span key={k} className="text-[12px] px-2 py-0.5 rounded bg-brass-soft text-ink">{k}</span>) : <span className="text-ink-faint">—</span>}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1.5">Zones recherchées</div>
            <div className="flex flex-wrap gap-1.5">{c.zones.length ? c.zones.map((z) => <span key={z} className="text-[12px] px-2 py-0.5 rounded bg-paper-raised border border-line text-ink-soft">{z}</span>) : <span className="text-ink-faint">—</span>}</div>
          </div>
        </div>
      )}

      {tab === 'historique' && (
        <div className="space-y-4">
          <form onSubmit={ajouterInteraction} className="rounded-xl border border-line bg-paper-raised p-3.5 space-y-3">
            <div className="text-[12px] font-medium text-ink flex items-center gap-1.5"><MessageSquarePlus size={13} className="text-brass" /> Noter un échange</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Date"><Input type="date" value={inter.date} onChange={(e) => setInter({ ...inter, date: e.target.value })} /></Field>
              <Field label="Type"><Select value={inter.type} onChange={(e) => setInter({ ...inter, type: e.target.value })}>{TYPES_INTERACTION.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Prochaine relance" hint="Optionnel"><Input type="date" value={inter.relance} onChange={(e) => setInter({ ...inter, relance: e.target.value })} /></Field>
              <div className="flex items-end"><Button type="submit" variant="brass" className="w-full">Enregistrer</Button></div>
            </div>
            <Textarea rows={2} value={inter.note} onChange={(e) => setInter({ ...inter, note: e.target.value })} placeholder="Ce qui s'est dit, ce qu'il attend, la suite à donner…" />
          </form>
          {c.interactions.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Aucun échange noté pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {[...c.interactions].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((i) => (
                <li key={i.id} className="flex gap-3 text-[13px]">
                  <div className="w-24 shrink-0 text-ink-faint text-[12px] pt-0.5">{i.date ? formatDate(i.date) : '—'}</div>
                  <div className="flex-1 min-w-0">
                    <Badge>{i.type}</Badge>
                    {i.note && <div className="text-ink whitespace-pre-wrap mt-1">{i.note}</div>}
                  </div>
                  <button type="button" onClick={() => updateContact(c.id, { interactions: c.interactions.filter((x) => x.id !== i.id) })} className="text-ink-faint hover:text-rust p-1" title="Supprimer"><X size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'biens' && (
        <div className="space-y-2">
          {biens.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Aucun mandat en cours ne correspond à ses critères pour l'instant.</p>
          ) : biens.map((r) => (
            <div key={r.mandat.id} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{r.mandat.adresse}</div>
                <div className="text-[11.5px] text-ink-faint">{r.mandat.typeBien}{r.mandat.prixVente ? ` · ${formatEUR(r.mandat.prixVente)}` : ''} · {r.raisons.join(' · ')}</div>
              </div>
              <span className={`shrink-0 text-[12px] font-semibold tabular ${r.score >= 70 ? 'text-teal' : 'text-brass'}`}>{r.score} %</span>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => onAsk({ question: `Quels biens de mon portefeuille proposer à ${contactLabel(c)}, et avec quel argumentaire ? Propose aussi l'email d'approche.` })}>
              <Sparkles size={13} /> Demander au Copilote l'argumentaire <ArrowRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Ligne({ label, v, href, icon: Icon }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-0.5">{label}</div>
      {v ? (
        href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="text-brass hover:text-brass-deep inline-flex items-center gap-1 truncate max-w-full">{Icon && <Icon size={12} />}<span className="truncate">{v}</span></a>
          : <div className="text-ink truncate">{v}</div>
      ) : <div className="text-ink-faint">—</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saisie par étiquettes (zones).
// ---------------------------------------------------------------------------
function TagInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');
  function add(v) {
    const t = v.trim().replace(/[;,]$/, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput('');
  }
  return (
    <div className="rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brass">
      <div className="flex flex-wrap gap-1.5 items-center">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-paper-raised border border-line text-ink text-[12px] pl-2.5 pr-1 py-0.5">
            {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="h-4 w-4 rounded-full hover:bg-rust hover:text-white flex items-center justify-center"><X size={10} /></button>
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && input.trim()) { e.preventDefault(); add(input); } if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1)); }}
          onBlur={() => input.trim() && add(input)}
          placeholder={value.length ? '' : placeholder} className="flex-1 min-w-[140px] bg-transparent px-1.5 py-1 text-[13px] focus:outline-none" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Éditeur — trois volets : identité, profil & critères, suivi.
// ---------------------------------------------------------------------------
function ContactEditor({ open, contact, existingTags, onClose }) {
  const { addContact, updateContact } = useApp();
  const isEdit = Boolean(contact?.id);
  const [form, setForm] = useState(() => normalizeContact(contact || CONTACT_EMPTY));
  const [openedFor, setOpenedFor] = useState(contact);
  const [volet, setVolet] = useState('identite');

  if (open && contact !== openedFor) {
    setForm(normalizeContact(contact || CONTACT_EMPTY));
    setOpenedFor(contact);
    setVolet('identite');
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleClasse = (k) => setForm((f) => ({ ...f, classesActifs: f.classesActifs.includes(k) ? f.classesActifs.filter((x) => x !== k) : [...f.classesActifs, k] }));

  function submit(e) {
    e.preventDefault();
    const payload = { ...form, ticketMin: form.ticketMin === '' ? '' : Number(form.ticketMin), ticketMax: form.ticketMax === '' ? '' : Number(form.ticketMax) };
    if (isEdit) updateContact(contact.id, payload);
    else addContact(payload);
    onClose();
  }

  const VOLETS = [['identite', 'Identité'], ['profil', 'Profil & critères'], ['suivi', 'Suivi']];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le contact' : 'Nouveau contact'} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-1 border-b border-line">
          {VOLETS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setVolet(id)} className={`px-3 py-2 text-[12.5px] border-b-2 -mb-px ${volet === id ? 'border-brass text-ink font-medium' : 'border-transparent text-ink-faint hover:text-ink'}`}>{label}</button>
          ))}
        </div>

        {volet === 'identite' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Société"><Input value={form.societe} onChange={set('societe')} /></Field>
              <Field label="Catégorie" hint="Investisseur, Propriétaire, Notaire…">
                <Input value={form.categorie} onChange={set('categorie')} list="contact-categories" placeholder="Ex. Investisseur" />
                <datalist id="contact-categories">{[...new Set([...existingTags, 'Investisseur', 'Propriétaire', 'Notaire', 'Banque', 'Avocat', 'Confrère', 'Promoteur', 'Locataire'])].map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Prénom"><Input value={form.prenom} onChange={set('prenom')} /></Field>
              <Field label="Nom" required={!form.societe}><Input value={form.nom} onChange={set('nom')} /></Field>
              <Field label="Fonction"><Input value={form.fonction} onChange={set('fonction')} placeholder="Directeur des investissements…" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} /></Field>
            </div>
            <Field label="Adresse"><Input value={form.adresse} onChange={set('adresse')} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="LinkedIn"><Input value={form.linkedin} onChange={set('linkedin')} placeholder="https://www.linkedin.com/in/…" /></Field>
              <Field label="Site web"><Input value={form.siteWeb} onChange={set('siteWeb')} placeholder="https://…" /></Field>
            </div>
          </div>
        )}

        {volet === 'profil' && (
          <div className="space-y-4">
            <p className="text-[12px] text-ink-faint">Ces critères permettent le rapprochement automatique avec vos biens et IM — plus ils sont précis, plus l'IA cible juste.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Véhicule / type d'investisseur"><Select value={form.vehicule} onChange={set('vehicule')}><option value="">—</option>{VEHICULES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
              <Field label="Stratégie"><Select value={form.strategie} onChange={set('strategie')}><option value="">—</option>{STRATEGIES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
            </div>
            <Field label="Classes d'actifs recherchées">
              <div className="flex flex-wrap gap-1.5">
                {CLASSES_ACTIFS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleClasse(k)} className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${form.classesActifs.includes(k) ? 'border-brass bg-brass-soft text-ink' : 'border-line text-ink-soft hover:border-brass/50'}`}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label="Zones recherchées" hint="Villes, départements (« 69 »), régions, ou « National » — Entrée pour valider chaque zone">
              <TagInput value={form.zones} onChange={(zones) => setForm((f) => ({ ...f, zones }))} placeholder="Lyon, 33, Île-de-France, National…" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Ticket minimum (€)"><Input type="number" value={form.ticketMin} onChange={set('ticketMin')} /></Field>
              <Field label="Ticket maximum (€)"><Input type="number" value={form.ticketMax} onChange={set('ticketMax')} /></Field>
              <Field label="Rendement cible (%)"><Input type="number" step="0.1" value={form.rendementCible} onChange={set('rendementCible')} placeholder="6,5" /></Field>
            </div>
            <Field label="Patrimoine / biens détenus" hint="Pour un propriétaire : ce qu'il possède, ce qu'il pourrait céder">
              <Textarea rows={3} value={form.patrimoine} onChange={set('patrimoine')} />
            </Field>
          </div>
        )}

        {volet === 'suivi' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Statut de la relation"><Select value={form.statutRelation} onChange={set('statutRelation')}>{STATUTS_RELATION.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Source" hint="Comment vous l'avez rencontré"><Input value={form.source} onChange={set('source')} placeholder="Salon, recommandation, LinkedIn…" /></Field>
              <Field label="Prochaine relance"><Input type="date" value={form.prochaineRelance} onChange={set('prochaineRelance')} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={5} value={form.notes} onChange={set('notes')} placeholder="Préférences, contexte, points d'attention…" /></Field>
            {form.interactions.length > 0 && <p className="text-[12px] text-ink-faint flex items-center gap-1.5"><CalendarClock size={12} /> {form.interactions.length} échange(s) enregistré(s) — gérés depuis l'onglet Historique de la fiche.</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-line-soft">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer' : 'Créer le contact'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Import Excel — lecture réelle du classeur (SheetJS), mappage par onglet,
// rien n'est enregistré avant validation.
// ---------------------------------------------------------------------------
const IMPORT_FIELDS = [
  ['ignorer', 'Ignorer'], ['societe', 'Société'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['fonction', 'Fonction'],
  ['email', 'Email'], ['telephone', 'Téléphone'], ['adresse', 'Adresse'], ['linkedin', 'LinkedIn'],
  ['vehicule', 'Véhicule / type'], ['classesActifs', 'Classes d’actifs'], ['zones', 'Zones'],
  ['ticketMin', 'Ticket min (€)'], ['ticketMax', 'Ticket max (€)'], ['rendementCible', 'Rendement cible (%)'],
  ['source', 'Source'], ['patrimoine', 'Patrimoine'], ['notes', 'Notes (autres infos)'],
];

function ImportWizard({ open, onClose, onImport }) {
  const [status, setStatus] = useState('idle'); // idle | reading | mapping | done | error
  const [sheets, setSheets] = useState([]);
  const [mappings, setMappings] = useState({});
  const [included, setIncluded] = useState({});
  const [openSheets, setOpenSheets] = useState({});
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  function reset() { setStatus('idle'); setSheets([]); setMappings({}); setIncluded({}); setOpenSheets({}); setError(''); setImportedCount(0); }
  function close() { reset(); onClose(); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('reading'); setError('');
    try {
      const { readWorkbookSheets } = await import('../lib/xlsxImport');
      const parsed = await readWorkbookSheets(file);
      const initMappings = {}, initIncluded = {}, initOpen = {};
      parsed.forEach((s, i) => {
        initMappings[s.name] = Object.fromEntries(s.columns.map((c) => [c.index, c.guess]));
        initIncluded[s.name] = true;
        initOpen[s.name] = i === 0;
      });
      setSheets(parsed); setMappings(initMappings); setIncluded(initIncluded); setOpenSheets(initOpen);
      setStatus('mapping');
    } catch {
      setStatus('error');
      setError("Impossible de lire ce fichier — vérifiez qu'il s'agit bien d'un classeur Excel (.xlsx).");
    }
  }

  function setMapping(sheetName, colIndex, field) {
    setMappings((m) => ({ ...m, [sheetName]: { ...m[sheetName], [colIndex]: field } }));
  }

  const previewTotal = useMemo(() => {
    if (status !== 'mapping') return 0;
    return sheets.reduce((sum, s) => {
      if (!included[s.name]) return sum;
      const rowsWithData = s.rows.filter((row) => s.columns.some((c) => {
        const f = mappings[s.name]?.[c.index];
        return f && f !== 'ignorer' && String(row[c.index] ?? '').trim();
      }));
      return sum + rowsWithData.length;
    }, 0);
  }, [sheets, mappings, included, status]);

  async function confirmImport() {
    const { buildContactsFromMapping } = await import('../lib/xlsxImport');
    const all = sheets.filter((s) => included[s.name]).flatMap((s) => buildContactsFromMapping(s, mappings[s.name]));
    onImport(all);
    setImportedCount(all.length);
    setStatus('done');
  }

  return (
    <Modal open={open} onClose={close} title="Importer des contacts depuis Excel" width="max-w-3xl">
      {status === 'idle' || status === 'reading' ? (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            Déposez votre classeur Excel. Chaque onglet est lu séparément — vous choisirez ensuite, pour chacun, quelle colonne correspond à quel champ (société, nom, zones, ticket…) avant que rien ne soit enregistré. Le nom de l'onglet devient la catégorie.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
            {status === 'reading' ? (<><Loader2 className="animate-spin text-brass" size={26} /><span className="text-[12.5px] text-ink-soft">Lecture du classeur…</span></>)
              : (<><UploadCloud className="text-ink-faint" size={26} /><span className="text-[13px] text-ink font-medium">Déposer un fichier .xlsx ou cliquer pour parcourir</span></>)}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
          {status === 'error' && <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {error}</div>}
        </div>
      ) : status === 'mapping' ? (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft">{sheets.length} onglet{sheets.length > 1 ? 's' : ''} détecté{sheets.length > 1 ? 's' : ''}. Le mappage est deviné automatiquement — corrigez-le si besoin, décochez un onglet à ne pas importer.</p>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
            {sheets.map((s) => (
              <div key={s.name} className="border border-line rounded-lg overflow-hidden">
                <button type="button" onClick={() => setOpenSheets((o) => ({ ...o, [s.name]: !o[s.name] }))} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-paper-raised text-left">
                  <input type="checkbox" checked={included[s.name] ?? true} onChange={(e) => { e.stopPropagation(); setIncluded((o) => ({ ...o, [s.name]: e.target.checked })); }} onClick={(e) => e.stopPropagation()} className="rounded border-line" />
                  {openSheets[s.name] ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
                  <span className="text-[13px] font-medium text-ink flex-1">{s.name}</span>
                  <span className="text-[11px] text-ink-faint">{s.rows.length} ligne{s.rows.length > 1 ? 's' : ''}</span>
                </button>
                {openSheets[s.name] && (
                  <div className="p-3.5 space-y-2">
                    {s.columns.map((c) => (
                      <div key={c.index} className="flex items-center gap-2">
                        <div className="w-40 shrink-0 text-[12px] text-ink-soft truncate" title={c.label}>{c.label}</div>
                        <div className="flex-1 text-[11px] text-ink-faint truncate italic" title={c.sample}>{c.sample || '—'}</div>
                        <Select value={mappings[s.name]?.[c.index] || 'ignorer'} onChange={(e) => setMapping(s.name, c.index, e.target.value)} className="!py-1.5 w-48 shrink-0">
                          {IMPORT_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-brass/25 bg-brass-soft/40 p-3.5 flex items-center justify-between text-[13px]">
            <span className="text-ink">Contacts à importer</span>
            <span className="font-display text-[18px] text-ink tabular">{previewTotal}</span>
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={close}>Annuler</Button>
            <Button variant="brass" onClick={confirmImport} disabled={previewTotal === 0}>Importer {previewTotal} contact{previewTotal > 1 ? 's' : ''}</Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <CheckCircle2 className="mx-auto text-teal mb-3" size={30} strokeWidth={1.5} />
          <div className="font-display text-[19px] text-ink">{importedCount} contact{importedCount > 1 ? 's' : ''} importé{importedCount > 1 ? 's' : ''}</div>
          <p className="text-ink-soft text-[13px] mt-1.5">Retrouvables et modifiables immédiatement, comme n'importe quel contact saisi à la main.</p>
          <div className="flex justify-center mt-6"><Button variant="brass" onClick={close}>Terminer</Button></div>
        </div>
      )}
    </Modal>
  );
}
