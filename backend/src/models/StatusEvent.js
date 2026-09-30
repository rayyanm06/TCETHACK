import mongoose from 'mongoose';

const statusEventSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ['COMPLAINT', 'ROUTE'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    from: { type: String },
    to: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: ['CITIZEN', 'OPERATOR', 'SYSTEM'], default: 'SYSTEM' },
    note: { type: String },
    meta: { type: Object },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

statusEventSchema.index({ entityId: 1, createdAt: 1 });

export const StatusEvent = mongoose.model('StatusEvent', statusEventSchema);
