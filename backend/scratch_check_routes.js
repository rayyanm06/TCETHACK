import { connectDB } from './src/config/db.js';
import { Route } from './src/models/Route.js';
import { WasteEvent } from './src/models/WasteEvent.js';

await connectDB();
const active = await Route.find({ status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } }).lean();
console.log('Active routes count:', active.length);
for (const r of active) {
  console.log('Route:', r._id, r.status, 'stops:', r.stops.map(s => ({ eventId: s.eventId, state: s.state })));
}

const verifiedEvents = await WasteEvent.find({ status: 'VERIFIED' }).lean();
console.log('Verified events:', verifiedEvents.map(e => ({ id: e._id, code: e.code, assignedRouteId: e.assignedRouteId })));

process.exit(0);
