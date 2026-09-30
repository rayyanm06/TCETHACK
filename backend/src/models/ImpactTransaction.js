import mongoose from 'mongoose';

const impactTransactionSchema = new mongoose.Schema(
  {
    citizenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent', required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    type: {
      type: String,
      enum: [
        'UNIQUE_REPORT',
        'SUPPORTING_REPORT',
        'CLASSIFICATION_CORRECTION',
        'RESOLUTION_BONUS',
      ],
      required: true,
    },
    credits: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'],
      required: true,
      default: 'PENDING',
    },
    reason: { type: String, required: true },
    verifiedAt: { type: Date },
    closedAt: { type: Date },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

impactTransactionSchema.index({ citizenId: 1, status: 1 });
impactTransactionSchema.index({ complaintId: 1 });
impactTransactionSchema.index({ reportId: 1, type: 1 }, { unique: true });

export const ImpactTransaction = mongoose.model('ImpactTransaction', impactTransactionSchema);
