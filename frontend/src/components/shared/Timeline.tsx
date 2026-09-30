import React from 'react';
import { Check, Clock } from 'lucide-react';

interface TimelineStep {
  label: string;
  status: 'DONE' | 'CURRENT' | 'PENDING';
  date?: string;
  note?: string;
}

interface TimelineProps {
  currentStatus: string;
  history?: Array<{ to: string; createdAt: string; note?: string }>;
}

export const Timeline: React.FC<TimelineProps> = ({ currentStatus, history = [] }) => {
  const stepsDef = [
    { key: 'SUBMITTED', label: 'Report Received' },
    { key: 'VERIFIED', label: 'Verified by Municipality' },
    { key: 'SCHEDULED', label: 'Scheduled for Collection' },
    { key: 'RESOLVED', label: 'Waste Cleared & Resolved' },
  ];

  const getStatusRank = (st: string) => {
    switch (st) {
      case 'SUBMITTED':
        return 1;
      case 'VERIFIED':
        return 2;
      case 'SCHEDULED':
        return 3;
      case 'RESOLVED':
        return 4;
      default:
        return 0;
    }
  };

  const currentRank = getStatusRank(currentStatus);

  const steps: TimelineStep[] = stepsDef.map((def, idx) => {
    const stepRank = idx + 1;
    const historyItem = history.find((h) => h.to === def.key);

    let status: 'DONE' | 'CURRENT' | 'PENDING' = 'PENDING';
    if (stepRank < currentRank || (stepRank === 4 && currentRank === 4)) {
      status = 'DONE';
    } else if (stepRank === currentRank) {
      status = 'CURRENT';
    }

    return {
      label: def.label,
      status,
      date: historyItem ? new Date(historyItem.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }) : undefined,
      note: historyItem?.note,
    };
  });

  return (
    <div className="space-y-4 my-2">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-start gap-3 relative">
          {idx < steps.length - 1 && (
            <div
              className={`absolute left-[13px] top-6 bottom-[-16px] w-[1.5px] ${
                step.status === 'DONE' ? 'bg-moss' : 'bg-line'
              }`}
            />
          )}

          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
              step.status === 'DONE'
                ? 'bg-moss text-surface'
                : step.status === 'CURRENT'
                ? 'bg-ochre text-surface ring-4 ring-ochre-100'
                : 'bg-surface-2 text-ink-3 border border-line'
            }`}
          >
            {step.status === 'DONE' ? <Check className="w-4 h-4" /> : idx + 1}
          </div>

          <div className="flex-1 pb-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${step.status !== 'PENDING' ? 'font-semibold text-ink' : 'text-ink-3'}`}>
                {step.label}
              </span>
              {step.date && <span className="text-[11px] text-ink-3">{step.date}</span>}
            </div>
            {step.note && <p className="text-xs text-ink-2 mt-0.5">{step.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};
