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

/**
 * Converts compass heading (0°=N, 90°=E, 180°=S, 270°=W) to a 2D screen transform.
 * The CivicClean municipal truck illustration is a side profile facing RIGHT (East).
 * 
 * - Moving EAST: normal image, rotate(0deg)
 * - Moving SOUTH: normal image, rotate(90deg) (points straight down)
 * - Moving NORTH: normal image, rotate(-90deg) (points straight up)
 * - Moving WEST: horizontally mirrored scaleX(-1), rotate(0deg) (points left, wheels on road)
 * - Moving DIAGONALS: smoothly pitched along road direction without upside-down inversion.
 */
export function getTruckTransformStyle(compassHeading: number): string {
  // Screen angle relative to East (positive X):
  // 0° = East, +90° = South, -90° = North, ±180° = West
  let screenAngle = ((compassHeading - 90) % 360 + 360) % 360;
  if (screenAngle > 180) screenAngle -= 360;

  const isWestbound = Math.abs(screenAngle) > 90;

  if (isWestbound) {
    // When mirrored with scaleX(-1), the unrotated truck points West (180° / -180°).
    // Tilt pitch relative to horizontal West:
    // screenAngle = 180° (West) -> tilt = 0°
    // screenAngle = 135° (Southwest) -> tilt = +45° (points down-left)
    // screenAngle = -135° (Northwest) -> tilt = -45° (points up-left)
    // screenAngle = 90° (South) -> tilt = +90° (points straight down)
    // screenAngle = -90° (North) -> tilt = -90° (points straight up)
    const tilt = screenAngle > 0 ? 180 - screenAngle : -180 - screenAngle;
    return `scaleX(-1) rotate(${Math.round(tilt)}deg)`;
  } else {
    // Eastbound: truck faces right naturally; rotate directly to match travel angle
    return `rotate(${Math.round(screenAngle)}deg)`;
  }
}

/**
 * Updates the inner transform and status classes of an existing truck marker DOM element
 * without triggering Leaflet marker teardown or DOM reconstruction.
 */
export function updateTruckMarkerElement(
  containerEl: HTMLElement | null,
  heading: number,
  isMoving: boolean,
  registration?: string
) {
  if (!containerEl) return;
  const wrapper = containerEl.querySelector<HTMLElement>('.truck-heading-wrapper');
  if (wrapper) {
    wrapper.style.transform = getTruckTransformStyle(heading);
  }
  if (isMoving) {
    containerEl.classList.add('is-moving');
  } else {
    containerEl.classList.remove('is-moving');
  }
  if (registration) {
    const badge = containerEl.querySelector<HTMLElement>('.truck-live-badge');
    if (badge) {
      badge.textContent = registration.split('-')[2] || registration || 'TRUCK';
    }
  }
}

