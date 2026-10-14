export const STAGES = [
  { id: 'new', label: 'New', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
  { id: 'contacted', label: 'Contacted', dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700' },
  { id: 'qualified', label: 'Qualified', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700' },
  { id: 'proposal', label: 'Proposal', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  { id: 'won', label: 'Won', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  { id: 'lost', label: 'Lost', dot: 'bg-rose-400', chip: 'bg-rose-50 text-rose-700' },
];
export const stageOf = (id) => STAGES.find((s) => s.id === id) ?? STAGES[0];

export const SOURCES = ['website', 'referral', 'linkedin', 'cold_outreach', 'ads', 'event', 'other'];
export const sourceLabel = (s) => ({ cold_outreach: 'Cold outreach', linkedin: 'LinkedIn' }[s] ?? s.charAt(0).toUpperCase() + s.slice(1));

export const money = (v, compact = false) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: compact && v >= 10000 ? 'compact' : 'standard' }).format(v || 0);

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export function timeAgo(d) {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  const units = [[86400 * 30, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [secs, u] of units) if (s >= secs) return `${Math.floor(s / secs)}${u} ago`;
  return 'just now';
}

export const initials = (name = '') => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function scoreTone(v) {
  if (v == null) return 'bg-ink-100 text-ink-500';
  if (v >= 70) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (v >= 40) return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-rose-200';
}
