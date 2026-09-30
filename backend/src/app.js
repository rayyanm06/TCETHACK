import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/error.js';

import { authRoutes } from './routes/authRoutes.js';
import { configRoutes } from './routes/configRoutes.js';
import { reportRoutes } from './routes/reportRoutes.js';
import { eventRoutes } from './routes/eventRoutes.js';
import { routeRoutes } from './routes/routeRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { impactRoutes } from './routes/impactRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';

export const app = express();

// Security and CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ENV.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(Object.assign(new Error('This origin is not allowed.'), { status: 403, code: 'ORIGIN_DENIED' }));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static local uploads serving
const uploadsDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve('uploads');
app.use('/uploads', express.static(uploadsDir));

// Health Check
app.get('/api/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    status: ready ? 'READY' : 'DATABASE_UNAVAILABLE',
    service: 'CivicClean API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(['/api/classify', '/api/uploads'], rateLimit({ windowMs: 60 * 1000, limit: 12 }));
app.use(['/api/reports', '/api/complaints'], rateLimit({ windowMs: 60 * 1000, limit: 120 }));
// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', configRoutes);
app.use('/api', reportRoutes);
app.use('/api', eventRoutes);
app.use('/api', routeRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', impactRoutes);
app.use('/api', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
});

// Centralized Error Handler
app.use(errorHandler);
