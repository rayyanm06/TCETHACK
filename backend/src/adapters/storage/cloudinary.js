import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../../config/env.js';

if (ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY && ENV.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadCloudinary(fileBuffer, mimeType = 'image/jpeg') {
  if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY) {
    throw new Error('Cloudinary credentials not configured');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: ENV.CLOUDINARY_FOLDER,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          imageUrl: result.secure_url,
          imagePublicId: result.public_id,
          storageDriver: 'cloudinary',
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
}
