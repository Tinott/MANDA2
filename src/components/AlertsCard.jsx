import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, AlertTriangle, AlertCircle, Clock, Info, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildAlerts } from '../lib/relances';
import { Card } from './ui';

const STYLE = {
  critical: { icon: AlertTriangle, cls: 'text-rust', bg: 'bg-rust/5 border-rust/20' },
  urgent: { icon: AlertCircle, cls: 'text-rust', bg: 'bg-rust/5 border-rust/15' },
  warn: { icon: Clock, cls: 'text-brass-deep', bg: 'bg-brass-soft/40 border-brass/20' },
  info: { icon: Info, cls: 'text-ink-soft', bg: 'bg-paper-raised border-line' },
};

export default function AlertsCard({ limit = 8 }) {
  const { promesses, mandats, factures, prospects, courriers } = useApp();
  const alerts = useMemo(
    () => buildAlerts({ promesses, mandats, factures, prospects, courriers }),
    [promesses, mandats, factures, prospects, courriers]
  );

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={16} className="text-brass" />
        <div className="font-display text-[15px] text-ink">À faire & échéances</div>
        {alerts.length > 0 && <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-rust/10 text-rust font-medium">{alerts.length}</span>}
      </div>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint py-2"><CheckCircle2 size={15} className="text-teal" /> Rien d'urgent — tout est à jour.</div>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, limit).map((a, i) => {
            const S = STYLE[a.level];
            const Icon = S.icon;
            return (
              <Link key={i} to={a.link} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${S.bg} hover:opacity-90 transition-opacity`}>
                <Icon size={15} className={`${S.cls} mt-0.5 shrink-0`} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-ink truncate">{a.label}</div>
                  <div className="text-[11.5px] text-ink-faint">{a.detail}</div>
                </div>
              </Link>
            );
          })}
          {alerts.length > limit && <div className="text-[11.5px] text-ink-faint pt-1">+ {alerts.length - limit} autre(s) alerte(s)</div>}
        </div>
      )}
    </Card>
  );
}
