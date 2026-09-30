import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import sharp from 'sharp';
import mongoose from 'mongoose';
// Isolated test database and road-service fixture; never used by the app deployment.
Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:'',MONGODB_DB:'civicclean_workflow_test',ALLOW_MEMORY_DB:'true',DEMO_MODE:'false',ALLOW_ROUTING_ESTIMATES:'false',VISION_PROVIDER:'none',STORAGE_DRIVER:'local'});
let roadAvailable=true;
const road=http.createServer((req,res)=>{
  if(!roadAvailable){res.writeHead(503);res.end();return;}
  res.setHeader('Content-Type','application/json');
  const points=req.url.split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));
  res.end(JSON.stringify(req.url.startsWith('/table/')?{code:'Ok',durations:points.map((_,i)=>points.map((_,j)=>i===j?0:60+Math.abs(i-j)*10)),distances:points.map((_,i)=>points.map((_,j)=>i===j?0:500+Math.abs(i-j)*100))}:{code:'Ok',routes:[{geometry:{coordinates:points},legs:[]}]}));
});
await new Promise(r=>road.listen(0,'127.0.0.1',r));
process.env.OSRM_BASE_URL=`http://127.0.0.1:${road.address().port}`;
const {connectDB,disconnectDB}=await import('../src/config/db.js');
const {app}=await import('../src/app.js');
const {User}=await import('../src/models/User.js');
const {WasteEvent}=await import('../src/models/WasteEvent.js');
const {Report}=await import('../src/models/Report.js');
const {ImpactTransaction}=await import('../src/models/ImpactTransaction.js');
const {Upload}=await import('../src/models/Upload.js');
const {signToken}=await import('../src/utils/token.js');
const {getHotspotAnalytics}=await import('../src/services/analyticsService.js');
let server,base,operator,citizen,second,photoCounter=0;
async function call(path,token,body,method=body===undefined?'GET':'POST'){
  const res=await fetch(`${base}${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(!(body instanceof FormData)&&body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
  return {status:res.status,body:await res.json()};
}
async function photo(token,closure=false){
  const buf=await sharp({create:{width:32,height:32,channels:3,background:{r:40+(++photoCounter)*10,g:100,b:60}}}).jpeg().toBuffer();
  const form=new FormData();form.append('image',new Blob([buf],{type:'image/jpeg'}),'test.jpg');
  const r=await call(closure?'/uploads':'/classify',token,form);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;
}
async function bodyFor(token,extra={}){return {requestId:crypto.randomUUID(),uploadToken:(await photo(token)).uploadToken,location:{lat:19.2075,lng:72.8765},locationSource:'MAP_PIN',citizenCategory:'PAPER',duplicateDecision:'SEPARATE',...extra};}
before(async()=>{
  await connectDB();await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api`;
  const op=await User.create({name:'Test Operator',email:'op@example.test',passwordHash:'not-a-login-hash',role:'OPERATOR'});operator=signToken(op);
  const one=await call('/auth/register',null,{name:'First Citizen',email:'one@example.test',password:'test-only-pass-123',role:'OPERATOR'});assert.equal(one.status,201);assert.equal(one.body.user.role,'CITIZEN');citizen=one.body.token;
  const two=await call('/auth/register',null,{name:'Second Citizen',email:'two@example.test',password:'test-only-pass-123'});second=two.body.token;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));await new Promise(r=>road.close(r));await disconnectDB();});
