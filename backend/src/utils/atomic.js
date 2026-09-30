import mongoose from 'mongoose';
mongoose.set('transactionAsyncLocalStorage', true);
export function atomic(work) { return mongoose.connection.transaction(work); }
