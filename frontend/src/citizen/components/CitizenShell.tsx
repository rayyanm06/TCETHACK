import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { Home, ClipboardList, Plus, Award, LogOut } from 'lucide-react';

export const CitizenShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-line px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-moss flex items-center justify-center text-surface font-serif text-lg font-bold">
              C
            </div>
            <div>
              <span className="font-serif text-lg font-bold text-ink leading-tight block">CivicClean</span>
              <span className="text-[10px] text-ink-3 tracking-wide uppercase font-semibold">Citizen Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 sm:px-6">
        <Outlet />
      </main>

      {/* Mobile-first Bottom Navigation Tab Bar (§5.1 & §7.6) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line shadow-panel px-6 py-2 md:max-w-2xl md:mx-auto md:bottom-3 md:rounded-panel md:border">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-semibold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-semibold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <ClipboardList className="w-5 h-5" />
            <span>Reports</span>
          </NavLink>

          {/* Central Raised ＋Report Action */}
          <NavLink
            to="/report"
            className="flex flex-col items-center -mt-5"
          >
            <div className="w-12 h-12 rounded-full bg-moss hover:bg-moss-700 text-surface flex items-center justify-center shadow-lg transition transform active:scale-95">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-semibold text-moss mt-0.5">Report</span>
          </NavLink>

          <NavLink
            to="/impact"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] font-medium transition ${
                isActive ? 'text-moss font-semibold' : 'text-ink-3 hover:text-ink'
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
