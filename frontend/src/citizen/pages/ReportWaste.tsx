import React, {useState, useRef, useEffect} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {api} from '../../lib/api';
import {Camera, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Navigation, ShieldCheck} from 'lucide-react';
import {CategoryChip, CATEGORY_DETAILS} from '../../components/shared/CategoryChip';
import {WasteCategory, ClassifyResponse, DuplicateCandidate, GeoLocation} from '../../types/api';
import {LocationPicker} from '../../map/LocationPicker';

const button = 'w-full min-h-[48px] px-4 py-3 bg-moss text-white rounded-card font-semibold text-sm disabled:opacity-40';
const input = 'w-full px-3 py-3 border border-line bg-surface rounded-card text-sm';
const categories: WasteCategory[] = ['ORGANIC','PLASTIC','PAPER','GLASS','METAL','E_WASTE','MIXED','UNKNOWN'];

export const ReportWaste: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [household, setHousehold] = useState(params.get('mode') === 'household');
  const [step,setStep] = useState(1);
  const [preview,setPreview] = useState<string | null>(null);
  const [file,setFile] = useState<File | null>(null);
  const [evidence,setEvidence] = useState<ClassifyResponse | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [category,setCategory] = useState<WasteCategory>('UNKNOWN');
  const [description,setDescription] = useState('');
  const [special,setSpecial] = useState(false);
  const [item,setItem] = useState('');
  const [quantity,setQuantity] = useState(1);
  const [location,setLocation] = useState<GeoLocation | null>(null);
  const [source,setSource] = useState<'GPS'|'MAP_PIN'>('MAP_PIN');
  const [accuracy,setAccuracy] = useState<number | undefined>();
  const [address,setAddress] = useState('');
  const [config,setConfig] = useState<any>(null);
  const [candidates,setCandidates] = useState<DuplicateCandidate[]>([]);
  const [decision,setDecision] = useState('NONE_FOUND');
  const [result,setResult] = useState<any>(null);
  const requestId = useRef(crypto.randomUUID());
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const bbox: number[] | undefined = config?.serviceAreaBbox;
  const inside = !!(location && bbox && location.lng >= bbox[0] && location.lng <= bbox[2] && location.lat >= bbox[1] && location.lat <= bbox[3]);
  const guide = config?.disposalGuides?.find((g:any) => g.category === category);
  useEffect(() => { api.get('/config').then(setConfig).catch(() => setError('Service configuration could not load. Please refresh.')); },[]);
  useEffect(() => () => { if(preview) URL.revokeObjectURL(preview); },[preview]);

  async function upload(selected: File) {
    setError(''); setEvidence(null); setFile(selected);
    if (!['image/jpeg','image/png','image/webp'].includes(selected.type) || selected.size > 5*1024*1024) {setError('Choose a JPEG, PNG or WebP smaller than 5 MB.');return;}
    setPreview(URL.createObjectURL(selected)); setStep(2); setBusy(true);
    try {
      const form = new FormData(); form.append('image',selected);
      const res = await api.post<ClassifyResponse>('/classify',form);
      setEvidence(res); setCategory(res.ai?.status === 'OK' ? res.ai.category : 'UNKNOWN');
    } catch(e:any) { setError(e.message || 'Photo did not upload. Retry before continuing.'); }
    finally {setBusy(false);}
  }
  function gps() {
    if (!navigator.geolocation) {setError('GPS is unavailable. Tap the map to place a pin.');return;}
    setBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(p => {
      setLocation({lat:p.coords.latitude,lng:p.coords.longitude});setSource('GPS');setAccuracy(p.coords.accuracy);setBusy(false);
    },() => {setError('Could not get GPS. Allow location access or tap the map.');setBusy(false);}, {enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  async function confirmLocation() {
    if(!location || !inside) {setError('Place the waste location inside the configured pilot area.');return;}
    setError(''); setBusy(true);
    try {
      const res = household ? {candidates:[]} : await api.get<{candidates:DuplicateCandidate[]}>(`/complaints/nearby?lat=${location.lat}&lng=${location.lng}&category=${category}`);
      if(res.candidates.length) setCandidates(res.candidates);
      else {setDecision('NONE_FOUND');setStep(4);}
    } catch(e:any) {setError(e.message);}
    finally {setBusy(false);}
  }
  async function submit(target?:string) {
    if(!evidence || !location || busy) return;
    setBusy(true);setError('');
    try {
      const res = await api.post(target ? `/complaints/${target}/support` : '/reports', {
        requestId:requestId.current,uploadToken:evidence.uploadToken,location,locationSource:source,locationAccuracyM:accuracy,
        addressText:address,citizenCategory:category,description,duplicateDecision:target?'SUPPORT':decision,
        reportContext:household?'HOUSEHOLD':'PUBLIC_SPACE',itemDescription:item,itemCount:quantity,requiresSpecialHandling:special,
      });
      setResult(res);setCandidates([]);setStep(5);
    } catch(e:any) {
      if(e.code === 'DUPLICATE_DECISION_REQUIRED') setCandidates(e.fields?.candidates || []);
      else setError(e.message);
    } finally {setBusy(false);}
  }
  return <div className="space-y-4 pb-6">
    {step < 5 && <><div className="flex justify-between items-center text-xs"><button disabled={busy} onClick={() => {setError('');step>1?setStep(step-1):navigate('/');}} className="flex gap-1 items-center"><ArrowLeft size={16}/> Back</button><span>Step {step} of 4 · {['Photo','Category','Location','Review'][step-1]}</span></div><div className="grid grid-cols-4 gap-2">{[1,2,3,4].map(n=><div key={n} className={`h-1 rounded ${n<=step?'bg-moss':'bg-line'}`}/>)}</div></>}
    {error && <div role="alert" className="p-3 rounded-card bg-clay-100 text-clay text-sm flex gap-2"><AlertTriangle size={18} className="shrink-0"/>{error}</div>}
    {step === 1 && <section className="bg-surface border border-line rounded-card p-5 space-y-5">
      <h1 className="font-serif text-2xl font-semibold">Where is the waste?</h1>
      <div className="grid grid-cols-2 gap-2">{[{v:false,t:'In a public place',d:'Report a waste pile'},{v:true,t:'At my home',d:'Ask for disposal help'}].map(o=><button key={o.t} onClick={()=>setHousehold(o.v)} className={`p-3 rounded-card text-left border ${household===o.v?'border-moss bg-moss-100':'border-line'}`}><b className="text-sm">{o.t}</b><span className="block text-xs mt-1">{o.d}</span></button>)}</div>
      <p className="text-sm text-ink-2">Take a clear photograph from a safe distance. Keep faces, documents and personal details out of the frame.</p>
      {household && <p className="text-xs bg-surface-2 p-3 rounded-card">Your home location is visible only to you and authorized operators. A request does not guarantee a pickup.</p>}
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>
      <button className={button} onClick={()=>camera.current?.click()}><Camera className="inline mr-2" size={18}/>Take photo</button>
      <button className={input} onClick={()=>gallery.current?.click()}>Choose from gallery</button>
    </section>}
    {step === 2 && <section className="bg-surface border border-line rounded-card p-4 space-y-4">
      {preview && <img src={preview} alt="Your waste photograph" className="w-full h-52 object-cover rounded-card"/>}
      <h1 className="font-serif text-xl">What kind of waste?</h1>
      <p className="text-xs text-ink-2">{busy?'Uploading photograph…':evidence?.ai?.status==='OK'?`Suggested: ${CATEGORY_DETAILS[evidence.ai.category]?.label}. Please check this suggestion.`:evidence?'Photo saved. Automatic classification is unavailable; choose a category.':'Your photo must finish uploading before you can continue.'}</p>
      {!evidence && !busy && file && <button className={button} onClick={()=>upload(file)}>Retry upload</button>}
      <div className="flex flex-wrap gap-2">{categories.map(c=><CategoryChip key={c} category={c} selected={category===c} onClick={()=>setCategory(c)}/>)}</div>
      {guide && <div className="p-3 rounded-card bg-moss-100 text-sm"><b>{guide.title}</b><p className="mt-1 text-xs">{guide.message}</p></div>}
      <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={special} onChange={e=>setSpecial(e.target.checked)} className="mt-1"/>Contains batteries, chemicals, medical waste, or another item needing specialist handling</label>
      {special && <p className="text-xs text-clay">Keep your distance from leaking, hot or damaged items. Do not open, dismantle or mix them with ordinary waste.</p>}
      {household && <div className="space-y-2"><label className="block text-sm">Items<input className={input} value={item} onChange={e=>setItem(e.target.value)} maxLength={120} placeholder="e.g. One broken keyboard"/></label><label className="block text-sm">Number of items<input className={input} type="number" min={1} max={100} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label></div>}
      <label className="block text-sm">Optional notes<textarea className={input} maxLength={280} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the waste without sharing personal details"/></label>
      <button className={button} disabled={busy||!evidence||(household&&(!item.trim()||quantity<1||quantity>100))} onClick={()=>{setError('');setStep(3);}}>Set location <ArrowRight size={16} className="inline"/></button>
    </section>}
    {step === 3 && <section className="bg-surface border border-line rounded-card p-4 space-y-3">
      <h1 className="font-serif text-xl">Pin the exact location</h1><p className="text-xs text-ink-2">Use GPS, then adjust the pin if needed. You can also tap the map.</p>
      <button className={input} disabled={busy} onClick={gps}><Navigation size={16} className="inline mr-2"/>{busy?'Please wait…':'Use my location'}</button>
      <LocationPicker value={location} bbox={bbox} onChange={v=>{setLocation(v);setSource('MAP_PIN');setAccuracy(undefined);setError('');}}/>
      <p className="text-xs" aria-live="polite">{location?`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} · ${inside?'Inside pilot area':'Outside pilot area'}`:'No location selected yet'}{accuracy!==undefined?` · GPS accuracy ±${Math.round(accuracy)} m`:''}</p>
      <label className="block text-sm">Landmark or address (optional)<input className={input} value={address} maxLength={200} onChange={e=>setAddress(e.target.value)} placeholder="e.g. Opposite the library gate"/></label>
      <button className={button} disabled={busy||!inside} onClick={confirmLocation}>Confirm location</button>
    </section>}
    {step === 4 && <section className="bg-surface border border-line rounded-card p-5 space-y-4">
      <h1 className="font-serif text-2xl">Ready to send?</h1>
      {preview&&<img src={preview} alt="Report photograph" className="w-full h-40 object-cover rounded-card"/>}
      <div className="space-y-2 text-sm"><p><b>{household?'Private household disposal request':'Public waste report'}</b></p><p>{CATEGORY_DETAILS[category]?.label}{special?' · Specialist review required':''}</p>{household&&<p>{quantity} × {item}</p>}<p>{address||`${location?.lat.toFixed(5)}, ${location?.lng.toFixed(5)}`}</p>{description&&<p>{description}</p>}</div>
      <p className="text-xs text-ink-2 flex gap-2"><ShieldCheck size={18} className="shrink-0"/>An operator will review your evidence and handling needs. Collection is confirmed only after an actual assignment or receiving-service confirmation.</p>
      <button className={button} disabled={busy} onClick={()=>submit()}>{busy?'Sending…':'Submit request'}</button>
    </section>}
    {step === 5 && result && <section className="bg-surface rounded-card border border-line p-6 space-y-4 text-center"><CheckCircle2 className="text-moss mx-auto" size={48}/><h1 className="font-serif text-2xl">Request received</h1><p className="font-mono">{result.complaint.code}</p><p className="text-sm text-ink-2">Saved successfully. Follow operator updates and completion evidence in your report.</p><button className={button} onClick={()=>navigate(`/reports/${result.report._id}`)}>Track this request</button><button className={input} onClick={()=>navigate('/')}>Back home</button></section>}
    {!!candidates.length && <div className="fixed inset-0 z-[1000] bg-ink/50 flex items-end sm:items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Possible matching reports" className="bg-surface p-5 rounded-card w-full max-w-lg max-h-[85vh] overflow-auto space-y-4"><h2 className="font-serif text-xl">Is this the same waste?</h2><p className="text-sm">Check the photo and distance. Add your evidence to a matching report to avoid another collection stop.</p>{candidates.map(c=><div key={c.id} className="border border-line rounded-card p-3 space-y-2">{c.photoUrl&&<img src={c.photoUrl} alt="Possible matching waste" className="w-full h-28 object-cover rounded"/>}<p className="text-sm">{c.code} · {Math.round(c.distanceM)} m away · {CATEGORY_DETAILS[c.category]?.label}</p><button disabled={busy} className={button} onClick={()=>submit(c.id)}>Same waste — add my evidence</button></div>)}{error&&<p role="alert" className="text-clay text-sm">{error}</p>}<button disabled={busy} className={input} onClick={()=>{setCandidates([]);setDecision('SEPARATE');setStep(4);}}>Different waste — continue separately</button><button disabled={busy} className={input} onClick={()=>setCandidates([])}>Back to location</button></section></div>}
  </div>;
};
