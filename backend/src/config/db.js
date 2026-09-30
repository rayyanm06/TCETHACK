import mongoose from 'mongoose';
import { ENV } from './env.js';

let memoryServerInstance = null;

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  let uri = ENV.MONGODB_URI;

  if (!uri) {
    if (process.env.VERCEL) {
      console.warn('[DB] Running on Vercel without MONGODB_URI. Configure MONGODB_URI in Vercel environment variables.');
      return null;
    }
    console.log('[DB] No MONGODB_URI specified in environment. Starting embedded in-memory MongoDB...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create({
        instance: {
          dbName: ENV.MONGODB_DB,
        },
      });
      uri = memoryServerInstance.getUri();
      console.log(`[DB] Embedded in-memory MongoDB running at: ${uri}`);
    } catch (err) {
      console.error('[DB] Failed to start MongoMemoryServer:', err.message);
      uri = `mongodb://127.0.0.1:27017/${ENV.MONGODB_DB}`;
    }
  }

  try {
    await mongoose.connect(uri, {
      dbName: ENV.MONGODB_DB,
      autoIndex: true,
    });
    console.log(`[DB] Connected successfully to MongoDB: ${ENV.MONGODB_DB}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[DB] Failed to connect to ${uri}:`, err.message);
    throw err;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
}
