export type Role = 'CITIZEN' | 'OPERATOR';

export type WasteCategory =
  | 'ORGANIC'
  | 'PLASTIC'
  | 'PAPER'
  | 'GLASS'
  | 'METAL'
  | 'E_WASTE'
  | 'MIXED'
  | 'UNKNOWN';

export type EventStatus =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'SCHEDULED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'REOPENED'
  | 'MERGED';

export type ReportType = 'PUBLIC' | 'HOUSEHOLD';
export type SpecialistQueue = 'NONE' | 'E_WASTE' | 'HAZARDOUS' | 'HOUSEHOLD_SPECIALIST';

export type PriorityTier = 'Critical' | 'High' | 'Normal' | 'Low';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface PriorityBreakdownItem {
  key: string;
  label: string;
  points: number;
  detail: string;
}

export interface PriorityInfo {
  score: number;
  tier: PriorityTier;
  breakdown: PriorityBreakdownItem[];
  sentence: string;
  computedAt?: string;
}

export interface CompletionEvidence {
  receivingFacilityName?: string;
  receiptReference?: string;
  sourceUrl?: string;
  completionPhotoUrl?: string;
  completionPublicId?: string;
  operatorNote?: string;
  timestamp?: string;
}

export interface WasteEventSummary {
  id: string;
  code: string;
  location: GeoLocation;
  addressText?: string;
  category: WasteCategory;
  reportType?: ReportType;
  householdItems?: string;
  householdQuantity?: number;
  specialistFlag?: boolean;
  specialistQueue?: SpecialistQueue;
  status: EventStatus;
  priority: PriorityInfo;
  severity?: number;
  sensitiveSite?: string;
  estimatedWeightKg?: number;
  reportCount: number;
  supportCount: number;
  reviewedSupportCount?: number;
  thumbnailUrl?: string;
  firstReportedAt: string;
  needsCategoryReview?: boolean;
  assignedRouteId?: string;
  completionEvidence?: CompletionEvidence;
  reopenedAt?: string;
  reopenReason?: string;
}

export interface OperatorEventsResponse {
  items: WasteEventSummary[];
  counts: {
    reports: number;
    events: number;
    plannedStops: number;
    pendingSpecialist?: number;
  };
}

export interface DuplicateCandidate {
  id: string;
  code: string;
  category: WasteCategory;
  distanceM: number;
  ageHours: number;
  supportCount: number;
  photoUrl?: string;
  status: EventStatus;
}

export interface ClassifyResponse {
  imageUrl: string;
  imagePublicId: string;
  uploadToken: string;
  imageHash: string;
  ai: {
    status: 'OK' | 'UNAVAILABLE';
    category: WasteCategory;
    shortReason: string | null;
    provider?: string;
  };
}

export interface RouteStop {
  eventId: string;
  seq: number;
  weightKg: number;
  priorityScore: number;
  legDistanceM: number;
  legDurationMin: number;
  legBaseDurationMin: number;
  arrivalOffsetMin: number;
  state: 'PENDING' | 'DONE';
  completedAt?: string;
}

export interface RouteDeferred {
  eventId: string;
  reason: 'CAPACITY' | 'INCOMPATIBLE' | 'TIME' | 'NO_WEIGHT' | 'EXCLUDED';
  detail: string;
}

export interface CongestionZone {
  id: string;
  label: string;
  center: GeoLocation;
  radiusM: number;
  factor: number;
}

export interface RouteData {
  id: string;
  vehicle: {
    id: string;
    name: string;
    capacityKg: number;
  };
  depot: {
    name: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
  };
  status: 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  planVersion: number;
  stops: RouteStop[];
  deferred: RouteDeferred[];
  totals: {
    plannedLoadKg: number;
    capacityKg: number;
    remainingCapacityKg: number;
    distanceM: number;
    durationMin: number;
    baseDurationMin: number;
    priorityServed: string;
  };
  geometry: [number, number][]; // [lat, lng] for Leaflet
  previousGeometry?: [number, number][];
  congestionZones: CongestionZone[];
  trafficMode: 'NONE' | 'SIMULATED';
  costSource: 'OSRM' | 'ESTIMATE';
}

export interface RoutePreviewResponse {
  route: RouteData;
  baseline: {
    naiveDurationMin: number;
    naiveDistanceM: number;
    method: string;
  };
}

export interface ImpactTransactionItem {
  type: string;
  credits: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  reason: string;
}

export interface CitizenImpactFeedItem {
  complaintId: string;
  code: string;
  category: WasteCategory;
  addressText?: string;
  status: EventStatus;
  sentence?: string;
  photoUrl?: string;
  transactions: ImpactTransactionItem[];
}

export interface CitizenImpactResponse {
  totals: {
    verifiedCredits: number;
    pendingCredits: number;
    uniqueIncidents: number;
    supportingContributions: number;
    resolvedIncidents: number;
  };
  tier?: {
    name: string;
    nextAt: number;
  };
  feed: CitizenImpactFeedItem[];
  neighbourhood?: {
    complaintId: string;
    code: string;
    status: EventStatus;
  }[];
}

export interface ForecastCell {
  cellId: string;
  center: GeoLocation;
  expected: number;
  lastWeeks: [number, number, number];
}

export interface HotspotAnalyticsResponse {
  label: string;
  gridCellDeg: number;
  weeks: {
    weekIndex: number;
    totalUnique: number;
    cells: {
      cellId: string;
      center: GeoLocation;
      count: number;
    }[];
  }[];
  forecast: {
    weekIndex: number;
    method: string;
    weights: number[];
    cells: ForecastCell[];
  };
  evaluation: {
    heldOutWeek: number;
    maeModel: number;
    maeLastWeek: number;
    maeMean: number;
    note: string;
  };
  liveThisWeek: {
    uniqueEvents: number;
    note: string;
  };
}
