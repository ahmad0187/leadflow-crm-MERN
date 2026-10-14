import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bot, Copy, Mail, MessageSquare, Pencil, Phone, Sparkles, StickyNote, Trash2, Users, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { date, money, sourceLabel, STAGES, stageOf, timeAgo } from '../lib/format.js';
import LeadForm from './LeadForm.jsx';
import { Avatar, ScoreBadge, StageBadge } from './ui.jsx';

const ACTIVITY_ICONS = { note: StickyNote, call: Phone, email: Mail, meeting: Users, stage_change: ArrowRight, created: Zap, ai: Bot };
const LOG_TYPES = [['note', 'Note'], ['call', 'Call'], ['email', 'Email'], ['meeting', 'Meeting']];

export default function LeadDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => api(`/leads/${id}`) });
  const [editing, setEditing] = useState(false);
  const [logType, setLogType] = useState('note');
  const [logBody, setLogBody] = useState('');
  const [email, setEmail] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !editing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);
  useEffect(() => { setEmail(null); }, [id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lead', id] });
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['pipeline'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };
  const setStage = useMutation({ mutationFn: (stage) => api(`/leads/${id}`, { method: 'PATCH', body: { stage } }), onSuccess: refresh });
  const addLog = useMutation({
    mutationFn: () => api(`/leads/${id}/activities`, { method: 'POST', body: { type: logType, body: logBody } }),
    onSuccess: () => { setLogBody(''); refresh(); },
  });
  const score = useMutation({ mutationFn: () => api(`/leads/${id}/score`, { method: 'POST' }), onSuccess: refresh });
  const draft = useMutation({ mutationFn: () => api(`/leads/${id}/draft-email`, { method: 'POST', body: {} }), onSuccess: (d) => setEmail(d.email) });
  const remove = useMutation({ mutationFn: () => api(`/leads/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); onClose(); } });

  const lead = q.data?.lead;
  const canEdit = q.data?.canEdit;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink-900/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col bg-white shadow-2xl" aria-label="Lead details">
        {!lead ? (
          <div className="grid flex-1 place-items-center text-sm text-ink-400">{q.isError ? q.error.message : 'Loading…'}</div>
        ) : (
          <>
            <div className="flex items-start gap-4 border-b border-ink-100 p-5">
              <ScoreBadge value={lead.score?.value} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-extrabold tracking-tight">{lead.name}</h2>
                <p className="truncate text-sm text-ink-500">{lead.company || 'No company'} · {sourceLabel(lead.source)}</p>
                <div className="mt-2 flex items-center gap-2"><StageBadge stage={lead.stage} /><span className="text-sm font-bold">{money(lead.value)}</span></div>
              </div>
              <button className="btn btn-ghost p-1.5" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s) => (
                  <button key={s.id} disabled={!canEdit || setStage.isPending} onClick={() => setStage.mutate(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${lead.stage === s.id ? `${stageOf(s.id).chip} ring-1 ring-current` : 'bg-ink-50 text-ink-500 hover:bg-ink-100'} disabled:cursor-not-allowed`}>
                    {s.label}
                  </button>
                ))}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[['Email', lead.email ? <a className="text-brand-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'],
                  ['Phone', lead.phone || '—'], ['Owner', lead.owner ? <span className="inline-flex items-center gap-2"><Avatar name={lead.owner.name} />{lead.owner.name}</span> : 'Unassigned'],
                  ['Last contacted', timeAgo(lead.lastContactedAt)], ['Created', date(lead.createdAt)], ['Follow up', date(lead.nextFollowUp)]]
                  .map(([k, v]) => (<div key={k}><dt className="text-xs font-semibold text-ink-400">{k}</dt><dd className="mt-0.5 truncate">{v}</dd></div>))}
              </dl>
              {lead.tags?.length > 0 && <div className="flex flex-wrap gap-1.5">{lead.tags.map((t) => <span key={t} className="rounded-md bg-ink-50 px-2 py-0.5 text-xs font-semibold text-ink-500">#{t}</span>)}</div>}
              {lead.notes && <p className="whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{lead.notes}</p>}

              <section className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-900"><Sparkles size={16} className="text-brand-600" /> AI assistant</div>
                {lead.score?.value != null && (
                  <div className="mb-3 text-sm">
                    <p className="font-semibold">Score {lead.score.value}/100 <span className="font-normal text-ink-400">· {lead.score.by === 'claude' ? 'Claude' : 'rules'} · {timeAgo(lead.score.updatedAt)}</span></p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-500">{lead.score.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    {lead.score.nextAction && <p className="mt-2 rounded-lg bg-white px-3 py-2 font-semibold text-brand-900 ring-1 ring-brand-100">Next: {lead.score.nextAction}</p>}
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn" onClick={() => score.mutate()} disabled={score.isPending}><Bot size={15} />{score.isPending ? 'Scoring…' : 'Re-score lead'}</button>
                  <button className="btn" onClick={() => draft.mutate()} disabled={draft.isPending}><Mail size={15} />{draft.isPending ? 'Writing…' : 'Draft follow-up email'}</button>
                </div>
                {email && (
                  <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-brand-100">
                    <p className="font-bold">{email.subject}</p>
                    <p className="mt-2 whitespace-pre-wrap text-ink-700">{email.body}</p>
                    <button className="btn mt-3" onClick={async () => { await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                      <Copy size={14} />{copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">Activity</h3>
                <form className="mb-4 rounded-xl border border-ink-100 p-3" onSubmit={(e) => { e.preventDefault(); if (logBody.trim()) addLog.mutate(); }}>
                  <div className="mb-2 flex gap-1">{LOG_TYPES.map(([t, l]) => (
                    <button type="button" key={t} onClick={() => setLogType(t)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${logType === t ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-50'}`}>{l}</button>))}
                  </div>
                  <textarea className="input min-h-16" placeholder={logType === 'note' ? 'Add a note…' : `What happened on the ${logType}?`} value={logBody} onChange={(e) => setLogBody(e.target.value)} aria-label="Activity details" />
                  <div className="mt-2 flex justify-end"><button className="btn btn-primary" disabled={!logBody.trim() || addLog.isPending}><MessageSquare size={14} /> Log {logType}</button></div>
                </form>
                <ol className="relative space-y-4 border-l border-ink-100 pl-5">
                  {q.data.activities.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
                    return (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[29px] grid h-6 w-6 place-items-center rounded-full bg-white ring-1 ring-ink-200"><Icon size={12} className="text-ink-500" /></span>
                        <p className="text-sm"><span className="font-semibold capitalize">{a.type.replace('_', ' ')}</span>{a.body ? <span className="text-ink-700">: {a.body}</span> : null}</p>
                        <p className="text-xs text-ink-400">{a.user?.name ?? 'System'} · {timeAgo(a.createdAt)}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <div className="flex gap-2 border-t border-ink-100 p-4">
              {canEdit && <button className="btn" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>}
              <div className="flex-1" />
              {canEdit && <button className="btn text-rose-600" onClick={() => window.confirm(`Delete ${lead.name}? This also deletes the activity history.`) && remove.mutate()}><Trash2 size={14} /> Delete</button>}
            </div>
          </>
        )}
      </aside>
      {editing && lead && <LeadForm lead={lead} onClose={() => setEditing(false)} />}
    </>
  );
}
