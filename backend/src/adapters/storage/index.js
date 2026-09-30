import { ENV } from '../../config/env.js';
import { uploadLocal } from './local.js';
import { uploadCloudinary } from './cloudinary.js';

export async function uploadImage(fileBuffer, mimeType = 'image/jpeg') {
  if (ENV.STORAGE_DRIVER === 'cloudinary' && ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY) {
    try {
      return await uploadCloudinary(fileBuffer, mimeType);
    } catch (err) {
      console.warn('[Storage] Cloudinary upload failed, falling back to local storage:', err.message);
      return await uploadLocal(fileBuffer, mimeType);
    }
  }
  return await uploadLocal(fileBuffer, mimeType);
}
