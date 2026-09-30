import mongoose from 'mongoose';
import { ENV } from './env.js';
let memoryServerInstance;
let connecting;
export function validateRuntime() {
  if (!ENV.MONGODB_URI && !ENV.ALLOW_MEMORY_DB) throw new Error('MONGODB_URI is required. Temporary databases are disabled.');
  if (ENV.NODE_ENV === 'production') {
    for (const name of ['JWT_SECRET', 'UPLOAD_TOKEN_SECRET']) {
      if (!process.env[name] || process.env[name].length < 32 || process.env[name].includes('civicclean-')) throw new Error(`${name} must be a unique secret of at least 32 characters.`);
    }
    if (ENV.STORAGE_DRIVER !== 'cloudinary' || !ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) throw new Error('Configure persistent Cloudinary storage before production startup.');
  }
}
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;
  connecting = (async () => {
    validateRuntime();
    let uri = ENV.MONGODB_URI;
    if (!uri) {
      const { MongoMemoryReplSet } = await import('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryReplSet.create({replSet: {count: 1}});
      uri = memoryServerInstance.getUri();
    }
    await mongoose.connect(uri, { dbName: ENV.MONGODB_DB, serverSelectionTimeoutMS: 8000 });
    const hello = await mongoose.connection.db.admin().command({hello:1});
    if (!hello.setName && hello.msg !== 'isdbgrid') { await mongoose.disconnect(); throw new Error('A MongoDB replica set is required for reliable multi-record transactions.'); }
    await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
    return mongoose.connection;
  })();
  try { return await connecting; } finally { connecting = null; }
}
export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServerInstance) await memoryServerInstance.stop();
}
