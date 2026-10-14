import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Empty, ScoreBadge, StageBadge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { date, money, SOURCES, sourceLabel, STAGES, timeAgo } from '../lib/format.js';

const SORTS = [['-createdAt', 'Newest'], ['-score', 'Highest score'], ['-value', 'Highest value'], ['name', 'Name A–Z']];

export default function Leads() {
  const [, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ stage: '', source: '', owner: '', sort: '-createdAt' });
  const [page, setPage] = useState(1);

  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams(Object.entries({ ...filters, q: debounced, page, limit: 15 }).filter(([, v]) => v !== ''));
  const leads = useQuery({ queryKey: ['leads', qs.toString()], queryFn: () => api(`/leads?${qs}`), placeholderData: keepPreviousData });
  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1); };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto"><h1 className="text-2xl font-extrabold tracking-tight">Leads</h1><p className="text-sm text-ink-500">{leads.data?.total ?? '…'} results</p></div>
        <a className="btn" href="/api/leads/export.csv"><Download size={15} /> Export CSV</a>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search name, company or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search leads" />
        </div>
        <select className="input w-auto" value={filters.stage} onChange={setFilter('stage')} aria-label="Stage"><option value="">All stages</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select className="input w-auto" value={filters.source} onChange={setFilter('source')} aria-label="Source"><option value="">All sources</option>{SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select>
        <select className="input w-auto" value={filters.owner} onChange={setFilter('owner')} aria-label="Owner"><option value="">Everyone</option><option value="me">My leads</option><option value="unassigned">Unassigned</option></select>
        <select className="input w-auto" value={filters.sort} onChange={setFilter('sort')} aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>

      {leads.isError ? <Empty title="Couldn't load leads">{leads.error.message}</Empty> : leads.data?.items.length === 0 ? (
        <Empty title="No leads match">Try clearing the filters.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-left text-xs font-semibold text-ink-500">
              <tr>{['Score', 'Lead', 'Stage', 'Value', 'Source', 'Owner', 'Last contact', 'Created'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {leads.data?.items.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => setParams({ lead: l.id })}>
                  <td className="px-4 py-3"><ScoreBadge value={l.score?.value} /></td>
                  <td className="px-4 py-3"><p className="font-semibold">{l.name}</p><p className="text-xs text-ink-400">{l.company} {l.email && `· ${l.email}`}</p></td>
                  <td className="px-4 py-3"><StageBadge stage={l.stage} /></td>
                  <td className="px-4 py-3 font-semibold">{money(l.value)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{sourceLabel(l.source)}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><Avatar name={l.owner?.name} /><span className="text-ink-500">{l.owner?.name.split(' ')[0] ?? '—'}</span></span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{timeAgo(l.lastContactedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{date(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm text-ink-500">
            <span>Page {leads.data?.page ?? 1} of {leads.data?.pages ?? 1}</span>
            <div className="flex gap-2">
              <button className="btn p-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <button className="btn p-1.5" disabled={page >= (leads.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
