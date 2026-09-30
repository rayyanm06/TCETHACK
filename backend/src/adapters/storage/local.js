import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve('uploads');

// Ensure directory exists safely
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[Storage] Could not create local uploads directory:', err.message);
}

export async function uploadLocal(fileBuffer, mimeType = 'image/jpeg') {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const publicId = `local_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${publicId}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    await fs.promises.writeFile(filePath, fileBuffer);
  } catch (err) {
    console.error('[Storage] Write to disk failed:', err.message);
    const writeErr = new Error(`Failed to persist uploaded evidence to local disk: ${err.message}`);
    writeErr.code = 'STORAGE_WRITE_ERROR';
    writeErr.status = 500;
    throw writeErr;
  }

  return {
    imageUrl: `/uploads/${filename}`,
    imagePublicId: publicId,
    storageDriver: 'local',
  };
}
