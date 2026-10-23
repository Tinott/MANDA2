
import { X, Check, ChevronRight, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Bouton "Tout supprimer" générique — supprime (de façon réversible) tous
// les éléments de la liste passée, tels qu'affichés à l'écran (filtres
// déjà appliqués côté page appelante). Un seul clic + une confirmation.
export function BulkDeleteButton({ type, items, label, size = 'md' }) {
  const { removeMany } = useApp();
  if (!items || items.length === 0) return null;
  const noun = label || 'élément';
  return (
    <Button
      variant="danger"
      size={size}
      onClick={() => {
        if (confirm(`Supprimer les ${items.length} ${noun}${items.length > 1 ? 's' : ''} affiché${items.length > 1 ? 's' : ''} ? Ils resteront récupérables (Annuler, ou Corbeille).`)) {
          removeMany(type, items.map((x) => x.id));
        }
      }}
    >
      <Trash2 size={14} /> Tout supprimer
    </Button>
  );
}

export function PageHeader({ eyebrow, title, action, description }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-rise">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.16em] text-brass font-medium mb-2">{eyebrow}</div>
        )}
        <h1 className="font-display text-[28px] leading-tight text-ink">{title}</h1>
        {description && <p className="text-ink-soft text-[13.5px] mt-1.5 max-w-xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '', padded = true, ...rest }) {
  return (
    <div className={`bg-surface border border-line rounded-xl ${padded ? 'p-5' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = 'default' }) {
  const toneMap = {
    default: 'text-ink',
    good: 'text-teal',
    warn: 'text-rust',
  };
  return (
    <Card className="animate-rise">
      <div className="text-[11px] uppercase tracking-[0.1em] text-ink-faint font-medium">{label}</div>
      <div className={`font-display text-[26px] mt-2 tabular ${toneMap[tone]}`}>{value}</div>
      {sub && <div className="text-[12px] text-ink-soft mt-1">{sub}</div>}
    </Card>
  );
}

export function Badge({ children, tone = 'default' }) {
  const map = {
    default: 'bg-paper text-ink-soft border-line',
    brass: 'bg-brass-soft text-brass-deep border-brass/20',
    teal: 'bg-teal-soft text-teal border-teal/20',
    rust: 'bg-rust-soft text-rust border-rust/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(statut) {
  if (['Payée', 'Diffusé', 'Actif', 'Conforme'].includes(statut)) return 'teal';
  if (['En retard', 'Bloqué'].includes(statut)) return 'rust';
  if (['Brouillon'].includes(statut)) return 'default';
  return 'brass';
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-line rounded-xl bg-paper-raised animate-rise">
      {Icon && (
        <div className="h-11 w-11 rounded-full bg-brass-soft text-brass-deep flex items-center justify-center mb-4">
          <Icon size={19} strokeWidth={1.75} />
        </div>
      )}
      <div className="font-display text-[19px] text-ink">{title}</div>
      {description && <p className="text-ink-soft text-[13.5px] mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none';
  const sizes = { md: 'px-4 py-2.5 text-[13.5px]', sm: 'px-3 py-1.5 text-[12.5px]' };
  const variants = {
    primary: 'bg-ink text-white hover:bg-brass-deep',
    brass: 'bg-brass text-white hover:bg-brass-deep',
    outline: 'border border-line bg-surface text-ink hover:bg-paper',
    ghost: 'text-ink-soft hover:bg-paper hover:text-ink',
    danger: 'text-rust hover:bg-rust-soft',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, required, children, error }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[12.5px] font-medium text-ink mb-1.5">
          {label} {required && <span className="text-rust">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-[11.5px] text-ink-faint mt-1">{hint}</span>}
      {error && <span className="block text-[11.5px] text-rust mt-1">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brass transition-colors';

export function Input({ className = '', ...props }) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}
export function Select({ children, className = '', ...props }) {
  return (
    <select className={`${inputBase} ${className}`} {...props}>
      {children}
    </select>
  );
}
export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputBase} min-h-24 resize-y ${className}`} {...props} />;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-surface rounded-2xl border border-line shadow-2xl w-full ${width} my-8 animate-rise`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-[18px] text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink rounded-full p-1 hover:bg-paper">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-1.5 mb-8 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <div key={s} className="flex items-center gap-1.5 shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                state === 'active'
                  ? 'bg-ink text-white border-ink'
                  : state === 'done'
                  ? 'bg-teal-soft text-teal border-teal/25'
                  : 'bg-paper text-ink-faint border-line'
              }`}
            >
              {state === 'done' ? <Check size={12} /> : <span className="tabular">{i + 1}</span>}
              {s}
            </div>
            {i < steps.length - 1 && <ChevronRight size={13} className="text-line shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export function Stamp({ label = 'Conforme', className = '' }) {
  return (
    <div
      className={`animate-stamp inline-flex flex-col items-center justify-center h-20 w-20 rounded-full border-2 border-teal text-teal -rotate-6 shrink-0 ${className}`}
      style={{ borderStyle: 'double', borderWidth: 4 }}
    >
      <Check size={20} strokeWidth={2.5} />
      <span className="text-[8.5px] uppercase tracking-wider font-semibold mt-0.5">{label}</span>
    </div>
  );
}
