import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve('uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function uploadLocal(fileBuffer, mimeType = 'image/jpeg') {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const publicId = `local_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${publicId}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    imageUrl: `/uploads/${filename}`,
    imagePublicId: publicId,
    storageDriver: 'local',
  };
}
