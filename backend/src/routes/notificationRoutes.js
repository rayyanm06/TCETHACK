import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getOperatorNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService.js';

const router = express.Router();
const operatorAuth = [authenticate, requireRole(['OPERATOR'])];

router.get('/notifications', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await getOperatorNotifications(req.query.filter);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await markNotificationRead(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', ...operatorAuth, async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const notificationRoutes = router;
