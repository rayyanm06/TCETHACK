import mongoose from 'mongoose';
import { liveOnly } from './liveOnly.js';

const reportSchema = new mongoose.Schema(
  {
    citizenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent', required: true },
    role: { type: String, enum: ['PRIMARY', 'SUPPORTING'], required: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    imageHash: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    locationSource: {
      type: String,
      enum: ['GPS', 'MAP_PIN', 'PHOTO_EXIF'],
      required: true,
    },
    locationAccuracyM: { type: Number },
    addressText: { type: String, trim: true },
    aiSuggestedCategory: {
      type: String,
      enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
    },
    aiShortReason: { type: String, maxlength: 140 },
    aiStatus: { type: String, enum: ['OK', 'UNAVAILABLE'], required: true, default: 'OK' },
    aiProvider: { type: String },
    citizenCategory: {
      type: String,
      enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
      required: true,
    },
    categoryCorrected: { type: Boolean, required: true, default: false },
    description: { type: String, maxlength: 280, trim: true },
    duplicateDecision: {
      type: String,
      enum: ['NONE_FOUND', 'SUPPORT', 'SEPARATE'],
      required: true,
      default: 'NONE_FOUND',
    },
    state: {
      type: String,
      enum: ['ACTIVE', 'REJECTED', 'WITHDRAWN'],
      required: true,
      default: 'ACTIVE',
    },
    requestId: { type: String, required: true },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ citizenId: 1, createdAt: -1 });
reportSchema.index({ complaintId: 1 });
reportSchema.index({ citizenId: 1, complaintId: 1 }, { unique: true });
reportSchema.index({ citizenId: 1, requestId: 1 }, { unique: true });

reportSchema.plugin(liveOnly);
export const Report = mongoose.model('Report', reportSchema);
