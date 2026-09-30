import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB: process.env.MONGODB_DB || 'civicclean',
  DEMO_MODE: process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production',
  ALLOW_MEMORY_DB: process.env.ALLOW_MEMORY_DB === 'true' && process.env.NODE_ENV !== 'production',
  ALLOW_ROUTING_ESTIMATES: process.env.ALLOW_ROUTING_ESTIMATES === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'civicclean-jwt-secret-key-32chars-min',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  UPLOAD_TOKEN_SECRET: process.env.UPLOAD_TOKEN_SECRET || 'civicclean-upload-token-secret-key-32chars',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'civicclean',
  VISION_PROVIDER: process.env.VISION_PROVIDER || 'none',
  VISION_MODEL: process.env.VISION_MODEL || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OSRM_BASE_URL: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  OSRM_TIMEOUT_MS: Number(process.env.OSRM_TIMEOUT_MS) || 6000,
  ALLOW_DEMO_RESET: process.env.DEMO_MODE === 'true' && process.env.ALLOW_DEMO_RESET === 'true' && process.env.NODE_ENV !== 'production',
};
