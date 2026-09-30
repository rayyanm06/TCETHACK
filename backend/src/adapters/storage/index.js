import { ENV } from '../../config/env.js';
import { uploadLocal } from './local.js';
import { uploadCloudinary } from './cloudinary.js';
export async function uploadImage(fileBuffer, mimeType = 'image/jpeg') {
  if (ENV.STORAGE_DRIVER === 'cloudinary') {
    if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) throw Object.assign(new Error('Persistent photo storage is not configured.'),{status:503,code:'STORAGE_UNAVAILABLE'});
    try { return await uploadCloudinary(fileBuffer,mimeType); }
    catch { throw Object.assign(new Error('Photo storage is unavailable. Please retry.'),{status:503,code:'STORAGE_UNAVAILABLE'}); }
  }
  if (ENV.NODE_ENV === 'production') throw Object.assign(new Error('Persistent storage is required.'),{status:503});
  return uploadLocal(fileBuffer,mimeType);
}
