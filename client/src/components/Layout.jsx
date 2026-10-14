import { KanbanSquare, LayoutDashboard, LogOut, Plus, Upload, Users } from 'lucide-react';
import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import LeadDrawer from './LeadDrawer.jsx';
import LeadForm from './LeadForm.jsx';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/import', label: 'Import CSV', icon: Upload },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const leadId = params.get('lead');
  const creating = params.has('new');
  const closeParam = (key) => { const p = new URLSearchParams(params); p.delete(key); setParams(p, { replace: true }); };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-900 px-4 py-5 text-ink-200 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2 text-lg font-extrabold tracking-tight text-white">
          <img src="/favicon.svg" alt="" className="h-8 w-8" /> LeadFlow
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-ink-400 hover:bg-white/5 hover:text-ink-100'}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-xs capitalize text-ink-400">{user.role}</div>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-ink-400 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-100 bg-white/80 px-6 py-3 backdrop-blur">
          <nav className="flex gap-1 md:hidden">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `rounded-md px-2 py-1 text-xs font-semibold ${isActive ? 'bg-ink-100' : 'text-ink-500'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <button className="btn btn-primary" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('new', '1'); return n; })}>
            <Plus size={16} /> New lead
          </button>
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>

      {leadId && <LeadDrawer id={leadId} onClose={() => closeParam('lead')} />}
      {creating && <LeadForm onClose={() => closeParam('new')} />}
    </div>
  );
}
