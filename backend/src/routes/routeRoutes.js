import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import {
  previewRoute,
  assignRoute,
  replanRoute,
  getActiveRoutes,
  getRouteById,
  getVehicles,
  recordTelemetry,
  recordStopArrival,
  confirmStopCollection,
  reviewStopEvidence,
} from '../services/routeService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();
const operatorAuth = [authenticate, requireRole(['OPERATOR'])];

router.post('/routes/preview', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await previewRoute(req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/routes/:id/assign', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await assignRoute(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/routes/:id/replan', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await replanRoute(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/routes', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getActiveRoutes();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/routes/:id', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getRouteById(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/vehicles', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getVehicles();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Telemetry from live collection session
router.post('/routes/:id/telemetry', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await recordTelemetry(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Stop arrival transition (GPS proximity or manual override with recorded reason)
router.post('/routes/:id/stops/:eventId/arrive', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await recordStopArrival(req.params.id, req.params.eventId, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Stop collection confirmation with after-photo, AI review, operator note & credit awards
router.post('/routes/:id/stops/:eventId/confirm-collection', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await confirmStopCollection(req.params.id, req.params.eventId, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Supporting AI before/after photographic clearance comparison
router.post('/routes/:id/stops/:eventId/ai-review', ...operatorAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'NO_FILE', message: 'No after-collection photo provided for AI review' } });
    }
    const result = await reviewStopEvidence(req.params.eventId, req.file.buffer, req.file.mimetype);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const routeRoutes = router;