export function createGarbageTruckMarker(
  heading = 0,
  registration = 'MH-02-PILOT-01',
  isMoving = false
) {
  const transform = getTruckTransformStyle(heading);
  const badgeText = registration.split('-')[2] || registration || 'TRUCK';

  const html = `
    <div class="civic-truck-container ${isMoving ? 'is-moving' : ''}" title="${registration} (CivicClean Municipal Truck)">
      <div class="truck-heading-wrapper" style="transform: ${transform};">
        <svg width="54" height="26" viewBox="0 0 460 220" fill="none" xmlns="http://www.w3.org/2000/svg" class="truck-svg-artwork">
          <defs>
            <linearGradient id="compactorGradMarker" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1C5340" />
              <stop offset="100%" stop-color="#164635" />
            </linearGradient>
            <linearGradient id="cabGradMarker" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2A7C5C" />
              <stop offset="100%" stop-color="#236B4F" />
            </linearGradient>
            <linearGradient id="windshieldGradMarker" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#DCE8E8" />
              <stop offset="100%" stop-color="#B8CFCE" />
            </linearGradient>
          </defs>

          <!-- Drop Shadow on Road -->
          <ellipse cx="230" cy="205" rx="200" ry="12" fill="#17211D" fill-opacity="0.32" />

          <!-- Chassis & Undercarriage -->
          <rect x="50" y="158" width="370" height="22" rx="4" fill="#17211D" />
          <rect x="70" y="174" width="80" height="10" fill="#53615B" />
          <rect x="250" y="174" width="130" height="10" fill="#53615B" />

          <!-- Battery/Fuel tank -->
          <rect x="180" y="162" width="60" height="16" rx="3" fill="#53615B" stroke="#17211D" stroke-width="2" />
          <line x1="200" y1="162" x2="200" y2="178" stroke="#17211D" stroke-width="1.5" />
          <line x1="220" y1="162" x2="220" y2="178" stroke="#17211D" stroke-width="1.5" />

          <!-- Main Compactor Body (Green Container) -->
          <path d="M 50 50 L 290 50 L 290 165 L 50 165 Z" fill="url(#compactorGradMarker)" stroke="#164635" stroke-width="3" />
          <path d="M 50 50 Q 42 70 42 165 L 50 165 Z" fill="#133D2E" />

          <!-- Horizontal Stiffener Ribs -->
          <rect x="55" y="65" width="230" height="7" rx="1.5" fill="#113629" />
          <rect x="55" y="86" width="230" height="7" rx="1.5" fill="#113629" />
          <rect x="55" y="107" width="230" height="7" rx="1.5" fill="#113629" />
          <rect x="55" y="128" width="230" height="7" rx="1.5" fill="#113629" />

          <!-- White Brand Accent Banner -->
          <rect x="55" y="76" width="230" height="24" rx="2" fill="#FBF9F4" />
          <text x="68" y="93" fill="#164635" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="2.5">CIVICCLEAN · 04</text>
          <circle cx="270" cy="88" r="4" fill="#236B4F" />

          <!-- Warning Hazard Chevron Strip -->
          <g opacity="0.85">
            <rect x="55" y="146" width="230" height="12" fill="#D59A3A" />
            <path d="M 65 146 L 75 158 H 85 L 75 146 Z" fill="#17211D" />
            <path d="M 95 146 L 105 158 H 115 L 105 146 Z" fill="#17211D" />
            <path d="M 125 146 L 135 158 H 145 L 135 146 Z" fill="#17211D" />
            <path d="M 155 146 L 165 158 H 175 L 165 146 Z" fill="#17211D" />
            <path d="M 185 146 L 195 158 H 205 L 195 146 Z" fill="#17211D" />
            <path d="M 215 146 L 225 158 H 235 L 225 146 Z" fill="#17211D" />
            <path d="M 245 146 L 255 158 H 265 L 255 146 Z" fill="#17211D" />
          </g>

          <!-- Rear Hopper & Lift Mechanism (Left side) -->
          <path d="M 42 75 L 15 95 L 15 160 L 42 165 Z" fill="#1C2E26" stroke="#17211D" stroke-width="2.5" />
          <rect x="18" y="105" width="20" height="48" rx="2" fill="#17211D" />
          <rect x="20" y="107" width="16" height="44" rx="1.5" fill="#2E4237" opacity="0.6" />
          <line x1="32" y1="150" x2="10" y2="128" stroke="#D59A3A" stroke-width="5" stroke-linecap="round" />
          <line x1="12" y1="130" x2="6" y2="118" stroke="#53615B" stroke-width="4" stroke-linecap="round" />
          <circle cx="22" cy="85" r="4" fill="#C96E45" />

          <!-- Driver Cabin (Right side - Visual Front) -->
          <path d="M 290 68 L 380 68 Q 395 72 405 92 L 424 135 Q 428 145 428 155 L 428 165 L 290 165 Z" fill="url(#cabGradMarker)" stroke="#1B553E" stroke-width="2.5" />
          <path d="M 288 66 L 382 66 Q 394 67 398 75 L 288 75 Z" fill="#164635" />

          <!-- Amber Roof Strobe Beacon -->
          <rect x="330" y="55" width="16" height="11" rx="3" fill="#D59A3A" stroke="#17211D" stroke-width="1.5" />
          <circle cx="338" cy="60" r="14" fill="#D59A3A" fill-opacity="0.35" />

          <!-- Windshield & Window -->
          <path d="M 305 78 L 372 78 Q 384 81 392 96 L 406 126 L 305 126 Z" fill="url(#windshieldGradMarker)" stroke="#17211D" stroke-width="2" />
          <line x1="358" y1="78" x2="368" y2="126" stroke="#236B4F" stroke-width="4" />
          <circle cx="340" cy="100" r="8" fill="#17211D" fill-opacity="0.45" />

          <!-- Headlights -->
          <path d="M 424 140 L 428 141 L 428 154 L 422 153 Z" fill="#FFFFFF" stroke="#17211D" stroke-width="1.5" />
          <rect x="424" y="154" width="4" height="6" fill="#D59A3A" />
          <polygon points="430,143 510,135 510,180 430,158" fill="#FFFFFF" fill-opacity="0.15" />

          <!-- Front Bumper -->
          <path d="M 416 160 L 434 160 L 434 175 L 416 175 Z" fill="#17211D" />
          <rect x="390" y="162" width="26" height="12" rx="2" fill="#53615B" />

          <!-- Wheels (Ground Contact) -->
          <circle cx="105" cy="175" r="28" fill="#17211D" />
          <circle cx="105" cy="175" r="19" fill="#53615B" />
          <circle cx="105" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="105" cy="175" r="5" fill="#17211D" />
          <path d="M 72 165 A 34 34 0 0 1 138 165 Z" fill="#17211D" fill-opacity="0.4" />

          <circle cx="170" cy="175" r="28" fill="#17211D" />
          <circle cx="170" cy="175" r="19" fill="#53615B" />
          <circle cx="170" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="170" cy="175" r="5" fill="#17211D" />
          <path d="M 137 165 A 34 34 0 0 1 203 165 Z" fill="#17211D" fill-opacity="0.4" />

          <circle cx="355" cy="175" r="28" fill="#17211D" />
          <circle cx="355" cy="175" r="19" fill="#53615B" />
          <circle cx="355" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="355" cy="175" r="5" fill="#17211D" />
          <path d="M 322 165 A 34 34 0 0 1 388 165 Z" fill="#17211D" fill-opacity="0.4" />
        </svg>
      </div>
      <div class="truck-live-badge">${badgeText}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [58, 32],
    iconAnchor: [29, 16],
    popupAnchor: [0, -20],
  });
}
