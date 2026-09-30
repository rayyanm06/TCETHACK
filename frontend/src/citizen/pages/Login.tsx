import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { ShieldCheck, UserCheck, ArrowRight, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, loginAsDemo } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        const user = await register(name, email, password);
        navigate(user.role === 'OPERATOR' ? '/ops' : '/');
      } else {
        const user = await login(email, password);
        navigate(user.role === 'OPERATOR' ? '/ops' : '/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async (role: 'OPERATOR' | 'CITIZEN', demoEmail?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const user = await loginAsDemo(role, demoEmail);
      navigate(user.role === 'OPERATOR' ? '/ops' : '/');
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-moss flex items-center justify-center text-surface font-serif text-2xl font-bold shadow-sm">
            C
          </div>
          <span className="font-serif text-3xl font-bold tracking-tight text-ink">CivicClean</span>
        </div>
        <p className="mt-2 text-center text-xs text-ink-3 uppercase tracking-wider font-semibold">
          Smart Waste Reporting & Municipal Collection Planning
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-6 shadow-sm border border-line rounded-card sm:px-10 survey-corner">
          {error && (
            <div className="mb-5 p-3.5 bg-clay-100 border border-clay/30 rounded-card flex items-start gap-2.5 text-xs text-clay">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asha K."
                  className="w-full px-3.5 py-2.5 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-lagoon"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-lagoon"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-lagoon"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 rounded-card bg-moss text-surface font-semibold text-sm hover:bg-moss-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-ink-2 hover:text-moss transition underline"
            >
              {isRegister ? 'Already have an account? Sign In' : 'New citizen? Create an account'}
            </button>
          </div>

          {/* Quick Demo Access Bar (§3.1) */}
          <div className="mt-8 pt-6 border-t border-line">
            <p className="text-[11px] uppercase font-bold tracking-wider text-ink-3 text-center mb-3">
              One-Click Demo Profiles
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickDemo('OPERATOR')}
                className="w-full py-2.5 px-3 rounded-card bg-surface-2 hover:bg-line/60 border border-line text-xs font-semibold text-ink flex items-center justify-center gap-2 transition"
              >
                <ShieldCheck className="w-4 h-4 text-lagoon" />
                <span>Continue as Demo Operator (Dilip)</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickDemo('CITIZEN', 'asha@civicclean.demo')}
                className="w-full py-2.5 px-3 rounded-card bg-surface-2 hover:bg-line/60 border border-line text-xs font-semibold text-ink flex items-center justify-center gap-2 transition"
              >
                <UserCheck className="w-4 h-4 text-moss" />
                <span>Continue as Asha K. (Seeded History & Credits)</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleQuickDemo('CITIZEN', 'ravi@civicclean.demo')}
                className="w-full py-2.5 px-3 rounded-card bg-surface-2 hover:bg-line/60 border border-line text-xs font-semibold text-ink flex items-center justify-center gap-2 transition"
              >
                <UserCheck className="w-4 h-4 text-ochre" />
                <span>Continue as Ravi M. (Fresh Live Report Demo)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
