import React from 'react';
import { Check, Clock, Truck, X } from 'lucide-react';
import { EventStatus } from '../../types/api.ts';

interface StatusChipProps {
  status: EventStatus | string;
  size?: 'sm' | 'md';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'md' }) => {
  const isSm = size === 'sm';
  const padding = isSm ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs font-medium';

  switch (status) {
    case 'VERIFIED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-pill bg-moss-100 text-moss-700 border border-moss/20 ${padding}`}>
          <Check className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Verified
        </span>
      );
    case 'SCHEDULED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-pill bg-lagoon-100 text-lagoon border border-lagoon/20 ${padding}`}>
          <Truck className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Scheduled
        </span>
      );
    case 'RESOLVED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-pill bg-moss text-surface font-medium shadow-sm ${padding}`}>
          <Check className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Resolved
        </span>
      );
    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-pill bg-clay-100 text-clay border border-clay/20 ${padding}`}>
          <X className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Not accepted
        </span>
      );
    case 'SUBMITTED':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-pill bg-surface text-ink-2 border border-line ${padding}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-ochre animate-pulse" />
          Received
        </span>
      );
  }
};
