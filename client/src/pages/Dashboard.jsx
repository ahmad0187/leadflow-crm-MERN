import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CircleDollarSign, Percent, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar, Empty, ScoreBadge, StageBadge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { money, sourceLabel, stageOf } from '../lib/format.js';

const STAGE_HEX = { new: '#0ea5e9', contacted: '#6366f1', qualified: '#8b5cf6', proposal: '#f59e0b', won: '#10b981', lost: '#fb7185' };
const SOURCE_HEX = ['#6a45f5', '#10b981', '#0ea5e9', '#f59e0b', '#fb7185', '#8a889e', '#14b8a6'];

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-500"><Icon size={16} className="text-brand-600" />{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-ink-400">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api('/stats') });
  const hot = useQuery({ queryKey: ['leads', 'hot'], queryFn: () => api('/leads?status=open&sort=-score&limit=5') });
  if (stats.isLoading) return <p className="text-sm text-ink-400">Loading…</p>;
  if (stats.isError) return <Empty title="Couldn't load the dashboard">{stats.error.message}</Empty>;
  const s = stats.data;
  if (!s.totals.leads) return <Empty title="No leads yet">Add your first lead with <b>New lead</b>, or <Link className="text-brand-700 underline" to="/import">import a CSV</Link>.</Empty>;

  const open = hot.data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-sm text-ink-500">{s.totals.leads} leads · {s.totals.openDeals} open deals</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CircleDollarSign} label="Open pipeline" value={money(s.totals.openPipelineValue, true)} sub={`${s.totals.openDeals} deals in progress`} />
        <Kpi icon={TrendingUp} label="Won this month" value={money(s.totals.wonThisMonth, true)} sub={`Avg deal ${money(s.totals.avgDealSize)}`} />
        <Kpi icon={Percent} label="Win rate" value={`${s.totals.winRate}%`} sub="of closed deals" />
        <Kpi icon={AlarmClock} label="Follow-ups due" value={s.totals.followUpsDue} sub="today or overdue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="mb-4 font-bold">Pipeline value by stage</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.byStage.map((x) => ({ ...x, label: stageOf(x.stage).label }))} margin={{ left: 8 }}>
              <CartesianGrid vertical={false} stroke="#eceaf3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5d5b73' }} />
              <YAxis tickFormatter={(v) => money(v, true)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#8a889e' }} width={64} />
              <Tooltip formatter={(v, _n, p) => [`${money(v)} · ${p.payload.count} deals`, 'Value']} cursor={{ fill: '#f6f5fa' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{s.byStage.map((x) => <Cell key={x.stage} fill={STAGE_HEX[x.stage]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Leads by source</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={s.bySource.map((x) => ({ ...x, label: sourceLabel(x.source) }))} dataKey="count" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                {s.bySource.map((x, i) => <Cell key={x.source} fill={SOURCE_HEX[i % SOURCE_HEX.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="mb-4 font-bold">New vs won, last 6 months</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.monthly}>
              <CartesianGrid vertical={false} stroke="#eceaf3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5d5b73' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#8a889e' }} width={32} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="created" name="New leads" stroke="#6a45f5" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="won" name="Deals won" stroke="#10b981" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Hottest open leads</h2>
          <ul className="divide-y divide-ink-100">
            {open.map((l) => (
              <li key={l.id}>
                <Link to={`?lead=${l.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <ScoreBadge value={l.score?.value} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="truncate text-xs text-ink-400">{l.company}</p></div>
                  <StageBadge stage={l.stage} />
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 mt-5 font-bold">Top performers</h2>
          <ul className="space-y-2">
            {s.leaderboard.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm"><Avatar name={u.name} /><span className="flex-1 font-semibold">{u.name}</span><span className="text-ink-500">{u.won} won · {money(u.wonValue, true)}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
