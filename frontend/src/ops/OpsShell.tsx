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
import { NotificationCenter } from './notifications/NotificationCenter.tsx';
import { ActiveRoutePanel } from './route/ActiveRoutePanel.tsx';
import { useRouteSimulation } from './route/routeSimulation.ts';
import {
  WasteEventSummary,
  OperatorEventsResponse,
  RouteData,
  CongestionZone,
  ForecastCell,
  HotspotBlock,
} from '../types/api.ts';
import { LogOut, Table, MapPin, Layers } from 'lucide-react';

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

  // Events, blocks & ticker state
  const [events, setEvents] = useState<WasteEventSummary[]>([]);
  const [blocks, setBlocks] = useState<HotspotBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [tickerCounts, setTickerCounts] = useState<{
    reports: number;
    events: number;
    plannedStops: number;
  } | null>(null);

  // Selected event for drawer
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Focus location for smooth map flight
  const [focusLocation, setFocusLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  // Active route & congestion layers
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);

  // Forecast state
  const [forecastMode, setForecastMode] = useState<'NOW' | 'FORECAST'>('FORECAST');
  const [forecastCells, setForecastCells] = useState<ForecastCell[]>([]);
  const [historyCells, setHistoryCells] = useState<any[]>([]);

  // Fetch operator events, blocks and ticker counts
  const fetchEventsData = async () => {
    try {
      const res = await api.get<OperatorEventsResponse>('/complaints?includeResolved=true');
      setEvents(res.items || []);
      if (res.blocks) {
        setBlocks(res.blocks);
      }
      if (res.counts) {
        setTickerCounts(res.counts);
      }
    } catch (err) {
      console.warn('Failed to poll operator events', err);
    }
  };

  // Load existing active route or preview initially
  useEffect(() => {
    async function loadActiveRoute() {
      try {
        const res = await api.get<{ items: RouteData[] }>('/routes');
        if (res.items && res.items.length > 0) {
          const active = res.items[0];
          setActiveRoute(active);
          setCongestionZones(active.congestionZones || []);
        }
      } catch (err) {
        console.warn('Could not load routes', err);
      }
    }
    loadActiveRoute();
  }, []);

  // Initial load and 5s polling interval
  useEffect(() => {
    fetchEventsData();
    const interval = setInterval(fetchEventsData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live Route & Vehicle Simulation Controller
  const simulation = useRouteSimulation(activeRoute, events);

  // Geographic Quick Jump Targets
  const quickJumpTargets = [
    { label: 'Kanjurmarg', lat: 19.1325, lng: 72.9320, zoom: 14 },
    { label: 'Mira Road / Bhayandar', lat: 19.2930, lng: 72.8580, zoom: 13.5 },
    { label: 'Kalyan', lat: 19.2435, lng: 73.1360, zoom: 14 },
    { label: 'All Mumbai MMR', lat: 19.2071, lng: 72.9500, zoom: 11 },
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-paper font-sans">
      {/* Top Command Bar (56px) */}
      <header className="h-14 bg-surface border-b border-line shadow-sm z-30 flex items-center justify-between px-3 sm:px-6 shrink-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-ink text-surface font-serif text-lg font-bold flex items-center justify-center shadow-sm">
              C
            </div>
            <span className="font-serif text-lg font-bold text-ink hidden sm:inline">CivicClean</span>
          </div>

          {/* Lens Switcher: NOW · ROUTES · FORECAST · IMPACT */}
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
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold tracking-wider transition relative ${
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

        {/* Geographic Quick Jump Cluster Buttons */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-surface-2/60 border border-line text-[11px]">
          <span className="text-ink-3 text-[10px] uppercase font-bold flex items-center gap-1 mr-1">
            <MapPin className="w-3 h-3 text-lagoon" />
            <span>Hotspots:</span>
          </span>
          {quickJumpTargets.map((q) => (
            <button
              key={q.label}
              onClick={() => setFocusLocation({ lat: q.lat, lng: q.lng, zoom: q.zoom })}
              className="px-2 py-0.5 rounded bg-surface hover:bg-surface-2 border border-line text-ink-2 hover:text-ink font-medium transition text-[11px]"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Far Right: Header Ticker + Queue + Notifications + Profile */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Header Ticker: reports → cleanups → planned stops */}
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

          {/* Operator Notification Center with Badge & High-Priority Attention */}
          <NotificationCenter
            onSelectEvent={(eventId, coordinates) => {
              setSelectedEventId(eventId);
              if (coordinates) {
                setFocusLocation({ lat: coordinates.lat, lng: coordinates.lng, zoom: 16 });
              }
            }}
          />

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
        {/* Persistent Leaflet Map Canvas */}
        <CityMap
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(id) => setSelectedEventId(id)}
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={(b) => {
            setSelectedBlockId(b.id);
            setFocusLocation({ lat: b.center.lat, lng: b.center.lng, zoom: 15 });
          }}
          route={activeRoute}
          completedGeometry={simulation.completedGeometry}
          remainingGeometry={simulation.remainingGeometry}
          completedStopIds={simulation.completedStopIds}
          truckPosition={simulation.truckPosition}
          truckHeading={simulation.truckHeading}
          isTruckMoving={simulation.isPlaying}
          onSelectTruck={() => {
            setFocusLocation({
              lat: simulation.truckPosition[0],
              lng: simulation.truckPosition[1],
              zoom: 16,
            });
          }}
          congestionZones={congestionZones}
          focusLocation={focusLocation}
          forecastMode={activeLens === 'forecast' ? forecastMode : undefined}
          forecastCells={activeLens === 'forecast' ? forecastCells : []}
          historyCells={activeLens === 'forecast' ? historyCells : []}
          height="100%"
        />

        {/* Active Route Progress Panel (Floating Live Vehicle Dock) */}
        {activeRoute && (
          <ActiveRoutePanel
            route={activeRoute}
            events={events}
            simulation={simulation}
            onFocusTruck={() => {
              setFocusLocation({
                lat: simulation.truckPosition[0],
                lng: simulation.truckPosition[1],
                zoom: 16,
              });
            }}
            onFocusStop={(eventId) => {
              setSelectedEventId(eventId);
              const ev = events.find((e) => e.id === eventId);
              if (ev) {
                setFocusLocation({ lat: ev.location.lat, lng: ev.location.lng, zoom: 16 });
              }
            }}
          />
        )}

        {/* Active Lens Panels */}
        {activeLens === 'now' && (
          <NowLens
            events={events}
            onSelectEvent={(id) => {
              setSelectedEventId(id);
              const ev = events.find((e) => e.id === id);
              if (ev) setFocusLocation({ lat: ev.location.lat, lng: ev.location.lng, zoom: 16 });
            }}
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
            onSelectEvent={(id) => {
              setSelectedEventId(id);
              const ev = events.find((e) => e.id === id);
              if (ev) setFocusLocation({ lat: ev.location.lat, lng: ev.location.lng, zoom: 16 });
            }}
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

        {/* Waste Event Drawer Overlay */}
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
