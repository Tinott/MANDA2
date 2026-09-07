
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, FileText, Receipt, BookOpen, Wallet, CalendarClock,
  FileStack, BarChart3, Settings, Building2, Users, Trash2, TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutGrid, end: true },
  { to: '/mandats', label: 'Mandats & biens', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/suivi', label: 'Suivi commercial', icon: TrendingUp },
  { to: '/facturation', label: 'Facturation', icon: FileText },
  { to: '/frais', label: 'Notes de frais', icon: Receipt },
  { to: '/comptabilite', label: 'Comptabilité', icon: BookOpen },
  { to: '/tresorerie', label: 'Trésorerie', icon: Wallet },
  { to: '/im', label: 'Memorandums (IM)', icon: FileStack },
  { to: '/promesses', label: 'Promesses de vente', icon: CalendarClock },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
];

export default function Sidebar() {
  const { societe } = useApp();
  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-ink text-white/90 min-h-screen sticky top-0">
      <div className="px-6 pt-7 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brass/60 text-brass font-display text-base">
            M
          </span>
          <div>
            <div className="font-display text-lg leading-none tracking-wide">Mandat</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mt-1">Gestion SARL</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <NavLink
          to="/corbeille"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors ${
              isActive ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Trash2 size={16} strokeWidth={1.75} />
          Corbeille
        </NavLink>
        <NavLink
          to="/parametres"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors ${
              isActive ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Settings size={16} strokeWidth={1.75} />
          Paramètres
        </NavLink>
        <div className="mt-3 px-3 py-3 rounded-lg bg-white/5 border border-white/10">
          <div className="text-[12px] font-medium text-white/85 truncate">{societe?.nom || 'Société non configurée'}</div>
          <div className="text-[10.5px] text-white/40 mt-0.5">SIRET {societe?.siret || '—'}</div>
        </div>
      </div>
    </aside>
  );
}
