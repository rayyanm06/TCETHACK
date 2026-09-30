import mongoose from 'mongoose';

const historyIncidentSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    weekIndex: { type: Number, required: true }, // 1 to 12
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    cellId: { type: String, required: true },
    category: {
      type: String,
      enum: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'E_WASTE', 'MIXED', 'UNKNOWN'],
      required: true,
    },
    source: { type: String, default: 'SYNTHETIC' },
    isSeed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

historyIncidentSchema.index({ weekIndex: 1, cellId: 1 });
historyIncidentSchema.index({ location: '2dsphere' });

export const HistoryIncident = mongoose.model('HistoryIncident', historyIncidentSchema);
