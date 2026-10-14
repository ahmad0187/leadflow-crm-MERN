import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { SOURCES, sourceLabel, STAGES } from '../lib/format.js';
import { FieldError, Modal } from './ui.jsx';

const EMPTY = { name: '', company: '', email: '', phone: '', website: '', source: 'website', stage: 'new', value: '', tags: '', notes: '', owner: '' };

/** Create a lead (no `lead` prop) or edit one. */
export default function LeadForm({ lead, onClose }) {
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const users = useQuery({ queryKey: ['users'], queryFn: () => api('/users').then((d) => d.users) });
  const [form, setForm] = useState(lead ? {
    ...EMPTY, ...lead, value: lead.value ?? '', tags: (lead.tags || []).join(', '), owner: lead.owner?.id ?? '',
  } : EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name, company: form.company, email: form.email, phone: form.phone, website: form.website,
        source: form.source, stage: form.stage, value: Number(form.value || 0), notes: form.notes,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        ...(form.owner ? { owner: form.owner } : lead ? { owner: null } : {}),
      };
      return lead ? api(`/leads/${lead.id}`, { method: 'PATCH', body }) : api('/leads', { method: 'POST', body });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['lead', d.lead.id] });
      onClose();
      if (!lead) setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); n.set('lead', d.lead.id); return n; });
    },
  });
  const fields = save.error?.fields;

  return (
    <Modal title={lead ? 'Edit lead' : 'New lead'} onClose={onClose} wide>
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="f-name">Name *</label><input id="f-name" className="input" value={form.name} onChange={set('name')} autoFocus /><FieldError fields={fields} name="name" /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="f-company">Company</label><input id="f-company" className="input" value={form.company} onChange={set('company')} /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="f-email">Email</label><input id="f-email" className="input" type="email" value={form.email} onChange={set('email')} /><FieldError fields={fields} name="email" /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="f-phone">Phone</label><input id="f-phone" className="input" value={form.phone} onChange={set('phone')} /></div>
        <div><label className="label" htmlFor="f-value">Deal value (USD)</label><input id="f-value" className="input" type="number" min="0" step="50" value={form.value} onChange={set('value')} /><FieldError fields={fields} name="value" /></div>
        <div><label className="label" htmlFor="f-source">Source</label>
          <select id="f-source" className="input" value={form.source} onChange={set('source')}>{SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select></div>
        <div><label className="label" htmlFor="f-stage">Stage</label>
          <select id="f-stage" className="input" value={form.stage} onChange={set('stage')}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div><label className="label" htmlFor="f-owner">Owner</label>
          <select id="f-owner" className="input" value={form.owner} onChange={set('owner')}>
            <option value="">{lead ? 'Unassigned' : 'Me'}</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></div>
        <div className="col-span-2"><label className="label" htmlFor="f-tags">Tags <span className="font-normal">(comma separated)</span></label><input id="f-tags" className="input" value={form.tags} onChange={set('tags')} placeholder="website, urgent" /></div>
        <div className="col-span-2"><label className="label" htmlFor="f-notes">Notes</label><textarea id="f-notes" className="input min-h-24" value={form.notes} onChange={set('notes')} /></div>
        {save.error && !fields?.length && <p className="col-span-2 text-sm text-rose-600">{save.error.message}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : lead ? 'Save changes' : 'Create lead'}</button>
        </div>
      </form>
    </Modal>
  );
}