test('database-backed citizen-to-operator workflow',async t=>{
  let primary,primaryData,electronic,household;
  await t.test('authorization and demo disablement',async()=>{
    assert.equal((await call('/complaints',citizen)).status,403);assert.equal((await call('/complaints')).status,401);assert.equal((await call('/admin/reset-demo',operator,{})).status,403);
    const r=await call('/config');assert.equal(r.body.features.demoMode,false);assert.equal(r.body.features.simulatedTraffic,false);
  });
  await t.test('corrupt uploads rejected and EXIF removed',async()=>{
    const bad=new FormData();bad.append('image',new Blob(['<script>bad</script>'],{type:'image/jpeg'}),'bad.jpg');assert.equal((await call('/classify',citizen,bad)).status,400);
    const img=await sharp({create:{width:16,height:16,channels:3,background:'#abcd00'}}).jpeg().withMetadata().toBuffer();
    const fd=new FormData();fd.append('image',new Blob([img],{type:'image/jpeg'}),'meta.jpg');const r=await call('/classify',citizen,fd);assert.equal(r.status,200);
    const evidence=await Upload.findOne({publicId:r.body.imagePublicId});const filename=evidence.imageUrl.split('/uploads/')[1];assert.equal((await sharp(`uploads/${filename}`).metadata()).exif,undefined);
  });
  await t.test('server-owned evidence, ownership and idempotency',async()=>{
    primaryData=await bodyFor(citizen,{imageUrl:'https://forged.example/photo.jpg',ai:{status:'OK',category:'METAL'}});
    const r=await call('/reports',citizen,primaryData);assert.equal(r.status,201,JSON.stringify(r.body));primary=r.body;
    assert.notEqual(r.body.report.imageUrl,'https://forged.example/photo.jpg');assert.equal(r.body.report.aiStatus,'UNAVAILABLE');
    const retry=await call('/reports',citizen,primaryData);assert.equal(retry.body.report._id,primary.report._id);assert.equal(await WasteEvent.countDocuments(),1);assert.equal(await Report.countDocuments(),1);
    assert.equal((await call(`/reports/${primary.report._id}`,second)).status,404);assert.equal((await call('/reports',second,{...primaryData,requestId:crypto.randomUUID()})).status,400);
  });
  await t.test('duplicate detection, geographic validation and retry-safe support',async()=>{
    const other=await bodyFor(second,{duplicateDecision:'NONE_FOUND'});
    assert.equal((await call('/reports',second,{...other,location:{lat:0,lng:0}})).body.error.code,'OUTSIDE_SERVICE_AREA');
    const r=await call('/reports',second,other);assert.equal(r.status,409,JSON.stringify(r.body));assert.equal(r.body.error.code,'DUPLICATE_DECISION_REQUIRED');assert.equal(r.body.error.fields.candidates[0].id,primary.complaint.id);
    assert.equal(await WasteEvent.countDocuments(),1);assert.equal(await Report.countDocuments(),1);
    const supported=await call(`/complaints/${primary.complaint.id}/support`,second,other);assert.equal(supported.status,201,JSON.stringify(supported.body));assert.equal(supported.body.complaint.supportCount,1);
    const again=await call(`/complaints/${primary.complaint.id}/support`,second,other);assert.equal(again.body.report._id,supported.body.report._id);assert.equal((await WasteEvent.findById(primary.complaint.id)).supportCount,1);
  });
  await t.test('private household requests, real analytics and operator verification',async()=>{
    const h=await call('/reports',citizen,await bodyFor(citizen,{reportContext:'HOUSEHOLD',citizenCategory:'E_WASTE',itemDescription:'Keyboard',itemCount:1}));assert.equal(h.status,201);household=h.body;
    const e=await call('/reports',second,await bodyFor(second,{citizenCategory:'E_WASTE'}));assert.equal(e.status,201);electronic=e.body;
    const pub=await call('/public/events',citizen);assert(!pub.body.items.some(e=>e.id===household.complaint.id));
    const nearby=await call('/complaints/nearby?lat=19.2075&lng=72.8765&category=E_WASTE',second);assert(!nearby.body.candidates.some(e=>e.id===household.complaint.id));
    for(const event of [primary,electronic,household]){const v=await call(`/complaints/${event.complaint.id}`,operator,{verify:true,category:event===primary?'PAPER':'E_WASTE',severity:2,estimatedWeightKg:2,sensitiveSite:'NONE'},'PATCH');assert.equal(v.status,200,JSON.stringify(v.body));}
    const analytics=await getHotspotAnalytics();assert.equal(analytics.status,'INSUFFICIENT_HISTORY');assert.equal(analytics.liveThisWeek.uniqueEvents,2);assert.equal(analytics.forecast.cells.length,0);
  });
  await t.test('fleet, compatible road routing and atomic route assignment',async()=>{
    const vehicle=await call('/vehicles',operator,{name:'Test collection vehicle',registration:'TEST-ONLY-01',capacityKg:100,maxRouteMinutes:120,stream:'DRY',depotName:'Test depot',location:{lat:19.2071,lng:72.876}});assert.equal(vehicle.status,201);
    const plan=await call('/routes/preview',operator,{vehicleId:vehicle.body.vehicle._id});assert.equal(plan.status,200,JSON.stringify(plan.body));assert.equal(plan.body.route.stops.length,1);assert.equal(plan.body.route.stops[0].eventId,primary.complaint.id);assert.equal(plan.body.route.costSource,'OSRM');
    const assigned=await call(`/routes/${plan.body.route.id}/assign`,operator,{});assert.equal(assigned.status,200,JSON.stringify(assigned.body));assert.equal(assigned.body.route.id,plan.body.route.id);assert.equal(assigned.body.route.vehicle.name,'Test collection vehicle');
    assert.equal((await call(`/routes/${plan.body.route.id}/assign`,operator,{})).status,409);assert.equal((await call(`/complaints/${primary.complaint.id}`,operator,{category:'E_WASTE'},'PATCH')).status,409);
  });
  await t.test('evidence-backed closure and exactly-once rewards',async()=>{
    assert.equal((await call(`/complaints/${primary.complaint.id}/status`,operator,{to:'RESOLVED',note:'Cleared and inspected.'},'PATCH')).status,400);
    const proof=await photo(operator,true);
    assert.equal((await call(`/complaints/${electronic.complaint.id}/status`,operator,{to:'RESOLVED',note:'Received and inspected.',closurePhoto:proof},'PATCH')).body.error.code,'HANDOFF_REQUIRED');
    const resolved=await call(`/complaints/${primary.complaint.id}/status`,operator,{to:'RESOLVED',note:'Clearance checked and recorded.',closurePhoto:proof},'PATCH');assert.equal(resolved.status,200,JSON.stringify(resolved.body));assert.equal(resolved.body.route.status,'COMPLETED');
    assert.equal((await call(`/complaints/${primary.complaint.id}/status`,operator,{to:'RESOLVED',note:'Clearance checked and recorded.',closurePhoto:proof},'PATCH')).status,409);assert.equal(await ImpactTransaction.countDocuments({complaintId:primary.complaint.id,type:'RESOLUTION_BONUS'}),2);
    const handoff=await call(`/complaints/${electronic.complaint.id}/status`,operator,{to:'RESOLVED',note:'Test receiving service acceptance checked.',closurePhoto:await photo(operator,true),handoff:{facilityName:'Test-only receiving service',reference:'TEST-RECEIPT-001',sourceUrl:'https://example.test/receipt'}},'PATCH');assert.equal(handoff.status,200);assert.equal(handoff.body.event.handoff.reference,'TEST-RECEIPT-001');
    const details=await call(`/reports/${electronic.report._id}`,second);assert.equal(details.body.complaint.status,'RESOLVED');assert.ok(details.body.closure.photoUrl);
  });
  await t.test('road outages fail explicitly instead of inventing routes',async()=>{
    const fresh=await call('/reports',second,await bodyFor(second,{citizenCategory:'PLASTIC',location:{lat:19.21,lng:72.879}}));assert.equal(fresh.status,201);
    await call(`/complaints/${fresh.body.complaint.id}`,operator,{verify:true,category:'PLASTIC',severity:1,estimatedWeightKg:1,sensitiveSite:'NONE'},'PATCH');
    roadAvailable=false;const res=await call('/routes/preview',operator,{});roadAvailable=true;assert.equal(res.status,503);
  });
});
