import { ENV } from '../../config/env.js';
import { uploadLocal } from './local.js';
import { uploadCloudinary } from './cloudinary.js';

export async function uploadImage(fileBuffer, mimeType = 'image/jpeg') {
  if (ENV.STORAGE_DRIVER === 'cloudinary') {
    if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
      const err = new Error(
        'STORAGE_DRIVER is set to "cloudinary", but required Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete in environment.'
      );
      err.code = 'STORAGE_CONFIG_ERROR';
      err.status = 500;
      throw err;
    }

    try {
      return await uploadCloudinary(fileBuffer, mimeType);
    } catch (err) {
      console.error('[Storage] Cloudinary upload failed:', err.message);
      const uploadErr = new Error(`Cloudinary upload failed: ${err.message}`);
      uploadErr.code = 'STORAGE_UPLOAD_ERROR';
      uploadErr.status = 502;
      throw uploadErr;
    }
  }

  return await uploadLocal(fileBuffer, mimeType);
}
