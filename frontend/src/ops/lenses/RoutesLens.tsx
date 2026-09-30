import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { RouteData, RoutePreviewResponse, CongestionZone, WasteEventSummary } from '../../types/api.ts';
import { Truck, AlertTriangle, CheckCircle, Navigation, ArrowRight, RefreshCw, Zap } from 'lucide-react';
import { createStopTransitIcon } from '../../map/markerUtils.ts';

interface RoutesLensProps {
  events: WasteEventSummary[];
  onRouteChanged: (route: RouteData | null, zones: CongestionZone[]) => void;
  onSelectEvent: (id: string) => void;
}

export const RoutesLens: React.FC<RoutesLensProps> = ({ events, onRouteChanged, onSelectEvent }) => {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [baseline, setBaseline] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [replanDelta, setReplanDelta] = useState<any>(null);
  const [congestionZones, setCongestionZones] = useState<CongestionZone[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load existing active route or preview initial route
  useEffect(() => {
    async function loadActiveRoute() {
      try {
        const res = await api.get<{ items: RouteData[] }>('/routes');
        if (res.items && res.items.length > 0) {
          const active = res.items[0];
          setRoute(active);
          setCongestionZones(active.congestionZones || []);
          onRouteChanged(active, active.congestionZones || []);
        } else {
          // Auto-trigger preview
          handlePreviewRoute();
        }
      } catch (err) {
        console.warn('Could not load routes', err);
      }
    }
    loadActiveRoute();
  }, []);

  const handlePreviewRoute = async (zones = congestionZones) => {
    setLoading(true);
    setError(null);
    setReplanDelta(null);
    try {
      const res = await api.post<RoutePreviewResponse>('/routes/preview', {
        congestionZones: zones,
      });
      setRoute(res.route);
      setBaseline(res.baseline);
      onRouteChanged(res.route, zones);
    } catch (err: any) {
      setError(err.message || 'Route planning preview failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRoute = async () => {
    if (!route) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ route: RouteData }>(`/routes/${route.id}/assign`);
      setRoute(res.route);
      onRouteChanged(res.route, congestionZones);
    } catch (err: any) {
      setError(err.message || 'Route assignment failed.');
    } finally {
      setLoading(false);
    }
  };

  // One-click simulated congestion scenario (§6.9 & §15)
  const handleAddSimulatedCongestion = async () => {
    // Add a simulated congestion zone over the corridor (approx. 400m from depot)
    const newZone: CongestionZone = {
      id: `zone_${Date.now()}`,
      label: 'Station Road Major Roadworks',
      center: { lat: 19.208, lng: 72.878 },
      radiusM: 450,
      factor: 2.0,
    };

    const updatedZones = [newZone];
    setCongestionZones(updatedZones);

    if (route && (route.status === 'ASSIGNED' || route.status === 'IN_PROGRESS')) {
      // Replan remaining active route
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<any>(`/routes/${route.id}/replan`, {
          congestionZones: updatedZones,
          reason: 'Simulated roadworks congestion (×2.0)',
        });
        setRoute(res.route);
        setReplanDelta(res.delta);
        onRouteChanged(res.route, updatedZones);
      } catch (err: any) {
        setError(err.message || 'Replanning failed.');
      } finally {
        setLoading(false);
      }
    } else {
      // In preview mode, preview with new congestion
      handlePreviewRoute(updatedZones);
    }
  };

  const handleClearCongestion = async () => {
    setCongestionZones([]);
    setReplanDelta(null);
    if (route && (route.status === 'ASSIGNED' || route.status === 'IN_PROGRESS')) {
      setLoading(true);
      try {
        const res = await api.post<any>(`/routes/${route.id}/replan`, {
          congestionZones: [],
          reason: 'Cleared traffic congestion',
        });
        setRoute(res.route);
        onRouteChanged(res.route, []);
      } catch (err: any) {
        setError(err.message || 'Replanning failed.');
      } finally {
        setLoading(false);
      }
    } else {
      handlePreviewRoute([]);
    }
  };

  const handleMarkStopResolved = async (eventId: string) => {
    setLoading(true);
    try {
      await api.patch(`/complaints/${eventId}/status`, {
        to: 'RESOLVED',
        note: 'Cleared during scheduled collection stop.',
      });
      // Refresh active route
      if (route) {
        const res = await api.get<{ route: RouteData }>(`/routes/${route.id}`);
        setRoute(res.route);
        onRouteChanged(res.route, congestionZones);
      }
    } catch (err: any) {
      setError(err.message || 'Could not resolve stop.');
    } finally {
      setLoading(false);
    }
  };

  const capacityKg = route?.totals?.capacityKg || 1000;
  const plannedLoadKg = route?.totals?.plannedLoadKg || 0;
  const loadPercentage = Math.min(100, Math.round((plannedLoadKg / capacityKg) * 100));

  return (
    <>
      {/* Left Rail: Route Summary, Capacity Bar & Deferred List (§6.9) */}
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[360px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner pb-56 sm:pb-56">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-lagoon" />
            <span className="font-serif text-sm font-bold text-ink">Collection Planner</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-lagoon bg-lagoon-100 px-2 py-0.5 rounded-pill">
            {route?.status || 'Planning'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-clay-100 border border-clay/30 rounded text-clay flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Replan Notification Banner (§6.9 & §15) */}
          {replanDelta && (
            <div className="p-3 bg-ochre-100/60 border border-ochre/40 rounded-card space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <RefreshCw className="w-3.5 h-3.5 text-ochre animate-spin" />
                <span>Replanned After Congestion</span>
              </div>
              <p className="text-[11px] text-ink-2">
                Duration: <b>{replanDelta.durationBeforeMin} min → {replanDelta.durationAfterMin} min</b>. Completed stops remained locked, remaining stops re-sequenced.
              </p>
            </div>
          )}

          {/* Vehicle Information */}
          <div className="p-3 bg-surface-2 rounded-card border border-line space-y-1">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">Assigned Vehicle</span>
            <div className="flex items-center justify-between font-semibold text-ink">
              <span>{route?.vehicle?.name || 'Truck A (1000 kg Municipal)'}</span>
              <span className="font-mono text-xs">{capacityKg} kg</span>
            </div>
          </div>

          {/* Capacity Bar (§6.9 & §14) */}
          <div className="p-3 bg-surface rounded-card border border-line space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-ink">Vehicle Capacity Allocation</span>
              <span className="font-mono text-moss">{plannedLoadKg} / {capacityKg} kg</span>
            </div>

            <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden border border-line flex">
              <div
                style={{ width: `${loadPercentage}%` }}
                className={`h-full transition-all duration-500 ${
                  loadPercentage > 95 ? 'bg-ochre' : 'bg-moss'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-3">
              <span>{loadPercentage}% Utilized</span>
              <span>Remaining: {Math.max(0, capacityKg - plannedLoadKg)} kg</span>
            </div>
          </div>

          {/* Route Metrics Summary */}
          {route && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 bg-surface-2 rounded border border-line">
                <span className="text-[10px] uppercase text-ink-3 block">Estimated Time</span>
                <span className="font-serif text-base font-bold text-ink">
                  {route.totals.durationMin} min
                </span>
                {route.trafficMode === 'SIMULATED' && (
                  <span className="text-[9px] text-clay block font-bold">SIMULATED CONGESTION</span>
                )}
              </div>
              <div className="p-2.5 bg-surface-2 rounded border border-line">
                <span className="text-[10px] uppercase text-ink-3 block">Total Distance</span>
                <span className="font-serif text-base font-bold text-ink">
                  {(route.totals.distanceM / 1000).toFixed(1)} km
                </span>
                <span className="text-[9px] text-ink-3 block">Road Travel Times</span>
              </div>
            </div>
          )}

          {/* Simulated Traffic Controls (§6.9 & §15) */}
          <div className="p-3 bg-surface rounded-card border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-ink-3">
                Simulated Traffic
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-clay-100 text-clay">
                SIMULATED — not live traffic
              </span>
            </div>

            {congestionZones.length === 0 ? (
              <button
                type="button"
                onClick={handleAddSimulatedCongestion}
                className="w-full py-2 px-3 rounded bg-ochre-100 text-ochre hover:bg-ochre/20 font-semibold text-xs border border-ochre/30 flex items-center justify-center gap-1.5 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate Congestion on Busiest Leg (×2.0)</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="p-2 bg-clay-100/50 rounded border border-clay/30 text-[11px] text-clay font-medium flex items-center justify-between">
                  <span>{congestionZones[0].label} (×{congestionZones[0].factor})</span>
                  <button
                    onClick={handleClearCongestion}
                    className="underline text-[10px] font-bold text-ink-2"
                  >
                    Clear
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddSimulatedCongestion}
                  className="w-full py-2 bg-lagoon hover:bg-lagoon/90 text-surface rounded font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replan Remaining Route</span>
                </button>
              </div>
            )}
          </div>

          {/* Deferred Stops with Explicit Reasons (§6.9 & §14) */}
          {route?.deferred && route.deferred.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-ink-3 block">
                Deferred Stops ({route.deferred.length})
              </span>
              {route.deferred.map((def, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-surface-2 rounded border border-line text-[11px] space-y-0.5"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-ink">
                      {events.find((e) => e.id === def.eventId)?.code || 'Event'}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        def.reason === 'CAPACITY' ? 'bg-ochre text-surface' : 'bg-plum text-surface'
                      }`}
                    >
                      {def.reason}
                    </span>
                  </div>
                  <p className="text-ink-3 text-[10px]">{def.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Primary Action Button */}
          {route?.status === 'DRAFT' && (
            <button
              onClick={handleAssignRoute}
              disabled={loading}
              className="w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded-card shadow flex items-center justify-center gap-2"
            >
              <span>Assign This Route to Crew</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Bottom Route Dock: Horizontal Stop Sequence Ribbon (§6.9) */}
      {route && route.stops && route.stops.length > 0 && (
        <div className="absolute bottom-0 left-0 sm:left-[360px] right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line shadow-panel p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>Collection Sequence:</span>
              <span className="text-ink-3 font-normal">
                Depot → {route.stops.length} Stops → Depot
              </span>
            </span>

            <span className="text-[11px] text-ink-3">
              ETA to completion: ≈ {route.totals.durationMin} min
            </span>
          </div>

          {/* Horizontal Stops Ribbon */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1">
            {/* Depot Start Badge */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-8 h-8 rounded bg-ink text-surface flex items-center justify-center font-bold text-xs border border-surface shadow">
                D
              </div>
              <span className="text-[10px] text-ink-3 mt-1 font-semibold">Depot</span>
            </div>

            {route.stops.map((stop, idx) => {
              const ev = events.find((e) => e.id === stop.eventId);
              const isDone = stop.state === 'DONE';

              return (
                <React.Fragment key={idx}>
                  <div className="w-6 h-[1.5px] bg-line shrink-0" />
                  <div
                    onClick={() => ev && onSelectEvent(ev.id)}
                    className={`flex flex-col items-center shrink-0 p-2 rounded-card border transition cursor-pointer ${
                      isDone
                        ? 'bg-moss-100/60 border-moss/40'
                        : 'bg-surface border-line hover:border-lagoon shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold font-mono ${
                          isDone ? 'bg-moss text-surface' : 'bg-lagoon text-surface'
                        }`}
                      >
                        {isDone ? '✓' : stop.seq}
                      </div>
                      <span className="font-mono text-xs font-bold text-ink">
                        {ev?.code || `S-${stop.seq}`}
                      </span>
                    </div>

                    <div className="text-[10px] text-ink-3 flex items-center gap-1">
                      <span>{stop.weightKg} kg</span>
                      <span>·</span>
                      <span>+{stop.arrivalOffsetMin}m</span>
                    </div>

                    {!isDone && route.status !== 'DRAFT' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkStopResolved(stop.eventId);
                        }}
                        className="mt-1.5 text-[10px] text-moss font-semibold hover:underline"
                      >
                        Mark Cleared
                      </button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Depot Return Badge */}
            <div className="w-6 h-[1.5px] bg-line shrink-0" />
            <div className="flex flex-col items-center shrink-0">
              <div className="w-8 h-8 rounded bg-ink text-surface flex items-center justify-center font-bold text-xs border border-surface shadow">
                D
              </div>
              <span className="text-[10px] text-ink-3 mt-1 font-semibold">Return</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
