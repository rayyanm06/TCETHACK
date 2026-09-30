import React from 'react';
import { WasteCategory } from '../../types/api.ts';

export const CATEGORY_DETAILS: Record<
  WasteCategory,
  { label: string; icon: string; bg: string; text: string }
> = {
  ORGANIC: { label: 'Organic', icon: '🍃', bg: 'bg-moss-100', text: 'text-moss-700' },
  PLASTIC: { label: 'Plastic', icon: '🧴', bg: 'bg-lagoon-100', text: 'text-lagoon' },
  PAPER: { label: 'Paper', icon: '📦', bg: 'bg-ochre-100', text: 'text-ochre' },
  GLASS: { label: 'Glass', icon: '🍾', bg: 'bg-surface-2', text: 'text-ink-2' },
  METAL: { label: 'Metal', icon: '🥫', bg: 'bg-surface-2', text: 'text-ink-2' },
  E_WASTE: { label: 'E-waste', icon: '🔌', bg: 'bg-plum-100', text: 'text-plum' },
  MIXED: { label: 'Mixed', icon: '⚠️', bg: 'bg-clay-100', text: 'text-clay' },
  UNKNOWN: { label: 'Unknown', icon: '❓', bg: 'bg-surface-2', text: 'text-ink-3' },
};

interface CategoryChipProps {
  category: WasteCategory;
  isSuggested?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  category,
  isSuggested,
  onClick,
  selected,
}) => {
  const info = CATEGORY_DETAILS[category] || CATEGORY_DETAILS.UNKNOWN;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium border transition-all ${
        selected
          ? 'bg-ink text-surface border-ink shadow-sm'
          : `${info.bg} ${info.text} border-line hover:border-ink/30`
      }`}
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
      {isSuggested && (
        <span className="ml-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-pill bg-moss text-surface">
          Suggested
        </span>
      )}
    </button>
  );
};
