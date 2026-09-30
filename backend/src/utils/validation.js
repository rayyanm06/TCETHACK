import { z } from 'zod';
import { THRESHOLDS } from '../config/thresholds.js';
export const coordinatesSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) });
export const reportSchema = z.object({
  requestId: z.string().uuid(), uploadToken: z.string().min(10),
  location: coordinatesSchema, locationSource: z.enum(['GPS', 'MAP_PIN', 'PHOTO_EXIF']),
  locationAccuracyM: z.number().nonnegative().optional(), addressText: z.string().trim().max(200).optional(),
  citizenCategory: z.enum(THRESHOLDS.CATEGORIES), description: z.string().trim().max(280).optional(),
  duplicateDecision: z.enum(['NONE_FOUND', 'SUPPORT', 'SEPARATE']).default('NONE_FOUND'),
  reportContext: z.enum(['PUBLIC_SPACE', 'HOUSEHOLD']).default('PUBLIC_SPACE'),
  itemDescription: z.string().trim().max(120).optional(), itemCount: z.number().int().min(1).max(100).optional(),
  requiresSpecialHandling: z.boolean().default(false),
}).passthrough();
export function fail(message, code = 'VALIDATION_ERROR', status = 400) { throw Object.assign(new Error(message), { status, code }); }
export function validateImage(buffer, mime) {
  if (!buffer || buffer.length > 5 * 1024 * 1024) fail('Choose an image smaller than 5 MB.');
  const valid = mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    || mime === 'image/png' && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || mime === 'image/webp' && buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP';
  if (!valid) fail('Please upload a JPEG, PNG or WebP image.', 'INVALID_IMAGE');
}
