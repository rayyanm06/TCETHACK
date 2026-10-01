import mongoose from 'mongoose';

const routeStopSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent', required: true },
    seq: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    priorityScore: { type: Number, required: true },
    legDistanceM: { type: Number, required: true },
    legDurationMin: { type: Number, required: true },
    legBaseDurationMin: { type: Number, required: true },
    arrivalOffsetMin: { type: Number, required: true },
    state: {
      type: String,
      enum: ['PENDING', 'EN_ROUTE', 'ARRIVED', 'DONE', 'SKIPPED'],
      required: true,
      default: 'PENDING',
    },
    arrivedAt: { type: Date },
    arrivalType: {
      type: String,
      enum: ['GPS_PROXIMITY', 'MANUAL_OVERRIDE'],
    },
    arrivalReason: { type: String, trim: true },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completionPhotoUrl: { type: String },
    completionPublicId: { type: String },
    operatorNote: { type: String, trim: true },
    aiReview: {
      assessment: {
        type: String,
        enum: ['APPEARS_CLEARED', 'WASTE_REMAINS', 'UNABLE_TO_ASSESS'],
      },
      confidence: { type: Number },
      shortReason: { type: String },
      provider: { type: String },
    },
  },
  { _id: false }
);

const routeDeferredSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent', required: true },
    reason: {
      type: String,
      enum: ['CAPACITY', 'INCOMPATIBLE', 'TIME', 'NO_WEIGHT', 'EXCLUDED'],
      required: true,
    },
    detail: { type: String, required: true },
  },
  { _id: false }
);

const congestionZoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    radiusM: { type: Number, required: true },
    factor: { type: Number, required: true },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    depot: {
      name: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      required: true,
      default: 'DRAFT',
    },
    planVersion: { type: Number, required: true, default: 1 },
    stops: { type: [routeStopSchema], default: [] },
    deferred: { type: [routeDeferredSchema], default: [] },
    totals: {
      plannedLoadKg: { type: Number, required: true, default: 0 },
      capacityKg: { type: Number, required: true },
      remainingCapacityKg: { type: Number, required: true },
      distanceM: { type: Number, required: true, default: 0 },
      durationMin: { type: Number, required: true, default: 0 },
      baseDurationMin: { type: Number, required: true, default: 0 },
      priorityServed: { type: String, default: '' },
    },
    geometry: { type: [[Number]], default: [] }, // [[lat, lng], ...]
    previousGeometry: { type: [[Number]] },
    congestionZones: { type: [congestionZoneSchema], default: [] },
    trafficMode: { type: String, enum: ['NONE', 'SIMULATED'], default: 'NONE' },
    costSource: { type: String, enum: ['OSRM', 'ESTIMATE'], default: 'OSRM' },
    liveTracking: {
      lat: { type: Number },
      lng: { type: Number },
      accuracyM: { type: Number },
      heading: { type: Number },
      speedMs: { type: Number },
      timestamp: { type: Date },
      isLive: { type: Boolean, default: false },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      deviceId: { type: String },
    },
    planHistory: { type: [Object], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

routeSchema.index({ vehicleId: 1, status: 1 });

export const Route = mongoose.model('Route', routeSchema);
