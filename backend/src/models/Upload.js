import mongoose from 'mongoose';
const schema = new mongoose.Schema({ userId: {type: String, required: true}, publicId: {type: String, required: true}, imageUrl: String, imageHash: String, purpose: {type: String, enum: ['REPORT','CLOSURE']}, ai: Object, consumedByKey: String, expiresAt: Date }, {timestamps: true});
schema.index({expiresAt: 1}, {expireAfterSeconds: 0});
export const Upload = mongoose.model('Upload', schema);
