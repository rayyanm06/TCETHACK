import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import fs from 'fs';
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
      // Allow localhost and specified CORS origins
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static local uploads serving with CORS headers
const uploadsDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn('[App] Could not create uploadsDir:', err.message);
  }
}
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cache-Control', 'public, max-age=86400');
    },
  })
);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    status: 'HEALTHY',
    service: 'CivicClean API',
    timestamp: new Date().toISOString(),
  });
});

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
