import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['CITIZEN', 'OPERATOR'], required: true },
    neighbourhoodLabel: { type: String, trim: true },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
