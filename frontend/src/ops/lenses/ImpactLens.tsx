import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { Award, Users, CheckCircle, FileText } from 'lucide-react';

export const ImpactLens: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImpact() {
      try {
        const res = await api.get<any>('/impact/leaderboard');
        setData(res);
      } catch (err) {
        console.error('Failed to load aggregate impact', err);
      } finally {
        setLoading(false);
      }
    }
    loadImpact();
  }, []);

  if (loading) {
    return (
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[360px] bg-surface p-6 flex items-center justify-center">
        <span className="text-xs text-ink-3">Loading citizen impact aggregates...</span>
      </aside>
    );
  }

  const { aggregate, contributors } = data || { aggregate: {}, contributors: [] };

  return (
    <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[360px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner pb-6">
      <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
        <div className="flex items-center gap-1.5 font-serif text-sm font-bold text-ink">
          <Award className="w-4 h-4 text-moss" />
          <span>Citizen Impact Overview</span>
        </div>
        <span className="text-[10px] text-ink-3 uppercase font-semibold">Operator View Only</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 bg-surface-2 rounded border border-line">
            <span className="text-[10px] uppercase text-ink-3 block">Unique Incidents</span>
            <span className="font-serif text-lg font-bold text-ink">
              {aggregate.uniqueEventsIdentified || 0}
            </span>
          </div>
          <div className="p-2.5 bg-surface-2 rounded border border-line">
            <span className="text-[10px] uppercase text-ink-3 block">Confirmations</span>
            <span className="font-serif text-lg font-bold text-lagoon">
              {aggregate.supportingConfirmations || 0}
            </span>
          </div>
          <div className="p-2.5 bg-surface-2 rounded border border-line">
            <span className="text-[10px] uppercase text-ink-3 block">Resolved Piles</span>
            <span className="font-serif text-lg font-bold text-moss">
              {aggregate.resolvedThroughCitizenReports || 0}
            </span>
          </div>
          <div className="p-2.5 bg-surface-2 rounded border border-line">
            <span className="text-[10px] uppercase text-ink-3 block">Verified Credits</span>
            <span className="font-serif text-lg font-bold text-ochre">
              {aggregate.verifiedTransactions || 0}
            </span>
          </div>
        </div>

        {/* Top Contributors List */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-ink-3 block">
            Top Verified Contributors
          </span>

          <div className="space-y-1.5">
            {contributors.map((c: any, idx: number) => (
              <div
                key={c.id || idx}
                className="p-2.5 bg-surface-2 rounded border border-line flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-ink">{c.displayName}</span>
                  <div className="text-[10px] text-ink-3">
                    {c.uniqueIncidents} reported · {c.resolved} resolved
                  </div>
                </div>
                <span className="font-mono font-bold text-moss text-xs">
                  {c.verifiedCredits} credits
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
