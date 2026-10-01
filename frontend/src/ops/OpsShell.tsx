import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';
import { api } from '../lib/api.ts';
import { CityMap } from '../map/CityMap.tsx';
import { NowLens } from './lenses/NowLens.tsx';
import { RoutesLens } from './lenses/RoutesLens.tsx';
import { ForecastLens } from './lenses/ForecastLens.tsx';
import { ImpactLens } from './lenses/ImpactLens.tsx';
import { EventDrawer } from './drawer/EventDrawer.tsx';
import {
  WasteEventSummary,
  OperatorEventsResponse,
  RouteData,
  CongestionZone,
  ForecastCell,
} from '../types/api.ts';
import { LogOut, Table } from 'lucide-react';

export type LensMode = 'now' | 'routes' | 'forecast' | 'impact';

export const OpsShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Active lens derived from path
  const currentPath = location.pathname;
  let activeLens: LensMode = 'now';
  if (currentPath.includes('/routes')) activeLens = 'routes';
  else if (currentPath.includes('/forecast')) activeLens = 'forecast';
  else if (currentPath.includes('/impact')) activeLens = 'impact';

  // Events & ticker state
  const [events, setEvents] = useState<WasteEventSummary[]>([]);
  const [tickerCounts, setTickerCounts] = useState<{
    reports: number;
    events: number;
    plannedStops: number;
  } | null>(null);

  // Selected event for drawer
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Active route & congestion layers
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);

  // Forecast state
  const [forecastMode, setForecastMode] = useState<'NOW' | 'FORECAST'>('FORECAST');
  const [forecastCells, setForecastCells] = useState<ForecastCell[]>([]);
  const [historyCells, setHistoryCells] = useState<any[]>([]);

  // Fetch operator events and ticker counts
  const fetchEventsData = async () => {
    try {
      const res = await api.get<OperatorEventsResponse>('/complaints?includeResolved=true');
      setEvents(res.items || []);
      if (res.counts) {
        setTickerCounts(res.counts);
      }
    } catch (err) {
      console.warn('Failed to poll operator events', err);
    }
  };

  // Initial load and 5s polling interval
  useEffect(() => {
    fetchEventsData();
    const interval = setInterval(fetchEventsData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-paper">
      {/* Top Command Bar (56px) (§6.7) */}
      <header className="h-14 bg-surface border-b border-line shadow-sm z-30 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-ink text-surface font-serif text-lg font-bold flex items-center justify-center">
              C
            </div>
            <span className="font-serif text-lg font-bold text-ink hidden sm:inline">CivicClean</span>
          </div>

          {/* Lens Switcher: NOW · ROUTES · FORECAST · IMPACT (§6.7) */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'now', label: 'NOW', path: '/operator' },
              { id: 'routes', label: 'ROUTES', path: '/operator/routes' },
              { id: 'forecast', label: 'FORECAST', path: '/operator/forecast' },
              { id: 'impact', label: 'IMPACT', path: '/operator/impact' },
            ].map((lens) => {
              const isActive = activeLens === lens.id;
              return (
                <button
                  key={lens.id}
                  onClick={() => navigate(lens.path)}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wider transition relative ${
                    isActive
                      ? 'text-ink after:absolute after:bottom-[-10px] after:left-0 after:right-0 after:h-[2px] after:bg-ink'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {lens.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Far Right: Header Ticker + Queue + Profile */}
        <div className="flex items-center gap-4">
          {/* Header Ticker: reports → events → planned stops */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded bg-surface-2 border border-line text-xs font-mono font-semibold text-ink-2">
            {tickerCounts ? (
              <>
                <span className="text-ink">{tickerCounts.reports} reports</span>
                <span className="text-ink-3">→</span>
                <span className="text-ink">{tickerCounts.events} cleanups</span>
                <span className="text-ink-3">→</span>
                <span className="text-lagoon font-bold">{tickerCounts.plannedStops} planned stops</span>
              </>
            ) : (
              <span className="text-ink-3">Syncing operational data...</span>
            )}
          </div>

          <button
            onClick={() => navigate('/operator/queue')}
            title="Open Table Queue"
            className="p-1.5 rounded hover:bg-surface-2 text-ink-2 flex items-center gap-1 text-xs font-medium"
          >
            <Table className="w-4 h-4" />
            <span className="hidden sm:inline">Queue</span>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-line">
            <span className="text-xs font-semibold text-ink hidden md:inline">
              {user?.name || 'Operator Dilip'}
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign Out"
              className="p-1.5 rounded hover:bg-surface-2 text-ink-3 hover:text-clay"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Map Viewport with Lens Overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* Persistent Leaflet Map Canvas (§5.2) */}
        <CityMap
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(id) => setSelectedEventId(id)}
          route={activeLens === 'routes' ? activeRoute : null}
          congestionZones={activeLens === 'routes' ? congestionZones : []}
          forecastMode={activeLens === 'forecast' ? forecastMode : undefined}
          forecastCells={activeLens === 'forecast' ? forecastCells : []}
          historyCells={activeLens === 'forecast' ? historyCells : []}
          height="100%"
        />

        {/* Active Lens Panels */}
        {activeLens === 'now' && (
          <NowLens
            events={events}
            onSelectEvent={(id) => setSelectedEventId(id)}
            selectedEventId={selectedEventId}
          />
        )}

        {activeLens === 'routes' && (
          <RoutesLens
            events={events}
            onRouteChanged={(r, z) => {
              setActiveRoute(r);
              setCongestionZones(z);
            }}
            onSelectEvent={(id) => setSelectedEventId(id)}
          />
        )}

        {activeLens === 'forecast' && (
          <ForecastLens
            onForecastDataChanged={(m, fCells, hCells) => {
              setForecastMode(m);
              setForecastCells(fCells);
              setHistoryCells(hCells);
            }}
          />
        )}

        {activeLens === 'impact' && <ImpactLens />}

        {/* Waste Event Drawer Overlay (§6.8) */}
        {selectedEventId && (
          <EventDrawer
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
            onEventUpdated={fetchEventsData}
          />
        )}
      </div>
    </div>
  );
};
