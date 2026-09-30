import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { PriorityTier } from '../../types/api.ts';

interface PriorityChipProps {
  tier: PriorityTier | string;
  score?: number;
  size?: 'sm' | 'md';
}

export const PriorityChip: React.FC<PriorityChipProps> = ({ tier, score, size = 'md' }) => {
  const isSm = size === 'sm';
  const padding = isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (tier) {
    case 'Critical':
      return (
        <span className={`inline-flex items-center gap-1 rounded-pill bg-clay text-surface shadow-sm ${padding}`}>
          <AlertCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Critical {score !== undefined && `(${score})`}
        </span>
      );
    case 'High':
      return (
        <span className={`inline-flex items-center gap-1 rounded-pill bg-ochre-100 text-ochre border border-ochre/30 ${padding}`}>
          <AlertTriangle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          High {score !== undefined && `(${score})`}
        </span>
      );
    case 'Normal':
      return (
        <span className={`inline-flex items-center gap-1 rounded-pill bg-surface text-ink-2 border border-line ${padding}`}>
          Normal {score !== undefined && `(${score})`}
        </span>
      );
    case 'Low':
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-pill bg-surface-2 text-ink-3 border border-line ${padding}`}>
          Low {score !== undefined && `(${score})`}
        </span>
      );
  }
};
