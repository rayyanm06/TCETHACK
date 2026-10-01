import express from 'express';
import { registerUser, loginUser, syncFirebaseUser } from '../services/authService.js';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Session restoration — validate JWT and return user info
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided', code: 'NO_TOKEN' } });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Optionally refresh from DB for latest role
    const dbUser = await User.findById(decoded.id).lean();
    if (!dbUser) {
      return res.status(401).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
    }

    res.status(200).json({
      user: {
        id: dbUser._id.toString(),
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' } });
  }
});

router.post('/firebase-sync', async (req, res, next) => {
  try {
    const result = await syncFirebaseUser(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const authRoutes = router;
