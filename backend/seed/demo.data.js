/**
 * Seed Scenario Data (§23) for CivicClean
 * 1 Depot, 1 Vehicle, 3 Users, 10 Active Events, 3 Resolved Events, ~120 History Incidents
 */

export const DEPOT_COORDS = {
  lat: 19.2071,
  lng: 72.8760,
  name: 'North Municipal Central Depot',
};

// Offset helper in meters (~0.000009 degrees per meter)
function offset(dLatMeters, dLngMeters) {
  const dLat = dLatMeters / 111111;
  const dLng = dLngMeters / (111111 * Math.cos((DEPOT_COORDS.lat * Math.PI) / 180));
  return {
    lat: Math.round((DEPOT_COORDS.lat + dLat) * 100000) / 100000,
    lng: Math.round((DEPOT_COORDS.lng + dLng) * 100000) / 100000,
  };
}

export const SEED_USERS = [
  {
    name: 'Operator Dilip',
    email: 'operator@civicclean.demo',
    password: 'demo123',
    role: 'OPERATOR',
    neighbourhoodLabel: 'Central Municipal Operations',
    isSeed: true,
  },
  {
    name: 'Asha K.',
    email: 'asha@civicclean.demo',
    password: 'demo123',
    role: 'CITIZEN',
    neighbourhoodLabel: 'Market Lane Colony',
    isSeed: true,
  },
  {
    name: 'Ravi M.',
    email: 'ravi@civicclean.demo',
    password: 'demo123',
    role: 'CITIZEN',
    neighbourhoodLabel: 'Station Road Enclave',
    isSeed: true,
  },
  {
    name: 'Vikram S.',
    email: 'vikram@civicclean.demo',
    password: 'demo123',
    role: 'CITIZEN',
    neighbourhoodLabel: 'Thakur Complex',
    isSeed: true,
  },
];

export const SEED_VEHICLE = {
  name: 'Truck A (1000 kg Municipal)',
  registration: 'MH-02-CW-4412',
  capacityKg: 1000,
  acceptedCategories: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED'],
  depot: {
    name: DEPOT_COORDS.name,
    location: {
      type: 'Point',
      coordinates: [DEPOT_COORDS.lng, DEPOT_COORDS.lat],
    },
  },
  maxRouteMinutes: 180,
  isActive: true,
  isSeed: true,
};

