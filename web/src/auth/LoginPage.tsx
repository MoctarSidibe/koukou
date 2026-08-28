import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bird, Lock, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { getStoredUser } from '../api/client';
import { useEffect } from 'react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getStoredUser()) navigate('/app');
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Impossible de contacter le serveur. Réessayez plus tard.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-950 via-slate-900 to-emerald-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white">
            <Bird className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">KouKou</h1>
          <p className="text-sm text-slate-500">
            Console de pilotage avicole
          </p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Téléphone ou e-mail
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="+241 6x xx xx xx"
                autoComplete="username"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}