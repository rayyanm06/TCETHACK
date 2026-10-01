import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { ShieldCheck, UserCheck, ArrowRight, AlertCircle, KeyRound, UserPlus, Check } from 'lucide-react';
import { CivicCityScene } from '../components/landing/CivicCityScene.tsx';
import { GarbageTruck } from '../components/landing/GarbageTruck.tsx';
import { ReportParcel } from '../components/landing/ReportParcel.tsx';

type TransitionPhase =
  | 'idle'
  | 'authenticating'
  | 'confirmed'
  | 'transforming'
  | 'truck_entering'
  | 'collecting'
  | 'driving_away'
  | 'revealing_dashboard';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, register, isFirebaseConfigured } = useAuth();

  // Tab: 'CITIZEN' | 'OPERATOR'
  const initialRole = searchParams.get('role') === 'operator' ? 'OPERATOR' : 'CITIZEN';
  const [activeTab, setActiveTab] = useState<'CITIZEN' | 'OPERATOR'>(initialRole);

  // Sub-mode for citizen: 'SIGN_IN' | 'REGISTER'
  const [citizenMode, setCitizenMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Animation & Transition State Machine
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [targetDestination, setTargetDestination] = useState<string>('/citizen');
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Redirect if already logged in and idle
  useEffect(() => {
    if (user && phase === 'idle') {
      navigate(user.role === 'OPERATOR' ? '/operator' : '/citizen', { replace: true });
    }
  }, [user, phase, navigate]);

  const addTimeout = (fn: () => void, delayMs: number) => {
    const timer = setTimeout(fn, delayMs);
    timeoutsRef.current.push(timer);
    return timer;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== 'idle') return;

    setError(null);
    setPhase('authenticating');

    try {
      let authenticatedUser;
      if (activeTab === 'CITIZEN' && citizenMode === 'REGISTER') {
        authenticatedUser = await register(name, email, password);
      } else {
        authenticatedUser = await login(email, password);
      }

      // Determine authenticated destination
      const destination = authenticatedUser.role === 'OPERATOR' ? '/operator' : '/citizen';
      setTargetDestination(destination);

      // Check prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        // Fast, accessible transition for reduced-motion users
        setPhase('confirmed');
        addTimeout(() => {
          navigate(destination);
        }, 400);
        return;
      }

      // --- CINEMATIC TRANSITION SEQUENCE (Total ~3.4s) ---

      // Stage 1: Login Confirmed (0.00s - 0.35s)
      setPhase('confirmed');

      // Stage 2: Login card visually compresses into civic collection object (0.35s - 1.00s)
      addTimeout(() => {
        setPhase('transforming');
      }, 350);

      // Stage 3: Garbage collection truck enters from the road (0.85s - 1.50s)
      addTimeout(() => {
        setPhase('truck_entering');
      }, 850);

      // Stage 4: Collection interaction — hydraulic lift into container (1.45s - 2.05s)
      addTimeout(() => {
        setPhase('collecting');
      }, 1450);

      // Stage 5: Truck drives forward into the scene with parallax depth (2.05s - 3.10s)
      addTimeout(() => {
        setPhase('driving_away');
      }, 2050);

      // Stage 6: Camera zooms into vanishing point & reveals dashboard (2.95s - 3.55s)
      addTimeout(() => {
        setPhase('revealing_dashboard');
      }, 2950);

      // Handoff to actual dashboard route
      addTimeout(() => {
        navigate(destination);
      }, 3450);

      // Safety fallback timer to prevent hung UI
      addTimeout(() => {
        navigate(destination);
      }, 4200);

    } catch (err: any) {
      // On authentication failure:
      // STRICT REQUIREMENT: Normal error message remains, NO cinematic animation.
      setPhase('idle');
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  const isTransitioning = phase !== 'idle' && phase !== 'authenticating';

  return (
    <div className="relative w-full min-h-screen h-screen overflow-hidden bg-[#F5F1E8] font-sans flex flex-col justify-between">
      {/* 1. ILLUSTRATED VECTOR CITY ENVIRONMENT */}
      <CivicCityScene phase={phase} />

      {/* 2. PERSPECTIVE ROAD TRANSITION OVERLAY */}
      {/* Truck and Parcel Animation Stage */}
      <div
        className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
        style={{ perspective: '1000px' }}
      >
        {/* A. Civic Collection Parcel (Created when card compresses) */}
        {(phase === 'transforming' ||
          phase === 'truck_entering' ||
          phase === 'collecting' ||
          phase === 'driving_away') && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-[26%] sm:bottom-[24%] md:left-[42%] md:bottom-[22%] z-20 pointer-events-none transition-all"
            style={{
              transition:
                phase === 'collecting'
                  ? 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'all 0.8s cubic-bezier(0.2, 0.8, 0.4, 1)',
              transform:
                phase === 'collecting'
                  ? 'translate(-40px, -70px) scale(0.4) rotate(14deg)'
                  : phase === 'driving_away'
                  ? 'translate(-40px, -70px) scale(0) opacity(0)'
                  : 'translate(0, 0) scale(1)',
              opacity: phase === 'driving_away' ? 0 : 1,
            }}
          >
            <ReportParcel
              role={activeTab}
              isLifting={phase === 'collecting'}
              className="w-56 sm:w-64"
            />
          </div>
        )}

        {/* B. Stylized Municipal Garbage Truck */}
        {(phase === 'truck_entering' ||
          phase === 'collecting' ||
          phase === 'driving_away' ||
          phase === 'revealing_dashboard') && (
          <div
            className="absolute z-30 pointer-events-none w-[280px] sm:w-[380px] md:w-[460px]"
            style={{
              left: '50%',
              bottom: '15%',
              transformOrigin: 'center bottom',
              transition:
                phase === 'truck_entering'
                  ? 'transform 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out'
                  : phase === 'collecting'
                  ? 'transform 0.4s ease-out'
                  : phase === 'driving_away' || phase === 'revealing_dashboard'
                  ? 'transform 1.4s cubic-bezier(0.45, 0, 0.55, 1), opacity 1.4s ease-in'
                  : 'none',
              transform:
                phase === 'truck_entering'
                  ? 'translate(-65%, 0) scale(1)'
                  : phase === 'collecting'
                  ? 'translate(-65%, -2px) scale(1)'
                  : phase === 'driving_away'
                  ? 'translate(-10%, -220px) scale(0.22) rotate(-3deg)'
                  : 'translate(20%, -300px) scale(0.08) rotate(-4deg)',
              opacity: phase === 'revealing_dashboard' ? 0.3 : 1,
            }}
          >
            <GarbageTruck
              phase={
                phase === 'truck_entering'
                  ? 'entering'
                  : phase === 'collecting'
                  ? 'collecting'
                  : phase === 'driving_away'
                  ? 'driving'
                  : 'vanished'
              }
            />
          </div>
        )}
      </div>

      {/* 3. MAIN UI CONTAINER & EDITORIAL LOGIN CARD */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between py-4 px-3 sm:px-6 lg:px-8 pointer-events-auto max-w-full overflow-x-hidden">
        {/* CivicClean Branding Banner */}
        <header
          className={`w-full max-w-md mx-auto text-center transition-all duration-700 ${
            isTransitioning ? 'opacity-0 -translate-y-8 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="inline-flex items-center justify-center gap-2 bg-[#FBF9F4]/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-[#D8D1C5] shadow-sm mb-1.5">
            <div className="w-6 h-6 rounded-md bg-[#236B4F] flex items-center justify-center text-[#FFFFFF] font-serif text-base font-bold shadow-sm">
              C
            </div>
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#17211D]">
              CivicClean
            </span>
          </div>

          <h1 className="text-[10px] sm:text-[11px] font-bold text-[#164635] uppercase tracking-wider block drop-shadow-sm px-2">
            Smart Waste Reporting & Municipal Collection Planning
          </h1>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#53615B] max-w-xs sm:max-w-sm mx-auto">
            Greater Mumbai Operations · Municipal Operations System
          </p>
        </header>

        {/* Center Card Stage */}
        <main className="flex-1 flex items-center justify-center px-1 my-1 w-full max-w-[360px] sm:max-w-md mx-auto">
          <div
            className="w-full transition-all mx-auto"
            style={{
              transition: 'all 0.85s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: isTransitioning
                ? 'translateY(160px) scale(0.12) rotate(-4deg)'
                : 'translateY(0) scale(1) rotate(0deg)',
              opacity: isTransitioning ? 0 : 1,
              pointerEvents: isTransitioning ? 'none' : 'auto',
            }}
          >
            {/* Role Tab Navigation */}
            <div className="flex rounded-md bg-[#FBF9F4] p-1 border border-[#D8D1C5] mb-2.5 shadow-sm">
              <button
                type="button"
                id="tab-citizen"
                onClick={() => {
                  setActiveTab('CITIZEN');
                  setError(null);
                }}
                className={`flex-1 py-1.5 sm:py-2 px-1 text-[11px] sm:text-xs font-semibold rounded flex items-center justify-center gap-1 sm:gap-1.5 transition ${
                  activeTab === 'CITIZEN'
                    ? 'bg-[#FFFFFF] text-[#17211D] shadow-sm border border-[#D8D1C5]'
                    : 'text-[#53615B] hover:text-[#17211D]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#236B4F] shrink-0" />
                <span className="truncate">Citizen Portal</span>
              </button>

              <button
                type="button"
                id="tab-operator"
                onClick={() => {
                  setActiveTab('OPERATOR');
                  setCitizenMode('SIGN_IN');
                  setError(null);
                }}
                className={`flex-1 py-1.5 sm:py-2 px-1 text-[11px] sm:text-xs font-semibold rounded flex items-center justify-center gap-1 sm:gap-1.5 transition ${
                  activeTab === 'OPERATOR'
                    ? 'bg-[#FFFFFF] text-[#17211D] shadow-sm border border-[#D8D1C5]'
                    : 'text-[#53615B] hover:text-[#17211D]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#164635] shrink-0" />
                <span className="truncate">Municipal Operator</span>
              </button>
            </div>

            {/* Login Information Panel */}
            <div className="bg-[#FBF9F4] py-5 px-4 sm:py-6 sm:px-8 border border-[#D8D1C5] rounded-[10px] shadow-[0_4px_20px_rgba(23,33,29,0.08)] space-y-3.5 relative">
              {/* Subtle top indicator bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 rounded-t-[9px] transition-colors ${
                  activeTab === 'OPERATOR' ? 'bg-[#164635]' : 'bg-[#236B4F]'
                }`}
              />

              <div>
                <h2 className="font-serif text-lg font-bold text-[#17211D]">
                  {activeTab === 'CITIZEN'
                    ? citizenMode === 'REGISTER'
                      ? 'Create Citizen Account'
                      : 'Citizen Sign In'
                    : 'Municipal Officer Sign In'}
                </h2>
                <p className="text-xs text-[#53615B] mt-0.5 leading-relaxed">
                  {activeTab === 'CITIZEN'
                    ? citizenMode === 'REGISTER'
                      ? 'Join the local pilot to report waste and track verifiable cleanup.'
                      : 'Sign in to submit reports, track collection status, and view verified impact.'
                    : 'Restricted to authorized field coordinators and collection dispatch supervisors.'}
                </p>
              </div>

              {/* Firebase Configuration Warning */}
              {!isFirebaseConfigured && (
                <div
                  id="firebase-config-warning"
                  className="p-3 bg-[#FEF3C7] border border-[#D97706]/40 rounded text-xs text-[#92400E] flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                  <span>
                    <strong>Firebase setup required:</strong> Add your Web App configuration keys for project <code>civiclean</code> to <code>.env.local</code>.
                  </span>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div
                  id="login-error-alert"
                  className="p-3 bg-[#F6DDD5] border border-[#C4492F]/30 rounded text-xs text-[#C4492F] flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form className="space-y-3.5" onSubmit={handleSubmit}>
                {activeTab === 'CITIZEN' && citizenMode === 'REGISTER' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#53615B] uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Priyesh Patel"
                      className="w-full px-3 py-2 rounded-md border border-[#D8D1C5] bg-[#FFFFFF] text-[#17211D] text-sm focus:outline-none focus:ring-2 focus:ring-[#236B4F]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#53615B] uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="login-email-input"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      activeTab === 'OPERATOR'
                        ? 'officer@mumbai.gov.in'
                        : 'citizen@example.com'
                    }
                    className="w-full px-3 py-2 rounded-md border border-[#D8D1C5] bg-[#FFFFFF] text-[#17211D] text-sm focus:outline-none focus:ring-2 focus:ring-[#236B4F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#53615B] uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="login-password-input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-md border border-[#D8D1C5] bg-[#FFFFFF] text-[#17211D] text-sm focus:outline-none focus:ring-2 focus:ring-[#236B4F]"
                  />
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  id="login-submit-button"
                  disabled={phase !== 'idle'}
                  className={`w-full mt-2 py-2.5 px-4 rounded-md text-[#FFFFFF] font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                    phase === 'confirmed'
                      ? 'bg-[#164635] scale-[1.02]'
                      : phase === 'authenticating'
                      ? 'bg-[#236B4F]/80 cursor-wait'
                      : activeTab === 'OPERATOR'
                      ? 'bg-[#164635] hover:bg-[#113629]'
                      : 'bg-[#236B4F] hover:bg-[#164635]'
                  }`}
                >
                  {phase === 'confirmed' ? (
                    <>
                      <Check className="w-4 h-4 text-[#DCE9E1]" />
                      <span>✓ Signed in</span>
                    </>
                  ) : phase === 'authenticating' ? (
                    <span>
                      {activeTab === 'CITIZEN' && citizenMode === 'REGISTER'
                        ? 'Creating account...'
                        : 'Signing in...'}
                    </span>
                  ) : (
                    <>
                      <span>
                        {activeTab === 'CITIZEN'
                          ? citizenMode === 'REGISTER'
                            ? 'Register & Get Started'
                            : 'Sign In as Citizen'
                          : 'Sign In as Operator'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Citizen Toggle between Sign In and Register */}
              {activeTab === 'CITIZEN' && (
                <div className="pt-2 text-center border-t border-[#D8D1C5]">
                  {citizenMode === 'SIGN_IN' ? (
                    <button
                      type="button"
                      id="toggle-register-button"
                      onClick={() => {
                        setCitizenMode('REGISTER');
                        setError(null);
                      }}
                      className="text-xs text-[#236B4F] hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>New to CivicClean? Create a citizen account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="toggle-signin-button"
                      onClick={() => {
                        setCitizenMode('SIGN_IN');
                        setError(null);
                      }}
                      className="text-xs text-[#53615B] hover:underline font-semibold"
                    >
                      Already have an account? Sign In
                    </button>
                  )}
                </div>
              )}

              {/* Operator Access Notice */}
              {activeTab === 'OPERATOR' && (
                <div className="pt-2 border-t border-[#D8D1C5]">
                  <div className="p-3 bg-[#EFEBE0] rounded-md border border-[#D8D1C5] text-xs text-[#53615B] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#17211D]">
                      <KeyRound className="w-3.5 h-3.5 text-[#164635]" />
                      <span>Authorized Municipal Dispatch</span>
                    </div>
                    <p className="text-[11px] text-[#53615B] leading-relaxed">
                      Officer credentials provide verified queue management and vehicle routing access. Provisioned securely by pilot administrators.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Editorial Footer */}
        <footer
          className={`text-center text-[11px] text-[#53615B] transition-opacity duration-700 ${
            isTransitioning ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <span>PS03 Research & Evaluation Pilot · Greater Mumbai Municipal Service Sector</span>
        </footer>
      </div>

      {/* 4. DASHBOARD REVEAL IRIS / SCENE FADE */}
      <div
        className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-700"
        style={{
          opacity: phase === 'revealing_dashboard' ? 1 : 0,
          backgroundColor: '#F5F1E8',
        }}
      />
    </div>
  );
};
