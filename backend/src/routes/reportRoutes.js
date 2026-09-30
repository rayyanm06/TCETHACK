import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import {
  classifyUploadedPhoto,
  findNearbyCandidates,
  createPrimaryReport,
  supportExistingEvent,
  getCitizenReports,
  getReportDetails,
  reopenResolvedReport,
} from '../services/reportService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = express.Router();

// POST /api/classify
router.post('/classify', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'Please attach a waste photograph.' },
      });
    }
    const result = await classifyUploadedPhoto(req.file.buffer, req.file.mimetype, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/nearby
router.get('/complaints/nearby', authenticate, async (req, res, next) => {
  try {
    const { lat, lng, category } = req.query;
    const result = await findNearbyCandidates(lat, lng, category);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports
router.post('/reports', authenticate, async (req, res, next) => {
  try {
    const result = await createPrimaryReport(req.body, req.user.id);
    const status = result.isRetry ? 200 : 201;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints/:id/support
router.post('/complaints/:id/support', authenticate, async (req, res, next) => {
  try {
    const result = await supportExistingEvent(req.params.id, req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/mine
router.get('/reports/mine', authenticate, async (req, res, next) => {
  try {
    const result = await getCitizenReports(req.user.id, req.query.status);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id
router.get('/reports/:id', authenticate, async (req, res, next) => {
  try {
    const result = await getReportDetails(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/reopen (Citizen disputes resolution if waste not cleared)
router.post('/reports/:id/reopen', authenticate, async (req, res, next) => {
  try {
    const result = await reopenResolvedReport(req.params.id, req.body, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const reportRoutes = router;
