import mongoose from 'mongoose';

const uploadEvidenceSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: {
      type: String,
      enum: ['CITIZEN_REPORT', 'OPERATOR_CLOSURE', 'SPECIALIST_RECEIPT'],
      required: true,
      default: 'CITIZEN_REPORT',
    },
    imageUrl: { type: String, required: true },
    imageHash: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    aiResult: {
      status: { type: String, enum: ['OK', 'UNAVAILABLE'], default: 'UNAVAILABLE' },
      category: {
        type: String,
        enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      shortReason: { type: String, maxlength: 140 },
      provider: { type: String, default: 'none' },
    },
    used: { type: Boolean, required: true, default: false },
    usedAt: { type: Date },
    usedForId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

uploadEvidenceSchema.index({ ownerId: 1, createdAt: -1 });
uploadEvidenceSchema.index({ imageHash: 1 });
uploadEvidenceSchema.index({ used: 1 });

export const UploadEvidence = mongoose.model('UploadEvidence', uploadEvidenceSchema);
