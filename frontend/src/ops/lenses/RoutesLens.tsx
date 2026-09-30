import {useState,useEffect} from 'react';
import {api} from '../../lib/api';
import {RouteData,RoutePreviewResponse,CongestionZone,WasteEventSummary,GeoLocation} from '../../types/api';
import {LocationPicker} from '../../map/LocationPicker';
interface Props {events:WasteEventSummary[];onRouteChanged:(r:RouteData|null,z:CongestionZone[])=>void;onSelectEvent:(id:string)=>void}
const field='w-full p-2 border border-line bg-surface rounded text-sm';
export function RoutesLens({events,onRouteChanged,onSelectEvent}:Props) {
  const [route,setRoute] = useState<RouteData|null>(null), [vehicles,setVehicles] = useState<any[]>([]), [vehicleId,setVehicleId] = useState('');
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [showFleet,setShowFleet] = useState(false);
  const [name,setName]=useState(''),[registration,setRegistration]=useState(''),[capacity,setCapacity]=useState(''),[minutes,setMinutes]=useState('180'),[stream,setStream]=useState('DRY'),[depot,setDepot]=useState(''),[point,setPoint]=useState<GeoLocation|null>(null);
  async function load() {
    try {
      const [v,r]=await Promise.all([api.get<{items:any[]}>('/vehicles'),api.get<{items:RouteData[]}>('/routes')]);
      setVehicles(v.items);setVehicleId(id=>id||v.items[0]?._id||'');
      const active=r.items.find(x=>x.status==='ASSIGNED'||x.status==='IN_PROGRESS');
      if(active){setRoute(active);onRouteChanged(active,[]);}else if(route?.status==='ASSIGNED'||route?.status==='IN_PROGRESS'){setRoute(null);onRouteChanged(null,[]);}
    }catch(e:any){setError(e.message);}
  }
  useEffect(()=>{load();},[events]);
  async function preview() {
    setBusy(true);setError('');
    try {const res=await api.post<RoutePreviewResponse>('/routes/preview',{vehicleId});setRoute(res.route);onRouteChanged(res.route,[]);}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function assign() {
    if(!route)return;setBusy(true);setError('');
    try{const res=await api.post<{route:RouteData}>(`/routes/${route.id}/assign`);setRoute(res.route);onRouteChanged(res.route,[]);}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function addVehicle(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {await api.post('/vehicles',{name,registration,capacityKg:Number(capacity),maxRouteMinutes:Number(minutes),stream,depotName:depot,location:point});setShowFleet(false);await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  const special = events.filter((e:any)=>['SUBMITTED','VERIFIED'].includes(e.status)&&(e.category==='E_WASTE'||e.requiresSpecialHandling||e.reportContext==='HOUSEHOLD'));
  return <aside className="absolute left-0 top-0 bottom-0 z-20 w-full sm:w-[380px] bg-surface/95 border-r border-line p-4 overflow-auto space-y-4"><h1 className="font-serif text-xl">Collection planner</h1><p className="text-xs text-ink-2">Verified public waste, grouped by compatible stream. Road distance and driving-time estimates come from OSRM; they exclude live traffic and on-site collection time.</p>{error&&<p role="alert" className="p-3 bg-clay-100 text-clay rounded text-sm">{error}</p>}
    <label className="block text-sm">Available vehicle<select className={field} value={vehicleId} onChange={e=>setVehicleId(e.target.value)}><option value="">Select a configured vehicle</option>{vehicles.map(v=><option key={v._id} value={v._id}>{v.name} · {v.capacityKg} kg · {v.acceptedCategories.join(', ')}</option>)}</select></label>
    {!vehicles.length&&<p className="text-sm">No real vehicles configured. Add a vehicle you have arranged to use, with its actual capacity and depot.</p>}
    <button className="text-moss underline text-sm" onClick={()=>setShowFleet(!showFleet)}>{showFleet?'Close vehicle form':'Configure a collection vehicle'}</button>
    {showFleet&&<form onSubmit={addVehicle} className="p-3 bg-surface-2 rounded-card space-y-3"><label className="block text-xs">Vehicle name<input required className={field} value={name} onChange={e=>setName(e.target.value)}/></label><label className="block text-xs">Registration<input required className={field} value={registration} onChange={e=>setRegistration(e.target.value)}/></label><div className="grid grid-cols-2 gap-2"><label className="block text-xs">Capacity, kg<input required type="number" min={1} max={10000} className={field} value={capacity} onChange={e=>setCapacity(e.target.value)}/></label><label className="block text-xs">Driving budget, minutes<input required type="number" min={10} max={480} className={field} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div><label className="block text-xs">Collection stream<select className={field} value={stream} onChange={e=>setStream(e.target.value)}><option value="DRY">Dry recyclables</option><option value="WET">Wet / organic</option><option value="RESIDUAL">Mixed / residual</option></select></label><label className="block text-xs">Actual depot name<input required className={field} value={depot} onChange={e=>setDepot(e.target.value)}/></label><p className="text-xs">Tap the actual depot location.</p><LocationPicker value={point} onChange={setPoint}/><button disabled={busy||!point} className="w-full p-3 bg-moss text-white rounded disabled:opacity-40">Save vehicle</button></form>}
    <button disabled={busy||!vehicleId||route?.status==='ASSIGNED'||route?.status==='IN_PROGRESS'} onClick={preview} className="w-full p-3 rounded-card bg-lagoon text-white text-sm font-semibold disabled:opacity-40">{busy?'Working…':'Generate road-based plan'}</button>
    {route&&<section className="space-y-3"><div className="bg-surface-2 p-3 rounded-card"><b>{route.vehicle.name}</b><p className="text-xs mt-1">{route.status} · {route.totals.plannedLoadKg}/{route.totals.capacityKg} kg</p><p className="text-sm mt-2">{(route.totals.distanceM/1000).toFixed(1)} km · ≈ {route.totals.durationMin} min driving</p><p className="text-xs mt-1">Depot: {route.depot.name} · Returns to depot</p></div>{route.stops.map(s=><button key={s.eventId} onClick={()=>onSelectEvent(s.eventId)} className="w-full text-left border border-line rounded p-3 text-sm"><b>{s.seq}. {events.find(e=>e.id===s.eventId)?.code||'Report'}</b><p className="text-xs">{s.weightKg} kg · {s.state==='DONE'?'Completion recorded':'Open evidence and actions'}</p></button>)}{!!route.deferred.length&&<div className="space-y-2"><h2 className="text-sm font-semibold">Not included in this plan</h2>{route.deferred.map(d=><p key={d.eventId} className="text-xs p-2 bg-ochre-100 rounded">{events.find(e=>e.id===d.eventId)?.code}: {d.detail}</p>)}</div>}{route.status==='DRAFT'&&<><p className="text-xs">Confirm crew availability separately. This action records the assignment; it does not send a dispatch notification.</p><button disabled={busy} onClick={assign} className="w-full p-3 bg-moss text-white rounded-card text-sm font-semibold">Confirm route assignment</button></>}</section>}
    {!!special.length&&<section className="border-t border-line pt-4 space-y-2"><h2 className="font-semibold text-sm">Separate handoff queue · {special.length}</h2><p className="text-xs">Household, e-waste and specialist requests stay outside ordinary collection routes.</p>{special.map(e=><button key={e.id} onClick={()=>onSelectEvent(e.id)} className="block w-full p-3 rounded border border-plum/30 text-left text-sm">{e.code} · {e.category.replace('_',' ')}<span className="block text-xs">Review receiving service and evidence →</span></button>)}</section>}
  </aside>;
}
