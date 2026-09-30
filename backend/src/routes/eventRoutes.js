import express from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getOperatorEvents,
  getOperatorEventById,
  updateOperatorEvent,
  resolveOperatorEvent,
  uploadClosurePhoto,
  reviewSupportingEvidence,
} from '../services/eventService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();
const operatorAuth = [authenticate, requireRole(['OPERATOR'])];

router.get('/complaints', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getOperatorEvents(req.query);
    res.status(200).json(result);
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

router.patch('/complaints/:id/evidence', ...operatorAuth, async(req,res,next)=>{try{res.json(await reviewSupportingEvidence(req.params.id,req.body,req.user.id));}catch(err){next(err);}});

router.patch('/complaints/:id/status', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await resolveOperatorEvent(req.params.id, req.body, req.user.id);
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
