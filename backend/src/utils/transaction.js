import mongoose from 'mongoose';

/**
 * Executes a function within a MongoDB transaction if replica set is available,
 * or runs directly if on a standalone development instance.
 * @param {Function} fn (session) => Promise<any>
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
  // Check if server supports replica set / transactions
  const isReplicaSet = Boolean(
    mongoose.connection.client?.topology?.description?.type &&
    mongoose.connection.client.topology.description.type !== 'Single'
  );

  if (!isReplicaSet) {
    // Development or standalone fallback
    return await fn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}
