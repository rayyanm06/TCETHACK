import { WasteEvent } from '../models/WasteEvent.js';
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
  reopenReport,
} from '../services/reportService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = express.Router();

// No household coordinates, identities, or uploaded evidence are exposed here.
router.get('/public/events', authenticate, async (req, res, next) => {
  try {
    const events = await WasteEvent.find({reportContext: {$ne:'HOUSEHOLD'}, status: {$in:['SUBMITTED','VERIFIED','SCHEDULED']}}).select('code category status location firstReportedAt supportCount').sort({createdAt:-1}).limit(200).lean();
    res.json({items: events.map(e => ({id:String(e._id), code:e.code, category:e.category, status:e.status, location:{lat:e.location.coordinates[1],lng:e.location.coordinates[0]}, firstReportedAt:e.firstReportedAt, supportCount:e.supportCount}))});
  } catch (err) { next(err); }
});

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
    res.status(201).json(result);
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

router.post('/reports/:id/reopen',authenticate,async(req,res,next)=>{try{res.json(await reopenReport(req.params.id,req.body,req.user.id));}catch(err){next(err);}});

// GET /api/reports/:id
router.get('/reports/:id', authenticate, async (req, res, next) => {
  try {
    const result = await getReportDetails(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const reportRoutes = router;
