import { closestCorners, DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Empty, ScoreBadge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { money, stageOf, timeAgo } from '../lib/format.js';

function Card({ lead, overlay = false }) {
  return (
    <div className={`rounded-lg border border-ink-100 bg-white p-3 text-left shadow-card ${overlay ? 'rotate-2 shadow-xl' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{lead.name}</p>
          <p className="truncate text-xs text-ink-500">{lead.company || '—'}</p>
        </div>
        <ScoreBadge value={lead.score?.value} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-bold">{money(lead.value)}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-400">{timeAgo(lead.lastContactedAt)}<Avatar name={lead.owner?.name} /></span>
      </div>
    </div>
  );
}

function SortableCard({ lead, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { stage: lead.stage } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes} {...listeners} onClick={() => onOpen(lead.id)} className="cursor-grab active:cursor-grabbing">
      <Card lead={lead} />
    </div>
  );
}

function Column({ stage, leads, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}`, data: { stage } });
  const s = stageOf(stage);
  const total = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-ink-100/60">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <h2 className="text-sm font-bold">{s.label}</h2>
        <span className="rounded-md bg-white px-1.5 text-xs font-semibold text-ink-500">{leads.length}</span>
        <span className="ml-auto text-xs font-semibold text-ink-500">{money(total, true)}</span>
      </div>
      <div ref={setNodeRef} className={`flex min-h-32 flex-1 flex-col gap-2 rounded-b-xl p-2 transition ${isOver ? 'bg-brand-50' : ''}`}>
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((l) => <SortableCard key={l.id} lead={l} onOpen={onOpen} />)}
        </SortableContext>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const qc = useQueryClient();
  const [, setParams] = useSearchParams();
  const [mine, setMine] = useState(false);
  const [active, setActive] = useState(null);
  const key = ['pipeline', mine];
  const board = useQuery({ queryKey: key, queryFn: () => api(`/leads/pipeline${mine ? '?owner=me' : ''}`) });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const move = useMutation({
    mutationFn: ({ id, stage, position }) => api(`/leads/${id}/move`, { method: 'PATCH', body: { stage, position } }),
    onMutate: async ({ id, stage, position }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      // Optimistic update so the card lands instantly.
      qc.setQueryData(key, (old) => {
        const lead = old.stages.flatMap((c) => c.leads).find((l) => l.id === id);
        const stages = old.stages.map((c) => ({ ...c, leads: c.leads.filter((l) => l.id !== id) }));
        const col = stages.find((c) => c.stage === stage);
        col.leads.splice(position, 0, { ...lead, stage });
        return { stages };
      });
      return { prev };
    },
    onError: (err, _v, ctx) => { qc.setQueryData(key, ctx.prev); alert(err.message); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['stats'] }); qc.invalidateQueries({ queryKey: ['leads'] }); },
  });

  if (board.isLoading) return <p className="text-sm text-ink-400">Loading…</p>;
  if (board.isError) return <Empty title="Couldn't load the pipeline">{board.error.message}</Empty>;
  const columns = board.data.stages;
  const all = columns.flatMap((c) => c.leads);

  const onDragEnd = ({ active: a, over }) => {
    setActive(null);
    if (!over) return;
    const lead = all.find((l) => l.id === a.id);
    const stage = over.data.current?.stage ?? lead.stage;
    const col = columns.find((c) => c.stage === stage).leads.filter((l) => l.id !== a.id);
    const overIndex = col.findIndex((l) => l.id === over.id);
    const position = overIndex === -1 ? col.length : overIndex;
    const current = columns.find((c) => c.stage === lead.stage).leads.findIndex((l) => l.id === a.id);
    if (stage === lead.stage && position === current) return;
    move.mutate({ id: a.id, stage, position });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Pipeline</h1><p className="text-sm text-ink-500">Drag cards between stages. Click a card for details and AI suggestions.</p></div>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-ink-500"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-brand-600" /> Only my leads</label>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={({ active: a }) => setActive(all.find((l) => l.id === a.id))} onDragCancel={() => setActive(null)} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((c) => <Column key={c.stage} stage={c.stage} leads={c.leads} onOpen={(id) => setParams({ lead: id })} />)}
        </div>
        <DragOverlay>{active ? <Card lead={active} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
