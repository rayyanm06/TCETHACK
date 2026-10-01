import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getOperatorNotifications,
  getCitizenNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService.js';

const router = express.Router();

router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'CITIZEN') {
      const result = await getCitizenNotifications(req.user.id);
      return res.status(200).json(result);
    }
    const result = await getOperatorNotifications(req.query.filter);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    const result = await markNotificationRead(req.params.id, req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead(req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const notificationRoutes = router;
