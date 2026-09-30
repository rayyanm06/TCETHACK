import React from 'react';
import { WasteEventSummary } from '../../types/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { PriorityChip } from '../../components/shared/PriorityChip.tsx';
import { AlertCircle, Filter, Eye } from 'lucide-react';

interface NowLensProps {
  events: WasteEventSummary[];
  onSelectEvent: (id: string) => void;
  selectedEventId?: string | null;
}

export const NowLens: React.FC<NowLensProps> = ({ events, onSelectEvent, selectedEventId }) => {
  // Sort events: SUBMITTED (needs verification) first, then by priority score descending
  const sortedEvents = [...events].sort((a, b) => {
    if (a.status === 'SUBMITTED' && b.status !== 'SUBMITTED') return -1;
    if (b.status === 'SUBMITTED' && a.status !== 'SUBMITTED') return 1;
    return (b.priority?.score || 0) - (a.priority?.score || 0);
  });

  const needsAttentionList = sortedEvents.filter((e) => ['SUBMITTED','VERIFIED','SCHEDULED'].includes(e.status));

  return (
    <>
      {/* Left Rail: Needs Attention Queue (§6.7) */}
      <aside className="absolute left-0 top-0 bottom-0 z-20 w-full sm:w-[360px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner">
        <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-bold text-ink">Needs Attention</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-clay text-surface">
              {needsAttentionList.length}
            </span>
          </div>

          <span className="text-[10px] text-ink-3 uppercase font-semibold">Priority Ranked</span>
        </div>

        {/* Scrollable Attention Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {!needsAttentionList.length && <p className="text-sm p-4 text-ink-2">No active requests yet. Real citizen reports will appear here.</p>}
          {needsAttentionList.map((ev) => {
            const isSelected = selectedEventId === ev.id;
            const isSubmitted = ev.status === 'SUBMITTED';

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className={`p-3 rounded-card border transition cursor-pointer ${
                  isSelected
                    ? 'bg-surface border-lagoon ring-2 ring-lagoon/20 shadow-md'
                    : isSubmitted
                    ? 'bg-ochre-100/20 border-ochre/40 hover:border-ochre'
                    : 'bg-surface border-line hover:border-ink/30 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {ev.thumbnailUrl ? (
                    <img
                      src={ev.thumbnailUrl}
                      alt={ev.code}
                      className="w-14 h-14 rounded object-cover border border-line shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded bg-surface-2 border border-line flex items-center justify-center shrink-0 text-lg">
                      📦
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-ink">{ev.code}</span>
                      <PriorityChip
                        tier={ev.priority?.tier || (isSubmitted ? 'Low' : 'Normal')}
                        score={isSubmitted ? undefined : ev.priority?.score}
                        size="sm"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-ink-2 mb-1">
                      <span className="font-semibold">{ev.category}</span>
                      <span>·</span>
                      <span className="text-ink-3 truncate">{ev.addressText || 'Street location'}</span>
                    </div>

                    {isSubmitted ? (
                      <span className="inline-block text-[10px] font-bold text-ochre bg-ochre-100 px-1.5 py-0.2 rounded">
                        ⚠️ Needs Operator Review
                      </span>
                    ) : (
                      <p className="text-[11px] text-ink-3 line-clamp-1 italic">
                        {ev.priority?.sentence || `${ev.estimatedWeightKg ?? 'Unestimated'} kg load`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px]">
                  <span className="text-ink-3">
                    {ev.reportCount} report{ev.reportCount === 1 ? '' : 's'} linked
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev.id);
                    }}
                    className="text-moss font-semibold hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Floating Map Legend (§6.7) */}
      <div className="hidden sm:block absolute bottom-4 left-96 z-10 bg-surface/90 backdrop-blur-md rounded-card border border-line p-3 shadow-panel text-[11px] text-ink-2 space-y-1.5 pointer-events-auto">
        <span className="text-[10px] uppercase font-bold text-ink-3 block">Marker Legend</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-clay border border-surface shadow" />
          <span>Critical (Double pulse ring)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-ochre border border-surface shadow" />
          <span>High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-surface border-2 border-dashed border-ink-3" />
          <span>Unverified (Needs Inspection)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-lagoon border border-surface shadow" />
          <span>Scheduled Stop</span>
        </div>
      </div>
    </>
  );
};
