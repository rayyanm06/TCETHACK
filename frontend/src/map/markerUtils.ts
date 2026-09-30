import L from 'leaflet';
import { WasteCategory, EventStatus, PriorityTier } from '../types/api.ts';
import { CATEGORY_DETAILS } from '../components/shared/CategoryChip.tsx';

export function createWasteMarker(
  category: WasteCategory,
  status: EventStatus,
  tier: PriorityTier,
  code: string,
  stopSeq?: number
) {
  const catInfo = CATEGORY_DETAILS[category] || CATEGORY_DETAILS.UNKNOWN;

  let markerClass = 'marker-normal';
  let badgeContent = catInfo.icon;
  let extraRings = '';

  if (status === 'SUBMITTED') {
    markerClass = 'marker-unverified';
    badgeContent = catInfo.icon;
  } else if (status === 'RESOLVED') {
    markerClass = 'marker-resolved';
    badgeContent = '✓';
  } else if (status === 'SCHEDULED') {
    markerClass = 'marker-scheduled';
    badgeContent = stopSeq !== undefined ? String(stopSeq) : '🚚';
  } else if (tier === 'Critical') {
    markerClass = 'marker-critical';
    extraRings = `<div class="pulse-ring-1"></div><div class="pulse-ring-2"></div>`;
    badgeContent = '!';
  } else if (tier === 'High') {
    markerClass = 'marker-high';
    badgeContent = '!';
  }

  const html = `
    <div class="waste-marker-wrapper ${markerClass}" title="${code} · ${category} · ${tier}">
      ${extraRings}
      <div class="waste-marker-body">
        ${badgeContent}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export function createDepotMarker(name: string) {
  const html = `
    <div class="waste-marker-wrapper marker-depot" title="${name}">
      <div class="waste-marker-body">D</div>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function createStopTransitIcon(seq: number) {
  const html = `<div class="stop-transit-badge">${seq}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
