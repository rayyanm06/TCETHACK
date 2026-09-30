import { WasteEvent } from '../models/WasteEvent.js';
import { computeHotspotForecast } from '../engines/forecast.js';
const WEEK = 7*24*60*60*1000;
export async function getHotspotAnalytics() {
  // Monday 00:00 India time; exclude the current incomplete week.
  const shifted = new Date(Date.now() + 330*60000);
  shifted.setUTCHours(0,0,0,0);
  shifted.setUTCDate(shifted.getUTCDate() - ((shifted.getUTCDay()+6)%7));
  const weekStart = shifted.getTime() - 330*60000;
  const filter = {isSeed: {$ne:true}, reportContext:{$ne:'HOUSEHOLD'}, status:{$in:['VERIFIED','SCHEDULED','RESOLVED']}};
  const oldest = await WasteEvent.findOne(filter).sort({firstReportedAt:1}).lean();
  const completeWeeks = oldest ? Math.max(0,Math.min(12,Math.floor((weekStart-new Date(oldest.firstReportedAt).getTime())/WEEK))) : 0;
  const liveThisWeek = {uniqueEvents:await WasteEvent.countDocuments({...filter, firstReportedAt:{$gte:new Date(weekStart)}}),note:'Operator-reviewed public incidents reported since Monday 00:00 IST; excluded from forecast.'};
  if(completeWeeks < 4) return {status:'INSUFFICIENT_HISTORY',label:'Collecting real incident history',completeWeeks,requiredWeeks:4,weeks:[],forecast:{cells:[]},evaluation:null,liveThisWeek,note:'Four complete weeks of recorded activity are required for a three-week baseline and one held-out week. No synthetic history is used.'};
  const start = weekStart-completeWeeks*WEEK;
  const incidents = await WasteEvent.find({...filter,firstReportedAt:{$gte:new Date(start),$lt:new Date(weekStart)}}).lean();
  const formatted = incidents.map(i=>({weekIndex:Math.floor((new Date(i.firstReportedAt).getTime()-start)/WEEK)+1,location:{lat:i.location.coordinates[1],lng:i.location.coordinates[0]},category:i.category}));
  const result = computeHotspotForecast(formatted,completeWeeks,completeWeeks);
  return {...result,status:'READY',label:'Baseline from recorded, operator-reviewed public incidents',completeWeeks,periodStart:new Date(start),periodEnd:new Date(weekStart),liveThisWeek};
}
