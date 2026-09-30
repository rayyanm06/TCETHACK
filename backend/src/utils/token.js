import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    {
      id: user._id ? user._id.toString() : user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, ENV.JWT_SECRET);
}

export function signUploadToken(publicId, userId) {
  const timestamp = Date.now();
  const payload = `${publicId}:${userId}:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', ENV.UPLOAD_TOKEN_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

export function verifyUploadToken(token, expectedUserId) {
  try {
    const raw = Buffer.from(token, 'base64').toString('ascii');
    const parts = raw.split(':');
    if (parts.length !== 4) return false;

    const [publicId, userId, timestampStr, hmac] = parts;
    if (expectedUserId && userId !== expectedUserId.toString()) return false;

    // Check expiry (30 min)
    const timestamp = Number(timestampStr);
    if (Date.now() - timestamp > 30 * 60 * 1000) return false;

    const payload = `${publicId}:${userId}:${timestampStr}`;
    const expectedHmac = crypto
      .createHmac('sha256', ENV.UPLOAD_TOKEN_SECRET)
      .update(payload)
      .digest('hex');

    return hmac === expectedHmac;
  } catch (err) {
    return false;
  }
}
