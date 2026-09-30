import mongoose from 'mongoose';

const wasteEventSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. WE-0001
    primaryReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    addressText: { type: String, trim: true },
    category: {
      type: String,
      enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
      required: true,
    },
    aiSuggestedCategory: {
      type: String,
      enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
    },
    categoryConfirmedBy: {
      type: String,
      enum: ['CITIZEN', 'OPERATOR'],
      required: true,
      default: 'CITIZEN',
    },
    reportType: {
      type: String,
      enum: ['PUBLIC', 'HOUSEHOLD'],
      required: true,
      default: 'PUBLIC',
    },
    householdItems: { type: String, trim: true },
    householdQuantity: { type: Number, min: 1 },
    specialistFlag: { type: Boolean, default: false },
    specialistQueue: {
      type: String,
      enum: ['NONE', 'E_WASTE', 'HAZARDOUS', 'HOUSEHOLD_SPECIALIST'],
      default: 'NONE',
    },
    status: {
      type: String,
      enum: ['SUBMITTED', 'VERIFIED', 'SCHEDULED', 'RESOLVED', 'REJECTED', 'REOPENED', 'MERGED'],
      required: true,
      default: 'SUBMITTED',
    },
    severity: { type: Number, enum: [1, 2, 3] }, // S1, S2, S3
    sensitiveSite: {
      type: String,
      enum: ['NONE', 'SCHOOL', 'HOSPITAL', 'MARKET', 'DRAIN'],
      required: true,
      default: 'NONE',
    },
    estimatedWeightKg: { type: Number },
    supportCount: { type: Number, required: true, default: 0 },
    reviewedSupportCount: { type: Number, required: true, default: 0 },
    firstReportedAt: { type: Date, required: true, default: Date.now },
    lastReportedAt: { type: Date, required: true, default: Date.now },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectReason: { type: String },
    assignedRouteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closurePhotoUrl: { type: String },
    closurePublicId: { type: String },
    closureNote: { type: String },
    completionEvidence: {
      receivingFacilityName: { type: String, trim: true },
      receiptReference: { type: String, trim: true },
      sourceUrl: { type: String, trim: true },
      completionPhotoUrl: { type: String },
      completionPublicId: { type: String },
      operatorNote: { type: String },
      timestamp: { type: Date },
    },
    reopenedAt: { type: Date },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reopenReason: { type: String, trim: true },
    priority: {
      score: { type: Number, default: 0 },
      tier: { type: String, default: 'Low' },
      breakdown: { type: Array, default: [] },
      sentence: { type: String, default: '' },
      computedAt: { type: Date },
    },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

wasteEventSchema.index({ location: '2dsphere' });
wasteEventSchema.index({ status: 1, category: 1 });
wasteEventSchema.index({ assignedRouteId: 1 });

export const WasteEvent = mongoose.model('WasteEvent', wasteEventSchema);
