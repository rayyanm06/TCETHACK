import 'dotenv/config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
try {
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z
        .string()
        .email()
        .refine((v) => !v.endsWith('.demo')),
      password: z.string().min(12).max(72),
    })
    .parse({
      name: process.env.OPERATOR_NAME,
      email: process.env.OPERATOR_EMAIL,
      password: process.env.OPERATOR_PASSWORD,
    });
  await connectDB();
  if (await User.findOne({ email: data.email.toLowerCase() }))
    throw new Error(
      'Account already exists. This command does not change existing roles or credentials.',
    );
  await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash: await bcrypt.hash(data.password, 12),
    role: 'OPERATOR',
    isSeed: false,
  });
  console.log('Operator account created. Remove OPERATOR_PASSWORD from the setup environment.');
} catch (e) {
  console.error(
    e.name === 'ZodError'
      ? 'Set OPERATOR_NAME, OPERATOR_EMAIL and a password of 12–72 characters in the setup environment.'
      : e.message,
  );
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
