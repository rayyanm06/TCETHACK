import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    registration: { type: String },
    capacityKg: { type: Number, required: true, default: 1000 },
    acceptedCategories: {
      type: [String],
      default: ['ORGANIC', 'PLASTIC', 'PAPER', 'GLASS', 'METAL', 'MIXED'],
    },
    depot: {
      name: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [lng, lat]
      },
    },
    maxRouteMinutes: { type: Number, required: true, default: 180 },
    isActive: { type: Boolean, required: true, default: true },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
