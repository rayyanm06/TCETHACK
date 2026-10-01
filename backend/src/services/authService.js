import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken } from '../utils/token.js';

export async function registerUser({ name, email, password }) {
  if (!name || !email || !password) {
    const err = new Error('Name, email, and password are required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (password.length < 8) {
    const err = new Error('Password must be at least 8 characters long.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const err = new Error('An account with this email address already exists.');
    err.status = 409;
    err.code = 'EMAIL_TAKEN';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'CITIZEN', // Public registration is always CITIZEN
  });

  const token = signToken(user);

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const err = new Error('Email or password did not match.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error('Email or password did not match.');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const token = signToken(user);

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function syncFirebaseUser({ firebaseUid, email, name }) {
  if (!firebaseUid || !email) {
    const err = new Error('firebaseUid and email are required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const configuredOperatorEmail = (
    process.env.OPERATOR_EMAIL ||
    process.env.VITE_OPERATOR_EMAIL ||
    ''
  ).toLowerCase().trim();

  // Search by stable firebaseUid first
  let user = await User.findOne({ firebaseUid });

  // If not found by firebaseUid, link existing account by email if present
  if (!user) {
    user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.firebaseUid = firebaseUid;
      if (name && (!user.name || user.name === 'Citizen')) {
        user.name = name.trim();
      }
      if (configuredOperatorEmail && normalizedEmail === configuredOperatorEmail) {
        user.role = 'OPERATOR';
      }
      await user.save();
    }
  }

  // If user does not exist, create new citizen (or operator if configured)
  if (!user) {
    const isOperator = Boolean(configuredOperatorEmail && normalizedEmail === configuredOperatorEmail);
    const assignedRole = isOperator ? 'OPERATOR' : 'CITIZEN';

    user = await User.create({
      firebaseUid,
      email: normalizedEmail,
      name: (name && name.trim()) || (isOperator ? 'Municipal Officer' : 'Citizen'),
      role: assignedRole,
    });
  }

  const token = signToken(user);

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      firebaseUid: user.firebaseUid,
    },
  };
}
