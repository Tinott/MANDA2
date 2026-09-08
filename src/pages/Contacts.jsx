
import { useMemo, useState } from 'react';
import {
  Plus, Users, Search, Pencil, Trash2, Mail, Phone, MapPin, UploadCloud,
  Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState, BulkDeleteButton } from '../components/ui';

const EMPTY = { societe: '', nom: '', prenom: '', email: '', telephone: '', adresse: '', categorie: '', notes: '' };
const TONES = ['brass', 'teal', 'rust', 'default'];

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toneFor(categorie) {
  if (!categorie) return 'default';
  let h = 0;
  for (let i = 0; i < categorie.length; i += 1) h = (h * 31 + categorie.charCodeAt(i)) % 997;
  return TONES[h % TONES.length];
}

export default function Contacts() {
  const { contacts, addContact, updateContact, removeContact, addContactsBulk } = useApp();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [editing, setEditing] = useState(null); // null fermé | 'new' | objet
  const [importOpen, setImportOpen] = useState(false);

  const tags = useMemo(() => {
    const set = new Set(contacts.map((c) => c.categorie).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return contacts.filter((c) => {
      if (activeTag && c.categorie !== activeTag) return false;
      if (!q) return true;
      const haystack = normalize(
        [c.societe, c.nom, c.prenom, c.email, c.telephone, c.adresse, c.notes, c.categorie].join(' ')
      );
      return haystack.includes(q);
    });
  }, [contacts, query, activeTag]);

  return (
    <div>
      <PageHeader
        eyebrow="Réseau"
        title="Contacts"
        description="Investisseurs, locataires, promoteurs, notaires… tout votre carnet, retrouvable en un instant."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer un fichier Excel</Button>
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
              <Button variant="brass" onClick={() => setImportOpen(true)}><UploadCloud size={15} /> Importer un fichier Excel</Button>
              <Button variant="outline" onClick={() => setEditing('new')}><Plus size={15} /> Saisir manuellement</Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un nom, une société, un email, un numéro, une note…"
                className="pl-9"
              />
            </div>
            {tags.length > 0 && (
              <Select value={activeTag} onChange={(e) => setActiveTag(e.target.value)} className="sm:w-56">
                <option value="">Toutes les catégories ({contacts.length})</option>
                {tags.map((t) => (
                  <option key={t} value={t}>{t} ({contacts.filter((c) => c.categorie === t).length})</option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-ink-faint">
              {filtered.length} contact{filtered.length > 1 ? 's' : ''}{query || activeTag ? ` sur ${contacts.length}` : ''}
            </div>
            <BulkDeleteButton type="contact" items={filtered} label="contact" size="sm" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Aucun résultat" description="Essayez un autre terme, ou changez de catégorie." />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <Card key={c.id} className="animate-rise flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-[15.5px] text-ink leading-snug truncate">
                        {c.societe || [c.prenom, c.nom].filter(Boolean).join(' ') || 'Contact sans nom'}
                      </div>
                      {c.societe && (c.nom || c.prenom) && (
                        <div className="text-[12px] text-ink-faint truncate">{[c.prenom, c.nom].filter(Boolean).join(' ')}</div>
                      )}
                    </div>
                    {c.categorie && <Badge tone={toneFor(c.categorie)}>{c.categorie}</Badge>}
                  </div>

                  <div className="mt-3 space-y-1.5 text-[12.5px]">
                    {c.email && (
                      <a href={`mailto:${c.email.split(' / ')[0]}`} className="flex items-center gap-2 text-ink-soft hover:text-brass truncate">
                        <Mail size={13} className="shrink-0" /> <span className="truncate">{c.email}</span>
                      </a>
                    )}
                    {c.telephone && (
                      <a href={`tel:${c.telephone.split(' / ')[0].replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-ink-soft hover:text-brass truncate">
                        <Phone size={13} className="shrink-0" /> <span className="truncate">{c.telephone}</span>
                      </a>
                    )}
                    {c.adresse && (
                      <div className="flex items-center gap-2 text-ink-soft truncate">
                        <MapPin size={13} className="shrink-0" /> <span className="truncate">{c.adresse}</span>
                      </div>
                    )}
                  </div>

                  {c.notes && (
                    <div className="mt-3 pt-3 border-t border-line-soft text-[12px] text-ink-soft line-clamp-3">{c.notes}</div>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(c)} className="p-2 rounded-lg text-ink-faint hover:text-brass hover:bg-brass-soft" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => removeContact(c.id)} className="p-2 rounded-lg text-ink-faint hover:text-rust hover:bg-rust-soft" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <ContactEditor open={editing !== null} contact={editing === 'new' ? null : editing} existingTags={tags} onClose={() => setEditing(null)} />
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} onImport={addContactsBulk} />
    </div>
  );
}

function ContactEditor({ open, contact, existingTags, onClose }) {
  const { addContact, updateContact } = useApp();
  const isEdit = Boolean(contact?.id);
  const [form, setForm] = useState(contact || EMPTY);
  const [openedFor, setOpenedFor] = useState(contact);

  if (open && contact !== openedFor) {
    setForm(contact || EMPTY);
    setOpenedFor(contact);
  }
  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (isEdit) updateContact(contact.id, form);
    else addContact(form);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le contact' : 'Nouveau contact'} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Société"><Input value={form.societe} onChange={set('societe')} /></Field>
          <Field label="Catégorie" hint="Libre — investisseur, locataire, notaire…">
            <Input value={form.categorie} onChange={set('categorie')} list="contact-categories" placeholder="Ex. Promoteur" />
            <datalist id="contact-categories">
              {existingTags.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom"><Input value={form.prenom} onChange={set('prenom')} /></Field>
          <Field label="Nom" required={!form.societe}><Input value={form.nom} onChange={set('nom')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} /></Field>
        </div>
        <Field label="Adresse"><Input value={form.adresse} onChange={set('adresse')} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={set('notes')} placeholder="Dossiers en cours, historique d'échanges, préférences…" /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="brass">{isEdit ? 'Enregistrer les modifications' : 'Créer le contact'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// --- Import Excel — lecture réelle du classeur (SheetJS), aucune donnée
// enregistrée avant validation du mappage de colonnes par l'utilisateur.
// Les classeurs de contacts réels mélangent des en-têtes différents d'un
// onglet à l'autre : chaque feuille propose donc son propre mappage,
// deviné automatiquement mais entièrement modifiable avant import.
function ImportWizard({ open, onClose, onImport }) {
  const [status, setStatus] = useState('idle'); // idle | reading | mapping | done | error
  const [sheets, setSheets] = useState([]);
  const [mappings, setMappings] = useState({}); // { sheetName: { colIndex: field } }
  const [included, setIncluded] = useState({}); // { sheetName: bool }
  const [openSheets, setOpenSheets] = useState({});
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStatus('idle'); setSheets([]); setMappings({}); setIncluded({}); setOpenSheets({}); setError(''); setImportedCount(0);
  }
  function close() { reset(); onClose(); }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('reading');
    setError('');
    try {
      const { readWorkbookSheets } = await import('../lib/xlsxImport');
      const parsed = await readWorkbookSheets(file);
      const initMappings = {};
      const initIncluded = {};
      const initOpen = {};
      parsed.forEach((s, i) => {
        initMappings[s.name] = Object.fromEntries(s.columns.map((c) => [c.index, c.guess]));
        initIncluded[s.name] = true;
        initOpen[s.name] = i === 0;
      });
      setSheets(parsed);
      setMappings(initMappings);
      setIncluded(initIncluded);
      setOpenSheets(initOpen);
      setStatus('mapping');
    } catch (err) {
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
      // buildContactsFromMapping fait un import dynamique en réel ; ici on
      // compte simplement les lignes qui ont au moins une valeur mappée.
      const rowsWithData = s.rows.filter((row) =>
        s.columns.some((c) => {
          const f = mappings[s.name]?.[c.index];
          return f && f !== 'ignorer' && String(row[c.index] ?? '').trim();
        })
      );
      return sum + rowsWithData.length;
    }, 0);
  }, [sheets, mappings, included, status]);

  async function confirmImport() {
    const { buildContactsFromMapping } = await import('../lib/xlsxImport');
    const all = sheets
      .filter((s) => included[s.name])
      .flatMap((s) => buildContactsFromMapping(s, mappings[s.name]));
    onImport(all);
    setImportedCount(all.length);
    setStatus('done');
  }

  return (
    <Modal open={open} onClose={close} title="Importer des contacts depuis Excel" width="max-w-3xl">
      {status === 'idle' || status === 'reading' ? (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            Déposez votre classeur Excel. Chaque onglet est lu séparément — vous choisirez ensuite, pour
            chacun, quelle colonne correspond à quel champ (société, nom, email…) avant que rien ne soit
            enregistré.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-brass hover:bg-brass-soft/30 transition-colors">
            {status === 'reading' ? (
              <>
                <Loader2 className="animate-spin text-brass" size={26} />
                <span className="text-[12.5px] text-ink-soft">Lecture du classeur…</span>
              </>
            ) : (
              <>
                <UploadCloud className="text-ink-faint" size={26} />
                <span className="text-[13px] text-ink font-medium">Déposer un fichier .xlsx ou cliquer pour parcourir</span>
              </>
            )}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
          {status === 'error' && (
            <div className="flex items-center gap-2 text-[12.5px] text-rust"><AlertCircle size={14} /> {error}</div>
          )}
        </div>
      ) : status === 'mapping' ? (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-soft">
            {sheets.length} onglet{sheets.length > 1 ? 's' : ''} détecté{sheets.length > 1 ? 's' : ''}. Le
            mappage est deviné automatiquement — corrigez-le si besoin, décochez un onglet à ne pas importer.
          </p>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
            {sheets.map((s) => (
              <div key={s.name} className="border border-line rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSheets((o) => ({ ...o, [s.name]: !o[s.name] }))}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-paper-raised text-left"
                >
                  <input
                    type="checkbox"
                    checked={included[s.name] ?? true}
                    onChange={(e) => { e.stopPropagation(); setIncluded((o) => ({ ...o, [s.name]: e.target.checked })); }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-line"
                  />
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
                        <Select
                          value={mappings[s.name]?.[c.index] || 'ignorer'}
                          onChange={(e) => setMapping(s.name, c.index, e.target.value)}
                          className="!py-1.5 w-44 shrink-0"
                        >
                          <option value="ignorer">Ignorer</option>
                          <option value="societe">Société</option>
                          <option value="nom">Nom</option>
                          <option value="prenom">Prénom</option>
                          <option value="email">Email</option>
                          <option value="telephone">Téléphone</option>
                          <option value="adresse">Adresse</option>
                          <option value="notes">Notes (autres infos)</option>
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
          <div className="flex justify-center mt-6">
            <Button variant="brass" onClick={close}>Terminer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
