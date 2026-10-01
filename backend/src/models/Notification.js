import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ['OPERATOR', 'CITIZEN'],
      default: 'OPERATOR',
      required: true,
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'HIGH_PRIORITY',
        'NEW_VERIFIED',
        'CAPACITY_EXCEEDED',
        'ROUTE_CHANGE',
        'RESOLUTION',
        'OVERDUE',
        'SYSTEM',
        'VERIFIED',
        'ASSIGNED',
        'ARRIVED',
        'COLLECTED',
        'REJECTED',
        'REOPENED',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'],
      default: 'NORMAL',
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WasteEvent',
      default: null,
    },
    eventCode: {
      type: String,
      default: null,
    },
    locationText: {
      type: String,
      default: null,
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    dedupKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);
