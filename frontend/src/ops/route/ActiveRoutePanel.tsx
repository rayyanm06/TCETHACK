import React, { useState } from 'react';
import { RouteData, WasteEventSummary } from '../../types/api.ts';
import { RouteSimulationState } from './routeSimulation.ts';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Truck,
  ChevronDown,
  ChevronUp,
  Clock,
  Weight,
} from 'lucide-react';

interface ActiveRoutePanelProps {
  route: RouteData | null;
  events: WasteEventSummary[];
  simulation: RouteSimulationState;
  onFocusTruck: () => void;
  onFocusStop: (eventId: string) => void;
  onInjectCongestion?: () => void;
}

export const ActiveRoutePanel: React.FC<ActiveRoutePanelProps> = ({
  route,
  events,
  simulation,
  onFocusTruck,
  onFocusStop,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!route) return null;

  const totalStops = route.stops?.length || 0;
  const completedCount = simulation.completedStopIds.size;
  const remainingCount = Math.max(0, totalStops - completedCount);

  // Determine current and next stop descriptions
  let currentStopEvent: WasteEventSummary | undefined;
  let nextStopEvent: WasteEventSummary | undefined;

  const currentStopObj = route.stops.find((s) => simulation.completedStopIds.has(s.eventId) && !simulation.isCompleted);
  if (currentStopObj) {
    currentStopEvent = events.find((e) => e.id === currentStopObj.eventId);
  }

  const nextStopObj = route.stops.find((s) => !simulation.completedStopIds.has(s.eventId));
  if (nextStopObj) {
    nextStopEvent = events.find((e) => e.id === nextStopObj.eventId);
  }

  const capacityKg = route.totals?.capacityKg || 1000;
  const currentLoadKg = simulation.currentLoadKg;
  const loadPercentage = Math.min(100, Math.round((currentLoadKg / capacityKg) * 100));

  return (
    <aside
      className={`absolute bottom-4 right-4 z-30 w-[360px] max-w-[calc(100vw-2rem)] bg-surface/95 backdrop-blur-md border border-line rounded-card shadow-panel transition-all duration-300 font-sans ${
        isMinimized ? 'h-14 overflow-hidden' : ''
      }`}
    >
      {/* Top Banner / Header */}
      <div className="p-3 bg-surface-2/60 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-lagoon text-surface flex items-center justify-center shadow-sm">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-ink">
                {route.vehicle?.name || 'Truck-01'}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-lagoon-100 text-lagoon font-bold">
                SIMULATION
              </span>
            </div>
            <span className="text-[10px] text-ink-3">
              {simulation.isCompleted
                ? 'Trip Completed · Returned to Depot'
                : simulation.isPlaying
                ? 'Moving along road network'
                : 'Paused at coordinate'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onFocusTruck}
            title="Center Map on Truck"
            className="p-1.5 rounded hover:bg-surface border border-line text-ink-2 hover:text-ink text-xs flex items-center gap-1"
          >
            <Navigation className="w-3.5 h-3.5 text-lagoon" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded hover:bg-surface border border-line text-ink-3 hover:text-ink"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3 text-xs">
          {/* Progress Bar & Counter */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">
                Progress: {completedCount} / {totalStops} stops completed
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                {Math.round(((simulation.currentDistanceM / simulation.totalDistanceM) || 0) * 100)}% route
              </span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div
                style={{
                  width: `${Math.round(((simulation.currentDistanceM / simulation.totalDistanceM) || 0) * 100)}%`,
                }}
                className="h-full bg-lagoon rounded-full transition-all duration-300"
              />
            </div>
          </div>

          {/* Current & Next Stops Card */}
          <div className="p-2.5 bg-surface-2 rounded-card border border-line space-y-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-ink-3 block">Current Status</span>
              <div className="flex items-center justify-between text-ink mt-0.5">
                <span className="font-semibold truncate">
                  {currentStopEvent
                    ? `${currentStopEvent.code} · ${currentStopEvent.addressText || 'Operational Block'}`
                    : simulation.currentDistanceM <= 0
                    ? `At ${route.depot?.name || 'Central Depot'}`
                    : simulation.isCompleted
                    ? 'Returned to Central Depot'
                    : 'En Route between collection sectors'}
                </span>
                {currentStopEvent && (
                  <button
                    onClick={() => onFocusStop(currentStopEvent!.id)}
                    className="text-[10px] text-lagoon font-bold hover:underline shrink-0 ml-1"
                  >
                    View
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-line/60">
              <span className="text-[10px] uppercase font-bold text-ink-3 block">Next Target Stop</span>
              <div className="flex items-center justify-between text-ink mt-0.5">
                <span className="font-semibold text-lagoon truncate">
                  {nextStopEvent
                    ? `${nextStopEvent.code} (${nextStopEvent.estimatedWeightKg || 50} kg) · ${
                        nextStopEvent.addressText?.split(',')[0] || 'Next Sector'
                      }`
                    : 'Depot (Trip Finish)'}
                </span>
                {nextStopEvent && (
                  <button
                    onClick={() => onFocusStop(nextStopEvent!.id)}
                    className="text-[10px] text-lagoon font-bold hover:underline shrink-0 ml-1"
                  >
                    Focus
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-ink-3 mt-1">
                <span>Remaining: {remainingCount} stops</span>
                <span>
                  Est. driving: ≈ {route.totals?.durationMin || 0} min (road network)
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Capacity Meter */}
          <div className="p-2.5 bg-surface-2 rounded-card border border-line space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-2">
                <Weight className="w-3.5 h-3.5 text-ink-3" />
                <span>Usable Payload Capacity</span>
              </span>
              <span className="font-mono font-bold text-ink">
                {currentLoadKg} / {capacityKg} kg ({loadPercentage}%)
              </span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div
                style={{ width: `${loadPercentage}%` }}
                className={`h-full rounded-full transition-all duration-300 ${
                  loadPercentage > 90 ? 'bg-clay' : loadPercentage > 75 ? 'bg-ochre' : 'bg-moss'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-ink-3">
              <span>Remaining room: {simulation.remainingCapacityKg} kg</span>
              <span>Vehicle: {route.vehicle?.name?.split(' ')[0] || 'Truck A'}</span>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="pt-1 flex items-center justify-between gap-2">
            <button
              onClick={simulation.togglePlay}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition ${
                simulation.isPlaying
                  ? 'bg-ink text-surface hover:bg-ink/90'
                  : 'bg-moss hover:bg-moss-700 text-surface'
              }`}
            >
              {simulation.isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Truck</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>{simulation.isCompleted ? 'Replay Route' : 'Drive Route'}</span>
                </>
              )}
            </button>

            <button
              onClick={simulation.stepNextStop}
              title="Skip to next collection stop"
              className="py-1.5 px-2.5 rounded bg-surface hover:bg-surface-2 border border-line text-ink-2 hover:text-ink font-semibold text-xs flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Next Stop</span>
            </button>

            <button
              onClick={simulation.reset}
              title="Reset simulation to depot"
              className="p-1.5 rounded bg-surface hover:bg-surface-2 border border-line text-ink-3 hover:text-ink"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Speed Multiplier Pill */}
            <div className="flex rounded border border-line overflow-hidden text-[10px] font-mono">
              {[1, 3, 6].map((s) => (
                <button
                  key={s}
                  onClick={() => simulation.setSpeed(s)}
                  className={`px-1.5 py-1 ${
                    simulation.speed === s
                      ? 'bg-ink text-surface font-bold'
                      : 'bg-surface text-ink-3 hover:text-ink'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
