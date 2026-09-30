import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { ShieldCheck, UserCheck, ArrowRight, AlertCircle, Info, KeyRound, UserPlus } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();

  // Tab: 'CITIZEN' | 'OPERATOR'
  const initialRole = searchParams.get('role') === 'operator' ? 'OPERATOR' : 'CITIZEN';
  const [activeTab, setActiveTab] = useState<'CITIZEN' | 'OPERATOR'>(initialRole);

  // Sub-mode for citizen: 'SIGN_IN' | 'REGISTER'
  const [citizenMode, setCitizenMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');

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
      if (activeTab === 'CITIZEN' && citizenMode === 'REGISTER') {
        const user = await register(name, email, password);
        navigate('/');
      } else {
        const user = await login(email, password);
        navigate(user.role === 'OPERATOR' ? '/ops' : '/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-card bg-moss flex items-center justify-center text-surface font-serif text-2xl font-bold shadow-sm">
            C
          </div>
          <span className="font-serif text-3xl font-bold tracking-tight text-ink">CivicClean</span>
        </div>
        <p className="mt-2 text-xs font-semibold text-ink-3 uppercase tracking-wider">
          Smart Waste Reporting & Municipal Collection Management
        </p>
        <p className="mt-1 text-xs text-ink-2 max-w-sm mx-auto">
          Kandivali East / Borivali East Pilot · Bridging citizen reporting with capacity-constrained collection logistics.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Role Tab Navigation */}
        <div className="flex rounded-card bg-surface-2 p-1 border border-line mb-4 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CITIZEN');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition ${
              activeTab === 'CITIZEN'
                ? 'bg-surface text-ink shadow-sm border border-line'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <UserCheck className="w-4 h-4 text-moss" />
            <span>Citizen Portal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('OPERATOR');
              setCitizenMode('SIGN_IN');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition ${
              activeTab === 'OPERATOR'
                ? 'bg-surface text-ink shadow-sm border border-line'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-lagoon" />
            <span>Municipal Operator</span>
          </button>
        </div>

        {/* Card Body */}
        <div className="bg-surface py-7 px-6 shadow-sm border border-line rounded-card sm:px-8 survey-corner space-y-5">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">
              {activeTab === 'CITIZEN'
                ? citizenMode === 'REGISTER'
                  ? 'Create Citizen Account'
                  : 'Citizen Sign In'
                : 'Municipal Officer Sign In'}
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">
              {activeTab === 'CITIZEN'
                ? citizenMode === 'REGISTER'
                  ? 'Join your local cleanup pilot to report waste and track resolution.'
                  : 'Sign in to report waste, support active cleanups, and view your impact.'
                : 'Restricted to authorized municipal inspectors and routing supervisors.'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-clay-100 border border-clay/30 rounded text-xs text-clay flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {activeTab === 'CITIZEN' && citizenMode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priyesh Patel"
                  className="w-full px-3 py-2 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-moss"
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
                placeholder={activeTab === 'OPERATOR' ? 'officer@mumbai.gov.in' : 'citizen@example.com'}
                className="w-full px-3 py-2 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-lagoon"
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
                className="w-full px-3 py-2 rounded-card border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-lagoon"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full mt-2 py-2.5 px-4 rounded-card text-surface font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 ${
                activeTab === 'OPERATOR'
                  ? 'bg-lagoon hover:bg-lagoon-700'
                  : 'bg-moss hover:bg-moss-700'
              }`}
            >
              <span>
                {activeTab === 'CITIZEN'
                  ? citizenMode === 'REGISTER'
                    ? 'Register & Get Started'
                    : 'Sign In as Citizen'
                  : 'Sign In as Operator'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Citizen Toggle between Sign In and Register */}
          {activeTab === 'CITIZEN' && (
            <div className="pt-2 text-center border-t border-line">
              {citizenMode === 'SIGN_IN' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCitizenMode('REGISTER');
                    setError(null);
                  }}
                  className="text-xs text-moss hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New to CivicClean? Create a citizen account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCitizenMode('SIGN_IN');
                    setError(null);
                  }}
                  className="text-xs text-ink-2 hover:underline font-semibold"
                >
                  Already have an account? Sign In
                </button>
              )}
            </div>
          )}

          {/* Operator Access Notice */}
          {activeTab === 'OPERATOR' && (
            <div className="pt-2 border-t border-line">
              <div className="p-3 bg-surface-2 rounded border border-line text-xs text-ink-2 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-ink">
                  <KeyRound className="w-3.5 h-3.5 text-lagoon" />
                  <span>Authorized Personnel Only</span>
                </div>
                <p className="text-[11px] text-ink-3 leading-relaxed">
                  Operator access is restricted to authorized field coordinators and dispatch supervisors. Account provisioning is managed by project administrators.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Evaluation Disclaimer */}
        <p className="text-center text-[11px] text-ink-3 mt-4">
          PS03 Research & Evaluation Pilot · Kandivali East & Borivali East Study Sector.
        </p>
      </div>
    </div>
  );
};
