import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { ForecastCell } from '../../types/api.ts';
import { Sparkles, Calendar, TrendingUp, Info, AlertCircle } from 'lucide-react';

interface ForecastLensProps {
  onForecastDataChanged: (
    mode: 'NOW' | 'FORECAST',
    forecastCells: ForecastCell[],
    historyCells: any[]
  ) => void;
}

export const ForecastLens: React.FC<ForecastLensProps> = ({ onForecastDataChanged }) => {
  const [data, setData] = useState<any>(null);
  const [mode, setMode] = useState<'NOW' | 'FORECAST'>('FORECAST');
  const [selectedWeek, setSelectedWeek] = useState<number>(13);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await api.get<any>('/analytics/hotspots');
        setData(res);
      } catch (err) {
        console.error('Failed to load hotspots', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  // Update map layer whenever mode or data changes
  useEffect(() => {
    if (!data || data.status === 'INSUFFICIENT_HISTORY' || !data.forecast) return;

    if (mode === 'FORECAST') {
      onForecastDataChanged('FORECAST', data.forecast.cells || [], []);
    } else {
      const maxHistoryWeek = (data.weeks || []).length;
      const weekIdx = Math.min(maxHistoryWeek, selectedWeek);
      const weekObj = data.weeks?.find((w: any) => w.weekIndex === weekIdx);
      onForecastDataChanged('NOW', [], weekObj?.cells || []);
    }
  }, [mode, selectedWeek, data]);

  if (loading) {
    return (
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[380px] bg-surface p-6 flex items-center justify-center">
        <span className="text-xs text-ink-3">Loading operational spatial analytics...</span>
      </aside>
    );
  }

  // Insufficient history state
  if (data?.status === 'INSUFFICIENT_HISTORY') {
    return (
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[380px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col p-5 space-y-4 survey-corner">
        <div className="flex items-center gap-1.5 font-serif text-sm font-bold text-ink">
          <TrendingUp className="w-4 h-4 text-plum" />
          <span>Operational Hotspot Analytics</span>
        </div>

        <div className="p-3.5 bg-surface-2 rounded-card border border-line space-y-2">
          <div className="flex items-center gap-2 text-ink font-bold text-xs">
            <Info className="w-4 h-4 text-lagoon" />
            <span>Accumulating Pilot Records</span>
          </div>
          <p className="text-xs text-ink-2 leading-relaxed">
            {data.message}
          </p>
          <div className="p-2 bg-surface rounded border border-line text-[11px] text-ink-3">
            <b>Complete historical weeks recorded:</b> {data.weeksAvailable || 0} / 3 minimum
          </div>
        </div>

        <div className="p-3 bg-plum-100/40 rounded border border-plum/30 text-xs text-plum space-y-1">
          <span className="font-bold block">Methodology & Transparency:</span>
          <p className="text-[11px] text-ink-2">
            Forecasting uses a weighted spatial moving average over complete weeks of reviewed public incidents. Household locations and the current incomplete week are strictly excluded from spatial hotspot predictions.
          </p>
        </div>

        <div className="text-[11px] text-ink-3">
          {data.liveThisWeek?.note}
        </div>
      </aside>
    );
  }

  const topZones = data?.forecast?.cells?.slice(0, 5) || [];
  const maxWeeks = (data?.weeks || []).length;

  return (
    <>
      {/* Left Rail: Predictive Hotspot Insights */}
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[380px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner pb-20">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-1.5 font-serif text-sm font-bold text-ink">
            <TrendingUp className="w-4 h-4 text-plum" />
            <span>Hotspot Analytics</span>
          </div>

          <div className="flex bg-surface-2 p-0.5 rounded border border-line">
            <button
              onClick={() => setMode('NOW')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                mode === 'NOW' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setMode('FORECAST')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                mode === 'FORECAST' ? 'bg-plum text-surface shadow-sm' : 'text-ink-3'
              }`}
            >
              Forecast
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Honest Disclosure Banner */}
          <div className="p-2.5 bg-plum-100/50 border border-plum/30 rounded text-[11px] text-plum flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{data?.label || 'Spatial moving average baseline forecast.'}</span>
          </div>

          {/* Top Predicted Zones */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">
              Top Predicted Hotspot Zones (Week {data?.forecast?.weekIndex})
            </span>

            {topZones.map((zone: any, idx: number) => (
              <div key={zone.cellId} className="p-2.5 bg-surface-2 rounded border border-line space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-ink">Zone {idx + 1} ({zone.cellId})</span>
                  <span className="text-plum font-mono">≈ {zone.expected} expected</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-3">
                  <span>Last 3 weeks activity:</span>
                  <span className="font-mono">
                    W-1: {zone.lastWeeks[0]} · W-2: {zone.lastWeeks[1]} · W-3: {zone.lastWeeks[2]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Model Card */}
          <div className="p-3 bg-surface rounded-card border border-line space-y-2">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">
              Model & Heuristic Disclosure
            </span>
            <p className="text-[11px] text-ink-2">
              <b>Method:</b> {data?.forecast?.method}
            </p>
            {data?.evaluation && (
              <div className="p-2 bg-surface-2 rounded border border-line text-[11px] font-mono text-ink-2">
                Held-out evaluation (Week {data.evaluation.heldOutWeek}):<br />
                • Model MAE: <b>{data.evaluation.maeModel}</b><br />
                • Naive Last-Week Baseline MAE: <b>{data.evaluation.maeLastWeek}</b>
              </div>
            )}
            <p className="text-[10px] text-ink-3 italic">
              Spatial aggregation of verified public incidents only. Private household locations are strictly excluded.
            </p>
          </div>
        </div>
      </aside>

      {/* Bottom Time Control Slider */}
      <div className="absolute bottom-4 left-0 sm:left-[380px] right-0 z-30 mx-4 sm:mx-6 bg-surface/90 backdrop-blur-md rounded-card border border-line shadow-panel p-3 max-w-xl">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <Calendar className="w-3.5 h-3.5 text-lagoon" />
            <span>Time Slider: {selectedWeek > maxWeeks ? `Forecast (Week ${selectedWeek})` : `Week ${selectedWeek}`}</span>
          </div>
          <span className="text-[11px] text-ink-3 font-mono">
            {selectedWeek > maxWeeks ? 'Predicted Activity' : 'Historical Data'}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={maxWeeks + 1}
          value={selectedWeek}
          onChange={(e) => {
            const val = Number(e.target.value);
            setSelectedWeek(val);
            if (val > maxWeeks) setMode('FORECAST');
            else setMode('NOW');
          }}
          className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-plum"
        />

        <div className="flex justify-between text-[10px] text-ink-3 mt-1 font-mono">
          <span>W1</span>
          {maxWeeks >= 6 && <span>W{Math.floor(maxWeeks / 2)}</span>}
          <span>W{maxWeeks}</span>
          <span className="font-bold text-plum">W{maxWeeks + 1} (Forecast)</span>
        </div>
      </div>
    </>
  );
};
