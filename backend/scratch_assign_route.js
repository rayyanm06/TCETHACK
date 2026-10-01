import { connectDB } from './src/config/db.js';
import { previewRoute, assignRoute } from './src/services/routeService.js';
import { User } from './src/models/User.js';

await connectDB();
const operator = await User.findOne({ role: 'OPERATOR' }).lean();
console.log('Operator:', operator.email);

const preview = await previewRoute({}, operator._id);
console.log('Preview route generated with stops:', preview.route.stops.length);
console.log('Stop event IDs:', preview.route.stops.map(s => s.eventId));

const assigned = await assignRoute(preview.route._id, operator._id);
console.log('Route assigned successfully:', assigned.route._id, 'Status:', assigned.route.status);
process.exit(0);
