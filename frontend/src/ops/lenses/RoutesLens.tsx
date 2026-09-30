import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { RouteData, RoutePreviewResponse, CongestionZone, WasteEventSummary } from '../../types/api.ts';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  Navigation,
  ArrowRight,
  RefreshCw,
  Zap,
  Sliders,
  Shield,
  Info,
} from 'lucide-react';

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

  // Fleet Configuration Modal / Panel State
  const [showConfig, setShowConfig] = useState(false);
  const [vehicleName, setVehicleName] = useState('North Ward Compactor A');
  const [registration, setRegistration] = useState('MH-02-CZ-9104');
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState(1000);
  const [streamFilter, setStreamFilter] = useState<'ALL' | 'DRY_RECYCLABLES' | 'WET_ORGANIC'>('ALL');
  const [timeBudgetMin, setTimeBudgetMin] = useState(180);

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
          handlePreviewRoute();
        }
      } catch (err) {
        console.warn('Could not load routes', err);
      }
    }
    loadActiveRoute();
  }, []);

  const getAcceptedCategories = () => {
    if (streamFilter === 'DRY_RECYCLABLES') {
      return ['PLASTIC', 'PAPER', 'GLASS', 'METAL'];
    }
    if (streamFilter === 'WET_ORGANIC') {
      return ['ORGANIC'];
    }
    return ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED'];
  };

  const handlePreviewRoute = async (zones = congestionZones) => {
    setLoading(true);
    setError(null);
    setReplanDelta(null);
    try {
      const res = await api.post<RoutePreviewResponse>('/routes/preview', {
        congestionZones: zones,
        vehicleConfig: {
          name: vehicleName,
          registration,
          capacityKg: vehicleCapacityKg,
          acceptedCategories: getAcceptedCategories(),
          maxRouteMinutes: timeBudgetMin,
        },
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
      if (err.code === 'PREVIEW_STALE' || err.code === 'DOUBLE_ASSIGNMENT_PREVENTED') {
        setError(`${err.message} Automatically refreshing route preview.`);
        await handlePreviewRoute();
      } else {
        setError(err.message || 'Route assignment failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Demonstration simulated congestion scenario
  const handleAddSimulatedCongestion = async () => {
    const newZone: CongestionZone = {
      id: `zone_${Date.now()}`,
      label: 'Simulated Roadworks Congestion',
      center: { lat: 19.208, lng: 72.878 },
      radiusM: 450,
      factor: 2.0,
    };

    const updatedZones = [newZone];
    setCongestionZones(updatedZones);

    if (route && (route.status === 'ASSIGNED' || route.status === 'IN_PROGRESS')) {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<any>(`/routes/${route.id}/replan`, {
          congestionZones: updatedZones,
          reason: 'Demonstration roadworks scenario (×2.0 congestion multiplier)',
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
          reason: 'Cleared congestion scenario',
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

  const capacityKg = route?.totals?.capacityKg || vehicleCapacityKg;
  const plannedLoadKg = route?.totals?.plannedLoadKg || 0;
  const loadPercentage = Math.min(100, Math.round((plannedLoadKg / capacityKg) * 100));

  return (
    <>
      {/* Left Rail: Route Summary, Capacity Bar & Deferred List */}
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[380px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner pb-56 sm:pb-56">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-lagoon" />
            <span className="font-serif text-sm font-bold text-ink">Collection Planner</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-2 py-0.5 rounded text-[10px] font-semibold border border-line bg-surface hover:bg-surface-2 text-ink-2 flex items-center gap-1"
            >
              <Sliders className="w-3 h-3 text-ink-3" />
              <span>Configure Fleet</span>
            </button>
            <span className="text-[10px] uppercase font-bold text-lagoon bg-lagoon-100 px-2 py-0.5 rounded-pill">
              {route?.status || 'Planning'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-clay-100 border border-clay/30 rounded text-clay flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Fleet Configuration Panel */}
          {showConfig && (
            <div className="p-3 bg-surface-2 rounded-card border border-lagoon/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-ink">Vehicle & Stream Parameters</span>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-[10px] text-ink-3 hover:text-ink"
                >
                  Close
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink mb-1">
                  Vehicle Name / Registration
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vehicleName}
                    onChange={(e) => setVehicleName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded border border-line bg-surface text-ink text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    className="w-24 px-2 py-1 rounded border border-line bg-surface text-ink text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-ink mb-1">
                    Payload Capacity (kg)
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={5000}
                    step={50}
                    value={vehicleCapacityKg}
                    onChange={(e) => setVehicleCapacityKg(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded border border-line bg-surface text-ink text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink mb-1">
                    Time Budget (min)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={480}
                    step={15}
                    value={timeBudgetMin}
                    onChange={(e) => setTimeBudgetMin(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded border border-line bg-surface text-ink text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink mb-1">
                  Accepted Collection Stream
                </label>
                <select
                  value={streamFilter}
                  onChange={(e) => setStreamFilter(e.target.value as any)}
                  className="w-full px-2 py-1 rounded border border-line bg-surface text-ink text-xs"
                >
                  <option value="ALL">All Compatible Ordinary Waste</option>
                  <option value="DRY_RECYCLABLES">Dry Recyclables Only (Plastic, Paper, Glass, Metal)</option>
                  <option value="WET_ORGANIC">Wet / Organic Collection Only</option>
                </select>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowConfig(false);
                  handlePreviewRoute();
                }}
                className="w-full py-1.5 bg-lagoon hover:bg-lagoon/90 text-surface font-semibold text-xs rounded shadow-sm"
              >
                Recalculate Route with Fleet Settings
              </button>
            </div>
          )}

          {/* Replan Notification Banner */}
          {replanDelta && (
            <div className="p-3 bg-ochre-100/60 border border-ochre/40 rounded-card space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <RefreshCw className="w-3.5 h-3.5 text-ochre animate-spin" />
                <span>Replanned After Congestion Scenario</span>
              </div>
              <p className="text-[11px] text-ink-2">
                Estimated duration: <b>{replanDelta.durationBeforeMin} min → {replanDelta.durationAfterMin} min</b>. Completed stops remained locked, remaining stops re-sequenced.
              </p>
            </div>
          )}

          {/* Vehicle Information */}
          <div className="p-3 bg-surface-2 rounded-card border border-line space-y-1">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">Configured Fleet</span>
            <div className="flex items-center justify-between font-semibold text-ink">
              <span>{route?.vehicle?.name || vehicleName}</span>
              <span className="font-mono text-xs">{capacityKg} kg</span>
            </div>
            <div className="text-[11px] text-ink-3">
              Depot: {route?.depot?.name || 'North Municipal Central Depot'}
            </div>
          </div>

          {/* Capacity Utilization Bar */}
          <div className="p-3 bg-surface-2 rounded-card border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-ink-3">Vehicle Capacity (0/1 Knapsack)</span>
              <span className="font-mono font-bold text-ink">
                {plannedLoadKg} / {capacityKg} kg ({loadPercentage}%)
              </span>
            </div>

            <div className="h-2.5 bg-line rounded-full overflow-hidden">
              <div
                style={{ width: `${loadPercentage}%` }}
                className={`h-full rounded-full transition-all ${
                  loadPercentage > 90 ? 'bg-clay' : loadPercentage > 70 ? 'bg-ochre' : 'bg-moss'
                }`}
              />
            </div>
            <p className="text-[10px] text-ink-3">
              Items chosen to maximise priority points within usable payload capacity.
            </p>
          </div>

          {/* Planned vs Baseline Comparison */}
          {baseline && (
            <div className="p-3 bg-surface-2 rounded-card border border-line space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-ink">
                <span>Optimised Plan</span>
                <span className="font-mono text-moss font-bold">
                  {route?.totals?.durationMin} min · {Math.round((route?.totals?.distanceM || 0) / 100) / 10} km
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-ink-3">
                <span>Naive FIFO Order</span>
                <span className="font-mono line-through">
                  {baseline.naiveDurationMin} min · {Math.round((baseline.naiveDistanceM || 0) / 100) / 10} km
                </span>
              </div>
              <p className="text-[10px] text-moss-700 font-medium">
                Saves ≈ {Math.max(0, baseline.naiveDurationMin - (route?.totals?.durationMin || 0))} min road travel using priority 2-opt sequencing.
              </p>
            </div>
          )}

          {/* Honest Routing Notice */}
          <div className="p-2.5 bg-surface rounded border border-line text-[11px] text-ink-3 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-ink-2">
              <Info className="w-3.5 h-3.5 text-lagoon shrink-0" />
              <span>Routing Source: {route?.costSource === 'OSRM' ? 'OSRM Road Network Matrix' : 'Distance Detour Estimate'}</span>
            </div>
            <p>
              Estimates represent road travel times. Turn-by-turn road geometry is drawn on Leaflet. Live GPS traffic is demonstrated via the controlled roadworks scenario below.
            </p>
          </div>

          {/* Simulated Congestion Control */}
          <div className="p-3 bg-surface-2 rounded-card border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-ink">Demonstration Traffic Scenario</span>
              {congestionZones.length > 0 && (
                <span className="text-[10px] text-clay font-bold uppercase">Active ×2.0</span>
              )}
            </div>

            <div className="flex gap-2">
              {congestionZones.length === 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddSimulatedCongestion}
                  className="flex-1 py-1.5 bg-clay hover:bg-clay/90 text-surface font-semibold text-xs rounded shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Inject Simulated Roadworks</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleClearCongestion}
                  className="flex-1 py-1.5 bg-surface hover:bg-surface-2 border border-line text-ink font-semibold text-xs rounded flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Clear Congestion Scenario</span>
                </button>
              )}
            </div>
          </div>

          {/* Deferred / Excluded Stops List */}
          {route?.deferred && route.deferred.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-ink-3 block">
                Deferred from this Trip ({route.deferred.length})
              </span>

              {route.deferred.map((def, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-surface-2/80 rounded border border-line space-y-0.5"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-ink">
                      {events.find((e) => e.id === def.eventId)?.code || 'Incident'}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        def.reason === 'CAPACITY'
                          ? 'bg-ochre text-surface'
                          : def.reason === 'INCOMPATIBLE'
                          ? 'bg-plum text-surface'
                          : 'bg-ink-3 text-surface'
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

      {/* Bottom Route Dock: Horizontal Stop Sequence Ribbon */}
      {route && route.stops && route.stops.length > 0 && (
        <div className="absolute bottom-0 left-0 sm:left-[380px] right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line shadow-panel p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <span>Collection Sequence:</span>
              <span className="text-ink-3 font-normal">
                Depot → {route.stops.length} Stops → Depot
              </span>
            </span>

            <span className="text-[11px] text-ink-3">
              Total driving estimate: ≈ {route.totals.durationMin} min (road network)
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
                          if (ev) onSelectEvent(ev.id);
                        }}
                        className="mt-1.5 text-[10px] text-moss font-semibold hover:underline"
                      >
                        Resolve with Photo
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
