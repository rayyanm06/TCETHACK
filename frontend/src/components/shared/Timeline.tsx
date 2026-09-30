import React from 'react';
import { getLifecyclePresentation } from '../../lib/lifecycle.ts';
import { Check, Clock, ArrowRight, UserCheck, ShieldCheck, Truck, RotateCcw, AlertTriangle } from 'lucide-react';

interface TimelineProps {
  currentStatus: string;
  category?: string;
  reportType?: 'PUBLIC' | 'HOUSEHOLD' | string;
  specialistQueue?: string;
  specialistFlag?: boolean;
  assignedRouteId?: string | null;
  history?: Array<{
    to: string;
    actorRole?: string;
    createdAt: string;
    note?: string;
  }>;
  closure?: any;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentStatus,
  category = 'MIXED',
  reportType = 'PUBLIC',
  specialistQueue = 'NONE',
  specialistFlag = false,
  assignedRouteId,
  history = [],
  closure,
}) => {
  const lifecycle = getLifecyclePresentation({
    status: currentStatus,
    category,
    reportType,
    specialistQueue,
    specialistFlag,
    assignedRouteId,
    timeline: history,
    closure,
  });

  return (
    <div className="space-y-5 my-2">
      {/* Category Handling Clarification */}
      {lifecycle.categoryHandlingNote && (
        <div className="p-2.5 rounded bg-surface-2 border border-line text-[11px] text-ink-2 leading-relaxed">
          <span className="font-semibold text-ink block mb-0.5">Handling Stream:</span>
          {lifecycle.categoryHandlingNote}
        </div>
      )}

      {/* Part 1: Recorded Activity History (Actual Events with Timestamps) */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider mb-3">
          <Clock className="w-3.5 h-3.5 text-moss" />
          <span>Recorded Activity History</span>
        </div>

        <div className="space-y-3 pl-1">
          {lifecycle.history.map((item, idx) => {
            const isLast = idx === lifecycle.history.length - 1;
            const formattedDate = new Date(item.timestamp).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={idx} className="flex items-start gap-3 relative">
                {!isLast && (
                  <div className="absolute left-[13px] top-6 bottom-[-14px] w-[1.5px] bg-line" />
                )}

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                    item.stage === 'REOPENED'
                      ? 'bg-clay text-surface'
                      : item.stage === 'RESOLVED'
                      ? 'bg-moss text-surface'
                      : isLast
                      ? 'bg-ink text-surface ring-2 ring-ink/20'
                      : 'bg-moss-100 text-moss-700 border border-moss/30'
                  }`}
                >
                  {item.stage === 'RESOLVED' ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : item.stage === 'REOPENED' ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-xs font-bold text-ink">{item.label}</span>
                    <span className="text-[10px] text-ink-3 font-mono">{formattedDate}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-ink-3 mt-0.5">
                    {item.actorRole === 'CITIZEN' ? (
                      <UserCheck className="w-3 h-3 text-moss" />
                    ) : item.actorRole === 'OPERATOR' ? (
                      <ShieldCheck className="w-3 h-3 text-lagoon" />
                    ) : null}
                    <span>Recorded by {item.actorLabel}</span>
                  </div>

                  {item.note && (
                    <p className="text-xs text-ink-2 mt-1 p-2 rounded bg-surface border border-line">
                      {item.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Part 2: What Happens Next (Explanatory Future Stages) */}
      {lifecycle.nextSteps.length > 0 && (
        <div className="pt-3 border-t border-line">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider mb-2.5">
            <ArrowRight className="w-3.5 h-3.5 text-lagoon" />
            <span>What Happens Next</span>
          </div>

          <div className="space-y-2">
            {lifecycle.nextSteps.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded-card bg-surface border border-line text-xs space-y-1 survey-corner"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-surface-2 text-ink-3 flex items-center justify-center text-[10px] font-bold">
                      {step.timelineStepNumber}
                    </span>
                    {step.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-2 font-medium">
                    {step.actorLabel}
                  </span>
                </div>
                <p className="text-ink-3 text-[11px] leading-relaxed pl-5.5">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
