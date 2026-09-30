import {z} from 'zod';
import {Vehicle} from '../models/Vehicle.js';
import {coordinatesSchema,fail} from '../utils/validation.js';
import {isInsideBoundingBox} from '../engines/geo.js';
import {THRESHOLDS} from '../config/thresholds.js';
export const STREAMS = {WET:['ORGANIC'],DRY:['PLASTIC','PAPER','GLASS','METAL'],RESIDUAL:['MIXED']};
export async function createVehicle(data) {
  const v = z.object({name:z.string().trim().min(2).max(100),registration:z.string().trim().min(3).max(30),capacityKg:z.number().int().min(1).max(10000),maxRouteMinutes:z.number().int().min(10).max(480),stream:z.enum(['WET','DRY','RESIDUAL']),depotName:z.string().trim().min(3).max(120),location:coordinatesSchema}).strict().parse(data);
  if(!isInsideBoundingBox(v.location,THRESHOLDS.SERVICE_AREA_BBOX)) fail('Depot must be inside the configured pilot area.');
  if(await Vehicle.findOne({registration:v.registration.toUpperCase()})) fail('This vehicle registration is already configured.','VEHICLE_EXISTS',409);
  const vehicle = await Vehicle.create({name:v.name,registration:v.registration.toUpperCase(),capacityKg:v.capacityKg,maxRouteMinutes:v.maxRouteMinutes,acceptedCategories:STREAMS[v.stream],depot:{name:v.depotName,location:{type:'Point',coordinates:[v.location.lng,v.location.lat]}},isSeed:false});
  return {vehicle};
}
