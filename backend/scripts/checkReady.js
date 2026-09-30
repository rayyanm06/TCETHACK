import {connectDB,disconnectDB} from '../src/config/db.js';
import {ENV} from '../src/config/env.js';
import {User} from '../src/models/User.js';
import {Vehicle} from '../src/models/Vehicle.js';
import {getDurationMatrix} from '../src/adapters/routing/index.js';
const checks=[];
try {
  const db=await connectDB();
  const hello=await db.db.admin().command({hello:1});
  checks.push(['Persistent database configured',!!ENV.MONGODB_URI]);
  checks.push(['Replica set / transactions',!!hello.setName||hello.msg==='isdbgrid']);
  checks.push(['Demo disabled',!ENV.DEMO_MODE&&!ENV.ALLOW_DEMO_RESET]);
  checks.push(['Persistent photo storage configured',ENV.STORAGE_DRIVER==='cloudinary'&&!!ENV.CLOUDINARY_API_SECRET]);
  checks.push(['Non-demo operator exists',!!await User.findOne({role:'OPERATOR',isSeed:{$ne:true},email:{$not:/\.demo$/}})]);
  const vehicle=await Vehicle.findOne({isActive:true,isSeed:{$ne:true}});
  checks.push(['Real vehicle configured',!!vehicle]);
  if(vehicle){const p={lat:vehicle.depot.location.coordinates[1],lng:vehicle.depot.location.coordinates[0]};try{const m=await getDurationMatrix([p,{lat:p.lat+0.001,lng:p.lng}]);checks.push(['Road routing available',m.costSource==='OSRM']);}catch{checks.push(['Road routing available',false]);}}
  for(const [label,ok] of checks) console.log(`${ok?'PASS':'NEEDS SETUP'}: ${label}`);
  console.log('Storage credentials are checked for presence only. Upload a real photo through the app to verify the provider.');
  if(checks.some(([,ok])=>!ok))process.exitCode=1;
} catch(e){console.error('Readiness check failed:',e.message);process.exitCode=1;}
finally{await disconnectDB();}
