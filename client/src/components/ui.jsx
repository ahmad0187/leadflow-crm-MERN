import { X } from 'lucide-react';
import { useEffect } from 'react';
import { initials, scoreTone, stageOf } from '../lib/format.js';

export function ScoreBadge({ value, size = 'sm' }) {
  const cls = size === 'lg' ? 'h-12 w-12 text-lg' : 'h-7 min-w-7 px-1.5 text-xs';
  return (
    <span title="Lead score" className={`inline-flex items-center justify-center rounded-lg font-bold ring-1 ring-inset ring-transparent ${scoreTone(value)} ${cls}`}>
      {value ?? '–'}
    </span>
  );
}

export function StageBadge({ stage }) {
  const s = stageOf(stage);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const AVATAR_COLORS = ['bg-brand-100 text-brand-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700'];
export function Avatar({ name, size = 'sm' }) {
  if (!name) return <span className="inline-grid h-6 w-6 place-items-center rounded-full border border-dashed border-ink-200 text-[10px] text-ink-400">?</span>;
  const color = AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const cls = size === 'lg' ? 'h-9 w-9 text-sm' : 'h-6 w-6 text-[10px]';
  return <span title={name} className={`inline-grid place-items-center rounded-full font-bold ${color} ${cls}`}>{initials(name)}</span>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-auto p-6`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FieldError({ fields, name }) {
  const f = fields?.find((x) => x.path === name);
  return f ? <p className="mt-1 text-xs text-rose-600">{f.message}</p> : null;
}

export function Empty({ title, children }) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm text-ink-500">{children}</div>
    </div>
  );
}
