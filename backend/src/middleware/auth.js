import { User } from '../models/User.js';
import { ENV } from '../config/env.js';
import { verifyToken } from '../utils/token.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication token required.',
      },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select('name email role').lean();
    if (!user || (!ENV.DEMO_MODE && user.email.endsWith('.demo'))) throw new Error('Account unavailable');
    req.user = {id: String(user._id), name: user.name, email: user.email, role: user.role};
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired session token.',
      },
    });
  }
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        },
      });
    }

    next();
  };
}