// SVG-based placeholder photos that render cleanly and beautifully offline
function generateWasteSvg(color, text, icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#EFEBE0"/>
    <rect x="20" y="20" width="560" height="360" rx="12" fill="${color}" opacity="0.15"/>
    <circle cx="300" cy="180" r="70" fill="${color}" opacity="0.3"/>
    <text x="300" y="195" font-family="sans-serif" font-size="44" font-weight="bold" fill="#17231C" text-anchor="middle">${icon}</text>
    <text x="300" y="280" font-family="sans-serif" font-size="22" font-weight="bold" fill="#17231C" text-anchor="middle">${text}</text>
    <text x="300" y="310" font-family="sans-serif" font-size="14" fill="#3F4F45" text-anchor="middle">CivicClean Municipal Verified Evidence</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SEED_PHOTOS = {
  organic1: generateWasteSvg('#2E6B4E', 'Vegetable and Food Waste Pile', '🍃'),
  organic2: generateWasteSvg('#2E6B4E', 'Garden Trimmings & Kitchen Waste', '🥗'),
  plastic1: generateWasteSvg('#0E6A78', 'Crushed Plastic Bottles & Pouches', '🧴'),
  plastic2: generateWasteSvg('#0E6A78', 'Commercial Packaging Plastic Waste', '🛍️'),
  mixed1: generateWasteSvg('#C4492F', 'Large Mixed Roadside Dump', '⚠️'),
  paper1: generateWasteSvg('#C48A12', 'Cardboard Packaging & Cartons', '📦'),
  glass1: generateWasteSvg('#0E6A78', 'Broken Glass Bottles & Containers', '🍾'),
  metal1: generateWasteSvg('#5F6D64', 'Discarded Beverage Cans & Scrap Iron', '🥫'),
  ewaste1: generateWasteSvg('#6B4F8F', 'Electronic Waste & Tangled Cables', '🔌'),
  plasticNew: generateWasteSvg('#C48A12', 'Plastic Waste Pending Inspection', '❓'),
  resolvedCleared: generateWasteSvg('#2E6B4E', 'Street Section Cleared & Washed', '✅'),
};

export const SEED_ACTIVE_EVENTS = [
  {
    code: 'WE-0001',
    category: 'ORGANIC',
    status: 'VERIFIED',
    severity: 2,
    estimatedWeightKg: 180,
    sensitiveSite: 'MARKET',
    addressText: 'Market Lane South corner, near Subzi Mandi',
    loc: offset(350, 400),
    daysAgo: 2,
    primaryPhoto: SEED_PHOTOS.organic1,
    supporters: 2,
  },
  {
    code: 'WE-0002',
    category: 'PLASTIC',
    status: 'VERIFIED',
    severity: 2,
    estimatedWeightKg: 120,
    sensitiveSite: 'NONE',
    addressText: 'Station Road west exit, near bus shelter',
    loc: offset(-450, 300),
    daysAgo: 3,
    primaryPhoto: SEED_PHOTOS.plastic1,
    supporters: 1,
  },
  {
    code: 'WE-0003',
    category: 'MIXED',
    status: 'VERIFIED',
    severity: 3,
    estimatedWeightKg: 250,
    sensitiveSite: 'SCHOOL',
    addressText: 'Vidya Mandir School perimeter wall, Main gate',
    loc: offset(200, -350),
    daysAgo: 4,
    primaryPhoto: SEED_PHOTOS.mixed1,
    supporters: 1, // Asha supports
  },
  {
    code: 'WE-0004',
    category: 'PAPER',
    status: 'VERIFIED',
    severity: 1,
    estimatedWeightKg: 60,
    sensitiveSite: 'NONE',
    addressText: 'Community Hall back lane, Sector 4',
    loc: offset(-200, -250),
    daysAgo: 1,
    primaryPhoto: SEED_PHOTOS.paper1,
    supporters: 0,
  },
  {
    code: 'WE-0005',
    category: 'GLASS',
    status: 'VERIFIED',
    severity: 1,
    estimatedWeightKg: 40,
    sensitiveSite: 'NONE',
    addressText: 'Commercial Plaza rear service alley',
    loc: offset(500, -100),
    daysAgo: 2,
    primaryPhoto: SEED_PHOTOS.glass1,
    supporters: 0,
  },
  {
    code: 'WE-0006',
    category: 'ORGANIC',
    status: 'VERIFIED',
    severity: 2,
    estimatedWeightKg: 200,
    sensitiveSite: 'NONE',
    addressText: 'Greenwood Apartments gate 2, roadside bin area',
    loc: offset(150, 600), // Target for live duplicate demo!
    daysAgo: 2,
    primaryPhoto: SEED_PHOTOS.organic2,
    supporters: 0,
  },
  {
    code: 'WE-0007',
    category: 'METAL',
    status: 'VERIFIED',
    severity: 2,
    estimatedWeightKg: 120,
    sensitiveSite: 'NONE',
    addressText: 'Auto Workshop cross-lane 3',
    loc: offset(-600, -400),
    daysAgo: 3,
    primaryPhoto: SEED_PHOTOS.metal1,
    supporters: 0,
  },
  {
    code: 'WE-0008',
    category: 'MIXED',
    status: 'VERIFIED',
    severity: 3,
    estimatedWeightKg: 900, // OVERSIZE: Capacity-excluded!
    sensitiveSite: 'DRAIN',
    addressText: 'Storm Drain Culvert overflow junction',
    loc: offset(-800, 200),
    daysAgo: 5,
    primaryPhoto: SEED_PHOTOS.mixed1,
    supporters: 0,
  },
  {
    code: 'WE-0009',
    category: 'E_WASTE',
    status: 'VERIFIED',
    severity: 2,
    estimatedWeightKg: 40, // INCOMPATIBLE with default truck!
    sensitiveSite: 'NONE',
    addressText: 'Tech Repair Row, shop 14 outer corridor',
    loc: offset(700, 300),
    daysAgo: 1,
    primaryPhoto: SEED_PHOTOS.ewaste1,
    supporters: 0,
  },
  {
    code: 'WE-0010',
    category: 'PLASTIC',
    status: 'SUBMITTED', // Unverified for live operator verification demo!
    severity: null,
    estimatedWeightKg: null,
    sensitiveSite: 'NONE',
    addressText: 'New Metro Foot-over-bridge stair base',
    loc: offset(300, 100),
    daysAgo: 0.5,
    primaryPhoto: SEED_PHOTOS.plasticNew,
    supporters: 0,
  },
];

export const SEED_RESOLVED_EVENTS = [
  {
    code: 'WE-0011',
    category: 'PLASTIC',
    status: 'RESOLVED',
    severity: 2,
    estimatedWeightKg: 100,
    addressText: 'Municipal Garden entrance path',
    loc: offset(100, -500),
    daysAgo: 10,
    primaryPhoto: SEED_PHOTOS.plastic2,
    closurePhoto: SEED_PHOTOS.resolvedCleared,
    closureNote: 'Fully cleared and disinfected by sanitation squad.',
  },
  {
    code: 'WE-0012',
    category: 'ORGANIC',
    status: 'RESOLVED',
    severity: 2,
    estimatedWeightKg: 140,
    addressText: 'Market Lane North intersection',
    loc: offset(400, 500),
    daysAgo: 8,
    primaryPhoto: SEED_PHOTOS.organic1,
    closurePhoto: SEED_PHOTOS.resolvedCleared,
    closureNote: 'Collected during morning round and transferred to composter.',
  },
  {
    code: 'WE-0013',
    category: 'MIXED',
    status: 'RESOLVED',
    severity: 2,
    estimatedWeightKg: 160,
    addressText: 'Subhash Road drainage culvert',
    loc: offset(-300, 600),
    daysAgo: 6,
    primaryPhoto: SEED_PHOTOS.mixed1,
    closurePhoto: SEED_PHOTOS.resolvedCleared,
    closureNote: 'Heavy loader cleared debris, drain flow restored.',
    citizenCorrectedCategory: true,
  },
];
