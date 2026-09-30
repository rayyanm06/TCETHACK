import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { HotspotAnalyticsResponse, ForecastCell } from '../../types/api.ts';
import { Sparkles, Calendar, TrendingUp, Info } from 'lucide-react';

interface ForecastLensProps {
  onForecastDataChanged: (
    mode: 'NOW' | 'FORECAST',
    forecastCells: ForecastCell[],
    historyCells: any[]
  ) => void;
}

export const ForecastLens: React.FC<ForecastLensProps> = ({ onForecastDataChanged }) => {
  const [data, setData] = useState<HotspotAnalyticsResponse | null>(null);
  const [mode, setMode] = useState<'NOW' | 'FORECAST'>('FORECAST');
  const [selectedWeek, setSelectedWeek] = useState<number>(13);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await api.get<HotspotAnalyticsResponse>('/analytics/hotspots');
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
    if (!data) return;

    if (mode === 'FORECAST') {
      onForecastDataChanged('FORECAST', data.forecast.cells, []);
    } else {
      // Historical mode: pick cells from selected week (or week 12 if 13 is selected)
      const weekIdx = Math.min(12, selectedWeek);
      const weekObj = data.weeks.find((w) => w.weekIndex === weekIdx);
      onForecastDataChanged('NOW', [], weekObj?.cells || []);
    }
  }, [mode, selectedWeek, data]);

  if (loading) {
    return (
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[360px] bg-surface p-6 flex items-center justify-center">
        <span className="text-xs text-ink-3">Computing predictive hotspot baseline...</span>
      </aside>
    );
  }

  const topZones = data?.forecast.cells.slice(0, 5) || [];

  return (
    <>
      {/* Left Rail: Predictive Hotspot Insights (§6.10) */}
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[360px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner pb-20">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-1.5 font-serif text-sm font-bold text-ink">
            <TrendingUp className="w-4 h-4 text-plum" />
            <span>Hotspot Analytics</span>
          </div>

          {/* NOW | FORECAST Segmented Toggle (§6.10) */}
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
          {/* Disclaimer Chip (§6.10 & §24) */}
          <div className="p-2.5 bg-plum-100/50 border border-plum/30 rounded text-[11px] text-plum flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Baseline forecast on synthetic historical data (12 weeks, ~120 unique incidents).</span>
          </div>

          {/* Top Predicted Zones */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">
              Top Predicted Hotspot Zones (Week 13)
            </span>

            {topZones.map((zone, idx) => (
              <div key={zone.cellId} className="p-2.5 bg-surface-2 rounded border border-line space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-ink">Zone {idx + 1} ({zone.cellId})</span>
                  <span className="text-plum font-mono">≈ {zone.expected} expected</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-3">
                  <span>Last 3 weeks activity:</span>
                  <span className="font-mono">
                    W12: {zone.lastWeeks[0]} · W11: {zone.lastWeeks[1]} · W10: {zone.lastWeeks[2]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Model Card (§6.10 & §16) */}
          <div className="p-3 bg-surface rounded-card border border-line space-y-2">
            <span className="text-[10px] uppercase font-bold text-ink-3 block">
              Evaluation & Baseline Model Card
            </span>
            <p className="text-[11px] text-ink-2">
              <b>Formula:</b> 0.5 · W12 + 0.3 · W11 + 0.2 · W10
            </p>
            <div className="p-2 bg-surface-2 rounded border border-line text-[11px] font-mono text-ink-2">
              Held-out week 12 evaluation:<br />
              • Model MAE: <b>{data?.evaluation?.maeModel}</b><br />
              • Last-week naive baseline MAE: <b>{data?.evaluation?.maeLastWeek}</b>
            </div>
            <p className="text-[10px] text-ink-3 italic">
              Computed directly on the seeded synthetic dataset without unvalidated marketing accuracy claims.
            </p>
          </div>
        </div>
      </aside>

      {/* Bottom Time Control Slider (§6.10) */}
      <div className="absolute bottom-4 left-0 sm:left-[360px] right-0 z-30 mx-4 sm:mx-6 bg-surface/90 backdrop-blur-md rounded-card border border-line shadow-panel p-3 max-w-xl">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <Calendar className="w-3.5 h-3.5 text-lagoon" />
            <span>Time Slider: {selectedWeek === 13 ? 'Week 13 (Forecast)' : `Week ${selectedWeek}`}</span>
          </div>
          <span className="text-[11px] text-ink-3 font-mono">
            {selectedWeek === 13 ? 'Predicted Activity' : 'Historical Data'}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={13}
          value={selectedWeek}
          onChange={(e) => {
            const val = Number(e.target.value);
            setSelectedWeek(val);
            if (val === 13) setMode('FORECAST');
            else setMode('NOW');
          }}
          className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-plum"
        />

        <div className="flex justify-between text-[10px] text-ink-3 mt-1 font-mono">
          <span>W1</span>
          <span>W4</span>
          <span>W8</span>
          <span>W12</span>
          <span className="font-bold text-plum">W13 (Forecast)</span>
        </div>
      </div>
    </>
  );
};
