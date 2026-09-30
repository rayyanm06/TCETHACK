import React, { useState } from 'react';
import { WasteEventSummary } from '../../types/api.ts';
import { PriorityChip } from '../../components/shared/PriorityChip.tsx';
import { Eye, Home, Zap, AlertTriangle, Trash2, Filter } from 'lucide-react';

interface NowLensProps {
  events: WasteEventSummary[];
  onSelectEvent: (id: string) => void;
  selectedEventId?: string | null;
}

export type QueueFilter = 'ALL' | 'PUBLIC_ORDINARY' | 'E_WASTE' | 'SPECIALIST' | 'HOUSEHOLD';

export const NowLens: React.FC<NowLensProps> = ({ events, onSelectEvent, selectedEventId }) => {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');

  // Filter by operational stream
  const filteredEvents = events.filter((ev) => {
    const isHousehold = ev.reportType === 'HOUSEHOLD';
    const isEWaste = ev.category === 'E_WASTE' || ev.specialistQueue === 'E_WASTE';
    const isSpecialist = ev.specialistFlag || ev.specialistQueue === 'HAZARDOUS';

    if (queueFilter === 'HOUSEHOLD') return isHousehold;
    if (queueFilter === 'E_WASTE') return isEWaste;
    if (queueFilter === 'SPECIALIST') return isSpecialist;
    if (queueFilter === 'PUBLIC_ORDINARY') return !isHousehold && !isEWaste && !isSpecialist;
    return true;
  });

  // Sort events: SUBMITTED & REOPENED (needs verification) first, then by priority score descending
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aNeedsVerif = a.status === 'SUBMITTED' || a.status === 'REOPENED';
    const bNeedsVerif = b.status === 'SUBMITTED' || b.status === 'REOPENED';
    if (aNeedsVerif && !bNeedsVerif) return -1;
    if (bNeedsVerif && !aNeedsVerif) return 1;
    return (b.priority?.score || 0) - (a.priority?.score || 0);
  });

  const needsAttentionList = sortedEvents.filter((e) => e.status !== 'RESOLVED');

  return (
    <>
      {/* Left Rail: Needs Attention Queue */}
      <aside className="absolute left-0 top-14 bottom-0 z-20 w-full sm:w-[380px] bg-surface/95 backdrop-blur-md border-r border-line shadow-panel flex flex-col survey-corner">
        <div className="p-3 border-b border-line bg-surface-2/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold text-ink">Operational Queues</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-clay text-surface">
                {needsAttentionList.length}
              </span>
            </div>
            <span className="text-[10px] text-ink-3 uppercase font-semibold">Priority Ranked</span>
          </div>

          {/* Operational Stream Filters */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 text-[11px]">
            {[
              { id: 'ALL', label: 'All', icon: null },
              { id: 'PUBLIC_ORDINARY', label: 'Ordinary Public', icon: Trash2 },
              { id: 'E_WASTE', label: 'E-Waste', icon: Zap },
              { id: 'SPECIALIST', label: 'Specialist', icon: AlertTriangle },
              { id: 'HOUSEHOLD', label: 'Household', icon: Home },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = queueFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setQueueFilter(tab.id as QueueFilter)}
                  className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap flex items-center gap-1 transition ${
                    isActive
                      ? 'bg-ink text-surface'
                      : 'bg-surface text-ink-3 hover:text-ink border border-line'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Attention Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {needsAttentionList.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-3">
              No incidents pending in this stream.
            </div>
          ) : (
            needsAttentionList.map((ev) => {
              const isSelected = selectedEventId === ev.id;
              const isSubmitted = ev.status === 'SUBMITTED';
              const isReopened = ev.status === 'REOPENED';
              const isHousehold = ev.reportType === 'HOUSEHOLD';
              const isEWaste = ev.category === 'E_WASTE';

              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev.id)}
                  className={`p-3 rounded-card border transition cursor-pointer ${
                    isSelected
                      ? 'bg-surface border-lagoon ring-2 ring-lagoon/20 shadow-md'
                      : isReopened
                      ? 'bg-clay-100/30 border-clay/50 hover:border-clay'
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
                        {isHousehold ? '🏠' : isEWaste ? '⚡' : '📦'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-ink">{ev.code}</span>
                          {isHousehold && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-lagoon-100 text-lagoon font-bold">
                              HOME
                            </span>
                          )}
                          {isEWaste && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-plum-100 text-plum font-bold">
                              E-WASTE
                            </span>
                          )}
                        </div>
                        <PriorityChip
                          tier={ev.priority?.tier || (isSubmitted ? 'Low' : 'Normal')}
                          score={isSubmitted ? undefined : ev.priority?.score}
                          size="sm"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-ink-2 mb-1">
                        <span className="font-semibold">{ev.category}</span>
                        <span>·</span>
                        <span className="text-ink-3 truncate">
                          {isHousehold && ev.householdItems
                            ? `${ev.householdQuantity || 1}x ${ev.householdItems}`
                            : ev.addressText || 'Street location'}
                        </span>
                      </div>

                      {isReopened ? (
                        <span className="inline-block text-[10px] font-bold text-clay bg-clay-100 px-1.5 py-0.2 rounded">
                          ⚠️ Disputed Closure — Reopened
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-block text-[10px] font-bold text-ochre bg-ochre-100 px-1.5 py-0.2 rounded">
                          ⚠️ Needs Municipal Verification
                        </span>
                      ) : (
                        <p className="text-[11px] text-ink-3 line-clamp-1 italic">
                          {ev.priority?.sentence || `${ev.estimatedWeightKg || 50} kg load`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px]">
                    <span className="text-ink-3">
                      {ev.reportCount} report{ev.reportCount === 1 ? '' : 's'} linked
                      {ev.reviewedSupportCount ? ` (${ev.reviewedSupportCount} verified)` : ''}
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
            })
          )}
        </div>
      </aside>

      {/* Floating Map Legend */}
      <div className="hidden sm:block absolute bottom-4 left-[400px] z-10 bg-surface/90 backdrop-blur-md rounded-card border border-line p-3 shadow-panel text-[11px] text-ink-2 space-y-1.5 pointer-events-auto">
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
