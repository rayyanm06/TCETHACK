import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { Home, ClipboardList, Plus, Award, LogOut, Shield } from 'lucide-react';

export const CitizenShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between pb-20 md:pb-6">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-line px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/citizen" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-moss flex items-center justify-center text-surface font-serif text-lg font-bold shadow-xs">
                C
              </div>
              <div>
                <span className="font-serif text-lg font-bold text-ink leading-tight block">CivicClean</span>
                <span className="text-[10px] text-ink-3 tracking-wide uppercase font-semibold">Field Pilot Portal</span>
              </div>
            </NavLink>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink
                to="/citizen"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-semibold rounded transition ${
                    isActive ? 'bg-surface-2 text-ink shadow-xs border border-line' : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/citizen/reports"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-semibold rounded transition ${
                    isActive ? 'bg-surface-2 text-ink shadow-xs border border-line' : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                My Reports
              </NavLink>
              <NavLink
                to="/citizen/impact"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-semibold rounded transition ${
                    isActive ? 'bg-surface-2 text-ink shadow-xs border border-line' : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                Impact
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop +Report Quick Action */}
            <NavLink
              to="/citizen/report"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-moss hover:bg-moss-700 text-surface text-xs font-semibold rounded-card shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Report Waste</span>
            </NavLink>

            <span className="text-xs font-medium text-ink-2 hidden sm:inline">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-full hover:bg-surface-2 text-ink-3 hover:text-clay transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport: Spacious desktop layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Mobile-only Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/98 backdrop-blur-md border-t border-line shadow-panel px-6 py-2">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <NavLink
            to="/citizen"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-bold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/citizen/reports"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-bold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <ClipboardList className="w-5 h-5" />
            <span>Reports</span>
          </NavLink>

          {/* Central Raised ＋Report Action */}
          <NavLink
            to="/citizen/report"
            className="flex flex-col items-center -mt-5"
          >
            <div className="w-12 h-12 rounded-full bg-moss hover:bg-moss-700 text-surface flex items-center justify-center shadow-lg transition transform active:scale-95">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-bold text-moss mt-0.5">Report</span>
          </NavLink>

          <NavLink
            to="/citizen/impact"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-bold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <Award className="w-5 h-5" />
            <span>Impact</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
