import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FieldError } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  if (user) return <Navigate to="/" replace />;

  const action = mode === 'login' ? login : register;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    action.mutate(mode === 'login' ? { email: form.email, password: form.password } : form);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5 text-lg font-extrabold"><img src="/favicon.svg" alt="" className="h-8 w-8" /> LeadFlow</div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Know which lead to call next,<br /><span className="text-brand-200">and what to say.</span></h1>
          <p className="mt-4 max-w-md text-ink-400">A sales pipeline with AI lead scoring, drafted follow-ups and a clear view of where every deal stands.</p>
        </div>
        <p className="text-sm text-ink-500">MongoDB · Express · React · Node.js</p>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          {mode === 'register' && (
            <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" value={form.name} onChange={set('name')} /><FieldError fields={action.error?.fields} name="name" /></div>
          )}
          <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" /><FieldError fields={action.error?.fields} name="email" /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" className="input" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><FieldError fields={action.error?.fields} name="password" /></div>
          {action.error && !action.error.fields?.length && <p className="text-sm text-rose-600">{action.error.message}</p>}
          <button className="btn btn-primary w-full py-2.5" disabled={action.isPending}>{action.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          {mode === 'login' && (
            <button type="button" className="btn w-full" onClick={() => login.mutate({ email: 'admin@leadflow.dev', password: 'demo1234' })}>Use the demo account</button>
          )}
          <p className="text-center text-sm text-ink-500">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
