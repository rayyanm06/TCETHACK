import express from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getOperatorEvents,
  getPublicEvents,
  getOperatorEventById,
  updateOperatorEvent,
  resolveOperatorEvent,
  reviewSupportingReport,
  uploadClosurePhoto,
  getHotspotBlocksOverview,
} from '../services/eventService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();
const operatorAuth = [authenticate, requireRole(['OPERATOR'])];

router.get('/hotspots/blocks', authenticate, async (req, res, next) => {
  try {
    const result = await getHotspotBlocksOverview();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/complaints', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role === 'OPERATOR') {
      const result = await getOperatorEvents(req.query);
      return res.status(200).json(result);
    }
    const result = await getPublicEvents(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/complaints/:id', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getOperatorEventById(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/complaints/:id', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await updateOperatorEvent(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/complaints/:id/status', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await resolveOperatorEvent(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/complaints/:id/support/:reportId/review', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await reviewSupportingReport(req.params.id, req.params.reportId, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/uploads', ...operatorAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'NO_FILE', message: 'No image uploaded' } });
    }
    const result = await uploadClosurePhoto(req.file.buffer, req.file.mimetype, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const eventRoutes = router;
