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

export function createStopTransitIcon(seq: number, isDone = false) {
  const html = `<div class="stop-transit-badge ${isDone ? 'bg-moss border-moss text-surface' : ''}">${isDone ? '✓' : seq}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function createGarbageTruckMarker(
  heading = 0,
  registration = 'MH-02-PILOT-01',
  isMoving = false
) {
  const html = `
    <div class="civic-truck-container ${isMoving ? 'is-moving' : ''}" title="${registration} (CivicClean Municipal Truck)">
      <div class="truck-heading-wrapper" style="transform: rotate(${Math.round(heading)}deg);">
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Drop Shadow -->
          <rect x="9" y="5" width="24" height="34" rx="4" fill="rgba(23,35,28,0.35)" />
          <!-- Compactor Main Body -->
          <rect x="11" y="11" width="20" height="23" rx="2" fill="#0E6A78" stroke="#17231C" stroke-width="1.2" />
          <!-- Heavy Waste Compactor Ribs -->
          <line x1="14" y1="16" x2="28" y2="16" stroke="#258896" stroke-width="1.2" />
          <line x1="14" y1="21" x2="28" y2="21" stroke="#258896" stroke-width="1.2" />
          <line x1="14" y1="26" x2="28" y2="26" stroke="#258896" stroke-width="1.2" />
          <!-- Rear Hopper Door -->
          <rect x="13" y="32" width="16" height="3" rx="1" fill="#17231C" />
          <!-- Front Cab -->
          <path d="M12 11V6C12 4.9 12.9 4 14 4H28C29.1 4 30 4.9 30 6V11H12Z" fill="#17231C" />
          <!-- Curved Windshield -->
          <path d="M14 6.5C14 5.7 14.6 5 15.3 5H26.7C27.4 5 28 5.7 28 6.5V9.5H14V6.5Z" fill="#A8D5BA" opacity="0.9" />
          <!-- Side Rearview Mirrors -->
          <rect x="8.5" y="6.5" width="2.5" height="3.5" rx="1" fill="#17231C" />
          <rect x="31" y="6.5" width="2.5" height="3.5" rx="1" fill="#17231C" />
          <!-- Wheel Treads -->
          <rect x="9.5" y="8" width="2" height="5" rx="1" fill="#3F4F45" />
          <rect x="30.5" y="8" width="2" height="5" rx="1" fill="#3F4F45" />
          <rect x="9.5" y="24" width="2" height="6" rx="1" fill="#3F4F45" />
          <rect x="30.5" y="24" width="2" height="6" rx="1" fill="#3F4F45" />
          <!-- Bright Yellow Headlights -->
          <circle cx="15" cy="4.5" r="1.2" fill="#F4E883" />
          <circle cx="27" cy="4.5" r="1.2" fill="#F4E883" />
          <!-- Civic Emblem Badge -->
          <circle cx="21" cy="20" r="2.5" fill="#EFEBE0" />
          <circle cx="21" cy="20" r="1.2" fill="#0E6A78" />
        </svg>
      </div>
      <div class="truck-live-badge">${registration.split('-')[2] || 'TRUCK'}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}
