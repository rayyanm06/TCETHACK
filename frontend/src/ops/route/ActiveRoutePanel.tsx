import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RouteData, WasteEventSummary, RouteStop } from '../../types/api.ts';
import { RouteSimulationState } from './routeSimulation.ts';
import { api } from '../../lib/api.ts';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Truck,
  ChevronDown,
  ChevronUp,
  Radio,
  Camera,
  UploadCloud,
  Check,
  X,
  FileCheck,
  ShieldCheck,
  Eye,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ActiveRoutePanelProps {
  route: RouteData | null;
  events: WasteEventSummary[];
  simulation: RouteSimulationState;
  onFocusTruck: () => void;
  onFocusStop: (eventId: string) => void;
  onRouteUpdated?: (updatedRoute: RouteData) => void;
  onModeChange?: (mode: 'LIVE' | 'PREVIEW') => void;
  onLiveTelemetry?: (telemetry: {
    lat: number;
    lng: number;
    heading: number;
    accuracyM: number;
    isLive: boolean;
  } | null) => void;
}

export const ActiveRoutePanel: React.FC<ActiveRoutePanelProps> = ({
  route,
  events,
  simulation,
  onFocusTruck,
  onFocusStop,
  onRouteUpdated,
  onModeChange,
  onLiveTelemetry,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelMode, setPanelMode] = useState<'LIVE' | 'PREVIEW'>('LIVE');

  const handleSetMode = (mode: 'LIVE' | 'PREVIEW') => {
    setPanelMode(mode);
    onModeChange?.(mode);
  };

  // Real GPS tracking state
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsHeading, setGpsHeading] = useState<number>(0);
  const [lastGpsTime, setLastGpsTime] = useState<Date | null>(null);
  const [isStaleSignal, setIsStaleSignal] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Stop arrival & completion modal states
  const [showManualArrivalModal, setShowManualArrivalModal] = useState(false);
  const [manualArrivalReason, setManualArrivalReason] = useState('');
  const [isSubmittingArrival, setIsSubmittingArrival] = useState(false);

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionPhotoFile, setCompletionPhotoFile] = useState<File | null>(null);
  const [completionPhotoPreview, setCompletionPhotoPreview] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // AI Review state
  const [aiReviewResult, setAiReviewResult] = useState<{
    assessment: 'APPEARS_CLEARED' | 'WASTE_REMAINS' | 'UNABLE_TO_ASSESS';
    confidence: number | null;
    shortReason: string;
    provider: string;
  } | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Stale GPS watchdog: check if signal older than 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastGpsTime) {
        const ageSec = (Date.now() - lastGpsTime.getTime()) / 1000;
        setIsStaleSignal(ageSec > 60);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [lastGpsTime]);

  // Clean up GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Sync route liveTracking if initialized from backend
  useEffect(() => {
    if (route?.liveTracking?.isLive && !isGpsActive) {
      setGpsCoords({ lat: route.liveTracking.lat, lng: route.liveTracking.lng });
      setGpsAccuracy(route.liveTracking.accuracyM || 10);
      setGpsHeading(route.liveTracking.heading || 0);
      if (route.liveTracking.timestamp) {
        setLastGpsTime(new Date(route.liveTracking.timestamp));
      }
    }
  }, [route]);

  if (!route) return null;

  // Real persisted stops calculations
  const totalStops = route.stops?.length || 0;
  const completedStops = route.stops?.filter((s) => s.state === 'DONE') || [];
  const completedCount = completedStops.length;
  const remainingCount = Math.max(0, totalStops - completedCount);

  // Find active operational stop (first non-DONE stop)
  const activeStop = route.stops?.find((s) => s.state !== 'DONE' && s.state !== 'SKIPPED');
  const activeEvent = activeStop ? events.find((e) => e.id === activeStop.eventId) : undefined;

  // Next upcoming stop after active
  const nextStop = route.stops?.find((s) => s.state === 'PENDING' && s.eventId !== activeStop?.eventId);
  const nextEvent = nextStop ? events.find((e) => e.id === nextStop.eventId) : undefined;

  // Calculate distance in meters to active stop from current GPS
  let distanceToActiveM: number | null = null;
  if (gpsCoords && activeEvent?.location) {
    const dLat = ((activeEvent.location.lat - gpsCoords.lat) * Math.PI) / 180;
    const dLng = ((activeEvent.location.lng - gpsCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((gpsCoords.lat * Math.PI) / 180) *
        Math.cos((activeEvent.location.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceToActiveM = Math.round(6371000 * c);
  }

  const isWithinProximity =
    distanceToActiveM !== null &&
    distanceToActiveM <= Math.max(50, (gpsAccuracy || 15) + 30);

  // Real capacity calculation
  const capacityKg = route.totals?.capacityKg || 1000;
  const realCurrentLoadKg = completedStops.reduce((sum, s) => sum + (s.weightKg || 0), 0);
  const realLoadPercentage = Math.min(100, Math.round((realCurrentLoadKg / capacityKg) * 100));

  // Toggle Live GPS watch
  const handleToggleGps = () => {
    if (isGpsActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsGpsActive(false);
      if (onLiveTelemetry) onLiveTelemetry(null);
    } else {
      if (!navigator.geolocation) {
        setGpsError('Geolocation is not supported by your browser.');
        return;
      }
      setGpsError(null);
      setIsGpsActive(true);

      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy);
          const heading = position.coords.heading || 0;
          const speed = position.coords.speed || 0;
          const now = new Date();

          setGpsCoords({ lat, lng });
          setGpsAccuracy(accuracy);
          setGpsHeading(heading);
          setLastGpsTime(now);
          setIsStaleSignal(false);
          setGpsError(null);

          if (onLiveTelemetry) {
            onLiveTelemetry({
              lat,
              lng,
              heading,
              accuracyM: accuracy,
              isLive: true,
            });
          }

          // Throttle backend telemetry post to once every 4 seconds or 10 meters
          const last = lastSentPosRef.current;
          const shouldSend =
            !last ||
            Date.now() - last.time > 4000 ||
            Math.abs(lat - last.lat) > 0.0001 ||
            Math.abs(lng - last.lng) > 0.0001;

          if (shouldSend) {
            lastSentPosRef.current = { lat, lng, time: Date.now() };
            try {
              await api.post(`/routes/${route.id}/telemetry`, {
                lat,
                lng,
                accuracyM: accuracy,
                heading,
                speedMs: speed,
                timestamp: now.toISOString(),
                deviceId: 'mobile-collector-browser',
              });
            } catch (err) {
              console.warn('[Telemetry] Update failed:', err);
            }
          }
        },
        (err) => {
          console.warn('[GPS Error]', err);
          if (err.code === err.PERMISSION_DENIED) {
            setGpsError('GPS permission denied. Enable location in browser settings.');
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setGpsError('GPS position unavailable. Check device GPS settings.');
          } else {
            setGpsError('GPS signal timed out. Retrying...');
          }
          setIsGpsActive(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );

      watchIdRef.current = id;
    }
  };

  // Record arrival (GPS Proximity or Manual with reason)
  const handleRecordArrival = async (isManual = false) => {
    if (!activeStop) return;
    setIsSubmittingArrival(true);
    setActionError(null);

    try {
      const payload: any = {
        arrivalType: isManual ? 'MANUAL_OVERRIDE' : 'GPS_PROXIMITY',
        arrivalReason: isManual ? manualArrivalReason.trim() : 'GPS proximity confirmed within radius.',
        lat: gpsCoords?.lat,
        lng: gpsCoords?.lng,
        accuracyM: gpsAccuracy,
      };

      const res = await api.post<any>(
        `/routes/${route.id}/stops/${activeStop.eventId}/arrive`,
        payload
      );

      setShowManualArrivalModal(false);
      setManualArrivalReason('');
      if (onRouteUpdated && res.route) {
        onRouteUpdated(res.route);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to record stop arrival.');
    } finally {
      setIsSubmittingArrival(false);
    }
  };

  // Handle Photo selection for completion
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCompletionPhotoFile(file);
      setCompletionPhotoPreview(URL.createObjectURL(file));
      setAiReviewResult(null); // Reset prior AI check
    }
  };

  // Trigger AI before/after clearance comparison
  const handleRunAiCheck = async () => {
    if (!completionPhotoFile || !activeStop) return;
    setIsCheckingAi(true);
    setActionError(null);

    try {
      const formData = new FormData();
      formData.append('image', completionPhotoFile);

      const res = await api.post<any>(
        `/routes/${route.id}/stops/${activeStop.eventId}/ai-review`,
        formData
      );

      setAiReviewResult(res);
    } catch (err: any) {
      setActionError(err.message || 'AI review check failed. Proceeding with manual review.');
    } finally {
      setIsCheckingAi(false);
    }
  };

  // Confirm Stop Collection & Resolve Incident
  const handleConfirmCollection = async () => {
    if (!activeStop || !completionPhotoFile) {
      setActionError('After-collection photo proof is required.');
      return;
    }

    const isSpecialist =
      activeEvent?.reportType === 'HOUSEHOLD' ||
      activeEvent?.category === 'E_WASTE' ||
      activeEvent?.specialistFlag ||
      (activeEvent?.specialistQueue && activeEvent.specialistQueue !== 'NONE');

    if (isSpecialist) {
      if (!facilityName.trim() || !receiptRef.trim() || !sourceUrl.trim()) {
        setActionError('Specialist recycler facility name, receipt ref, and directory URL are required.');
        return;
      }
    }

    setIsSubmittingCompletion(true);
    setActionError(null);

    try {
      // 1. Upload photo to get verified uploadToken
      const uploadForm = new FormData();
      uploadForm.append('image', completionPhotoFile);
      const uploadRes = await api.post<any>('/uploads', uploadForm);

      // 2. Submit stop confirmation
      const payload: any = {
        closurePhoto: { uploadToken: uploadRes.uploadToken },
        note: operatorNote.trim(),
        receivingFacilityName: isSpecialist ? facilityName.trim() : undefined,
        receiptReference: isSpecialist ? receiptRef.trim() : undefined,
        sourceUrl: isSpecialist ? sourceUrl.trim() : undefined,
        aiReview: aiReviewResult || undefined,
      };

      const res = await api.post<any>(
        `/routes/${route.id}/stops/${activeStop.eventId}/confirm-collection`,
        payload
      );

      // Close modal and reset form
      setShowCompletionModal(false);
      setCompletionPhotoFile(null);
      setCompletionPhotoPreview(null);
      setOperatorNote('');
      setFacilityName('');
      setReceiptRef('');
      setSourceUrl('');
      setAiReviewResult(null);

      if (onRouteUpdated && res.route) {
        onRouteUpdated(res.route);
      }
    } catch (err: any) {
      setActionError(err.message || 'Collection confirmation failed.');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  return (
    <aside
      className={`absolute bottom-4 right-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] bg-surface/95 backdrop-blur-md border border-line rounded-card shadow-panel transition-all duration-300 font-sans ${
        isMinimized ? 'h-14 overflow-hidden' : ''
      }`}
    >
      {/* Top Banner / Mode Bar */}
      <div className="p-3 bg-surface-2/70 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shadow-sm text-surface ${
              panelMode === 'LIVE' ? 'bg-moss' : 'bg-lagoon'
            }`}
          >
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-ink truncate max-w-[130px]">
                {route.vehicle?.name || 'Municipal Vehicle'}
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  panelMode === 'LIVE'
                    ? 'bg-moss-100 text-moss-700 border border-moss/30'
                    : 'bg-lagoon-100 text-lagoon border border-lagoon/30'
                }`}
              >
                {panelMode === 'LIVE' ? 'Live Ops' : 'Route Preview'}
              </span>
            </div>
            <span className="text-[10px] text-ink-3 block">
              {panelMode === 'LIVE'
                ? isGpsActive
                  ? isStaleSignal
                    ? '⚠️ Stale GPS signal (>60s)'
                    : `Active GPS (±${gpsAccuracy || 10}m)`
                  : 'GPS device session idle'
                : simulation.isPlaying
                ? 'Simulating road transit'
                : 'Preview paused'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-surface rounded border border-line p-0.5 text-[10px] font-semibold">
            <button
              onClick={() => handleSetMode('LIVE')}
              className={`px-2 py-0.5 rounded transition ${
                panelMode === 'LIVE' ? 'bg-moss text-surface shadow-xs' : 'text-ink-3 hover:text-ink'
              }`}
            >
              Live
            </button>
            <button
              onClick={() => handleSetMode('PREVIEW')}
              className={`px-2 py-0.5 rounded transition ${
                panelMode === 'PREVIEW' ? 'bg-lagoon text-surface shadow-xs' : 'text-ink-3 hover:text-ink'
              }`}
            >
              Preview
            </button>
          </div>

          <button
            onClick={onFocusTruck}
            title="Center Map on Vehicle"
            className="p-1.5 rounded hover:bg-surface border border-line text-ink-2 hover:text-ink"
          >
            <Navigation className="w-3.5 h-3.5 text-moss" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded hover:bg-surface border border-line text-ink-3 hover:text-ink"
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3 text-xs max-h-[78vh] overflow-y-auto">
          {/* ============================================================== */}
          {/* TAB 1: LIVE OPERATIONS (REAL PERSISTED STOP WORKFLOW & GPS)   */}
          {/* ============================================================== */}
          {panelMode === 'LIVE' && (
            <>
              {/* GPS Device Telemetry Controller Card */}
              <div className="p-2.5 bg-surface-2 rounded-card border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio
                      className={`w-3.5 h-3.5 ${
                        isGpsActive ? (isStaleSignal ? 'text-ochre animate-pulse' : 'text-moss animate-pulse') : 'text-ink-3'
                      }`}
                    />
                    <span className="font-bold text-[11px] text-ink">Authorized Collection Device</span>
                  </div>
                  <button
                    onClick={handleToggleGps}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold shadow-xs transition flex items-center gap-1 ${
                      isGpsActive
                        ? 'bg-clay-100 text-clay border border-clay/30 hover:bg-clay-200'
                        : 'bg-moss text-surface hover:bg-moss-700'
                    }`}
                  >
                    <span>{isGpsActive ? 'Stop GPS' : 'Start GPS'}</span>
                  </button>
                </div>

                {gpsError && (
                  <div className="p-1.5 bg-clay-100 text-clay rounded border border-clay/30 text-[10px]">
                    {gpsError}
                  </div>
                )}

                {isGpsActive && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-2 bg-surface p-2 rounded border border-line/60">
                    <div>
                      <span className="text-ink-3 block">Accuracy:</span>
                      <b className={gpsAccuracy && gpsAccuracy <= 20 ? 'text-moss-700' : 'text-ochre'}>
                        ± {gpsAccuracy || 10} meters
                      </b>
                    </div>
                    <div>
                      <span className="text-ink-3 block">Last Telemetry:</span>
                      <b className={isStaleSignal ? 'text-ochre' : 'text-ink'}>
                        {lastGpsTime ? `${Math.round((Date.now() - lastGpsTime.getTime()) / 1000)}s ago` : 'Waiting...'}
                      </b>
                    </div>
                  </div>
                )}
              </div>

              {/* Real Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink">
                    Collection: {completedCount} / {totalStops} stops completed
                  </span>
                  <span className="font-mono text-[11px] text-ink-3 font-semibold">
                    {totalStops > 0 ? Math.round((completedCount / totalStops) * 100) : 0}% done
                  </span>
                </div>
                <div className="h-2 bg-line rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${totalStops > 0 ? (completedCount / totalStops) * 100 : 0}%`,
                    }}
                    className="h-full bg-moss rounded-full transition-all duration-300"
                  />
                </div>
              </div>

              {/* Active Stop Card & Workflow Controls */}
              {activeStop && activeEvent ? (
                <div className="p-3 bg-surface-2 rounded-card border border-moss/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-moss text-surface text-[10px] font-bold">
                          Stop #{activeStop.seq}
                        </span>
                        <span className="font-bold text-ink text-xs">{activeEvent.code}</span>
                        <span className="text-[10px] text-ink-3">({activeStop.weightKg} kg)</span>
                      </div>
                      <p className="text-[11px] text-ink-2 mt-1 font-medium leading-tight">
                        {activeEvent.addressText || 'Municipal Sector Road'}
                      </p>
                    </div>

                    <button
                      onClick={() => onFocusStop(activeStop.eventId)}
                      className="text-[11px] text-moss font-bold hover:underline shrink-0"
                    >
                      Focus
                    </button>
                  </div>

                  {/* Stop State Status Pill */}
                  <div className="p-2 rounded bg-surface border border-line flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-ink-3">Stop Status:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        activeStop.state === 'ARRIVED'
                          ? 'bg-ochre-100 text-ochre border border-ochre/30'
                          : activeStop.state === 'EN_ROUTE'
                          ? 'bg-lagoon-100 text-lagoon border border-lagoon/30'
                          : 'bg-surface-2 text-ink-2 border border-line'
                      }`}
                    >
                      {activeStop.state === 'ARRIVED'
                        ? 'ARRIVED · ON SITE'
                        : activeStop.state === 'EN_ROUTE'
                        ? 'EN ROUTE'
                        : 'ASSIGNED / NEXT'}
                    </span>
                  </div>

                  {/* Proximity Feedback */}
                  {distanceToActiveM !== null && (
                    <div
                      className={`p-2 rounded border text-[11px] flex items-center justify-between ${
                        isWithinProximity
                          ? 'bg-moss-100/60 border-moss/40 text-moss-700'
                          : 'bg-surface border-line text-ink-3'
                      }`}
                    >
                      <span>Distance to site:</span>
                      <b className="font-mono">
                        {distanceToActiveM} m {isWithinProximity ? '· Within GPS Proximity' : ''}
                      </b>
                    </div>
                  )}

                  {/* WORKFLOW ACTION BUTTONS */}
                  <div className="pt-1 space-y-2">
                    {/* Stage 1: Arrival Confirmation */}
                    {activeStop.state !== 'ARRIVED' && activeStop.state !== 'DONE' && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleRecordArrival(false)}
                          disabled={isSubmittingArrival}
                          className="w-full py-2 px-3 bg-moss hover:bg-moss-700 text-surface text-xs font-bold rounded shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>
                            {isWithinProximity
                              ? 'Confirm Arrival (GPS Proximity)'
                              : 'Record Stop Arrival'}
                          </span>
                        </button>

                        <button
                          onClick={() => setShowManualArrivalModal(true)}
                          className="w-full py-1 text-[10px] text-ink-3 hover:text-ink underline text-center"
                        >
                          GPS unavailable? Record manual arrival with reason
                        </button>
                      </div>
                    )}

                    {/* Stage 2: Stop Arrived -> Collection Evidence Submission */}
                    {activeStop.state === 'ARRIVED' && (
                      <div className="space-y-1.5">
                        <div className="p-2 bg-ochre-100/50 rounded border border-ochre/30 text-[10px] text-ink-2 leading-relaxed">
                          <b>Arrived on site.</b> Physical collection requires photographic clearance verification before closure.
                        </div>

                        <button
                          onClick={() => setShowCompletionModal(true)}
                          className="w-full py-2 px-3 bg-moss hover:bg-moss-700 text-surface text-xs font-bold rounded shadow-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Submit Collection Evidence & Clear</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-moss-100/60 rounded-card border border-moss/30 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-moss mx-auto" />
                  <span className="font-bold text-moss-700 text-xs block">
                    All Route Stops Completed!
                  </span>
                  <p className="text-[11px] text-ink-2">
                    Vehicle completed collection quota and returned to municipal depot.
                  </p>
                </div>
              )}

              {/* Payload Capacity Gauge */}
              <div className="p-2.5 bg-surface-2 rounded-card border border-line space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-ink-2">Real Payload Collected</span>
                  <span className="font-mono font-bold text-ink">
                    {realCurrentLoadKg} / {capacityKg} kg ({realLoadPercentage}%)
                  </span>
                </div>
                <div className="h-2 bg-line rounded-full overflow-hidden">
                  <div
                    style={{ width: `${realLoadPercentage}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      realLoadPercentage > 90 ? 'bg-clay' : realLoadPercentage > 75 ? 'bg-ochre' : 'bg-moss'
                    }`}
                  />
                </div>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ROUTE PREVIEW (ROAD PLAYBACK - STRICTLY NON-OPERATIONAL) */}
          {/* ============================================================== */}
          {panelMode === 'PREVIEW' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-lagoon-100/60 border border-lagoon/30 rounded text-[10px] text-ink-2 leading-relaxed">
                <b className="text-lagoon font-bold block mb-0.5">Route Preview (Road Geometry Playback)</b>
                Preview mode simulates travel along OSRM road coordinates for planning inspection.
                Playback does <b>NOT</b> alter operational records, send citizen notifications, or award impact credits.
              </div>

              {/* Simulation Controls */}
              <div className="p-3 bg-surface-2 rounded-card border border-line space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink">Preview Progress:</span>
                  <span className="font-mono text-ink-3">
                    {Math.round(((simulation.currentDistanceM / simulation.totalDistanceM) || 0) * 100)}%
                  </span>
                </div>

                <div className="h-2 bg-line rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${Math.round(((simulation.currentDistanceM / simulation.totalDistanceM) || 0) * 100)}%`,
                    }}
                    className="h-full bg-lagoon rounded-full transition-all duration-300"
                  />
                </div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    onClick={simulation.togglePlay}
                    className={`flex-1 py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition ${
                      simulation.isPlaying
                        ? 'bg-ink text-surface hover:bg-ink/90'
                        : 'bg-lagoon hover:bg-lagoon-700 text-surface'
                    }`}
                  >
                    {simulation.isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Preview</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{simulation.isCompleted ? 'Replay Preview' : 'Play Preview'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={simulation.stepNextStop}
                    title="Skip to next preview stop"
                    className="py-1.5 px-2.5 rounded bg-surface hover:bg-surface-2 border border-line text-ink-2 font-semibold text-xs flex items-center gap-1"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Next</span>
                  </button>

                  <button
                    onClick={simulation.reset}
                    title="Reset preview to depot"
                    className="p-1.5 rounded bg-surface hover:bg-surface-2 border border-line text-ink-3 hover:text-ink"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex rounded border border-line overflow-hidden text-[10px] font-mono">
                    {[1, 3, 6].map((s) => (
                      <button
                        key={s}
                        onClick={() => simulation.setSpeed(s)}
                        className={`px-1.5 py-1 ${
                          simulation.speed === s
                            ? 'bg-ink text-surface font-bold'
                            : 'bg-surface text-ink-3 hover:text-ink'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: MANUAL ARRIVAL CONFIRMATION OVERRIDE                 */}
      {/* ============================================================== */}
      {showManualArrivalModal && activeStop && activeEvent && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-card shadow-panel w-full max-w-sm p-4 space-y-3 font-sans">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-1.5 text-ochre font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Manual Arrival Confirmation</span>
              </div>
              <button
                onClick={() => setShowManualArrivalModal(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-ink-2 leading-relaxed">
              When GPS is unavailable (e.g. under an overpass, dense high-rise corridor, or hardware fault), you may record manual arrival. A specific reason is strictly required.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-ink-3 block">
                Recorded Arrival Reason *
              </label>
              <textarea
                value={manualArrivalReason}
                onChange={(e) => setManualArrivalReason(e.target.value)}
                placeholder="e.g. GPS signal blocked under concrete flyover, arrived at confirmed address."
                rows={2}
                className="w-full text-xs p-2 rounded border border-line bg-surface focus:outline-none focus:border-moss"
              />
            </div>

            {actionError && (
              <div className="p-2 bg-clay-100 text-clay text-[10px] rounded border border-clay/30">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setShowManualArrivalModal(false)}
                className="px-3 py-1.5 rounded border border-line text-xs font-semibold hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordArrival(true)}
                disabled={isSubmittingArrival || !manualArrivalReason.trim()}
                className="px-3 py-1.5 rounded bg-moss hover:bg-moss-700 text-surface text-xs font-bold disabled:opacity-50"
              >
                {isSubmittingArrival ? 'Recording...' : 'Authorize Arrival'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: COLLECTION COMPLETION & AI REVIEW                     */}
      {/* ============================================================== */}
      {showCompletionModal && activeStop && activeEvent && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-card shadow-panel w-full max-w-md p-5 space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <span className="font-bold text-sm text-ink block">Confirm Waste Collection</span>
                <span className="text-[11px] text-ink-3">Stop #{activeStop.seq}: {activeEvent.code} ({activeEvent.category})</span>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="text-ink-3 hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clearance Photo Upload (Mandatory) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink block">
                Clearance Photograph Evidence *
              </label>
              <p className="text-[10px] text-ink-3">
                Photo must clearly show the ground/site cleaned with the previous waste removed.
              </p>

              {completionPhotoPreview ? (
                <div className="relative rounded overflow-hidden border border-line group">
                  <img
                    src={completionPhotoPreview}
                    alt="Clearance proof"
                    className="w-full h-40 object-cover"
                  />
                  <button
                    onClick={() => {
                      setCompletionPhotoFile(null);
                      setCompletionPhotoPreview(null);
                      setAiReviewResult(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-ink/70 hover:bg-ink text-surface rounded-full shadow"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-line hover:border-moss/60 rounded cursor-pointer bg-surface-2/50 transition">
                  <UploadCloud className="w-7 h-7 text-ink-3 mb-1" />
                  <span className="text-xs font-semibold text-ink-2">Upload After-Collection Photo</span>
                  <span className="text-[10px] text-ink-3">JPEG, PNG, or WebP up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* AI Supporting Assessment Button & Result */}
            {completionPhotoFile && (
              <div className="p-3 bg-surface-2 rounded border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-moss" />
                    <span className="font-bold text-xs text-ink">AI Clearance Assessment</span>
                  </div>
                  {!aiReviewResult && (
                    <button
                      onClick={handleRunAiCheck}
                      disabled={isCheckingAi}
                      className="px-2.5 py-1 bg-surface hover:bg-surface-2 border border-line rounded text-[11px] font-semibold text-ink-2 flex items-center gap-1"
                    >
                      {isCheckingAi ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      <span>{isCheckingAi ? 'Analyzing...' : 'Run Vision Check'}</span>
                    </button>
                  )}
                </div>

                {aiReviewResult ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          aiReviewResult.assessment === 'APPEARS_CLEARED'
                            ? 'bg-moss-100 text-moss-700 border border-moss/30'
                            : aiReviewResult.assessment === 'WASTE_REMAINS'
                            ? 'bg-ochre-100 text-ochre border border-ochre/30'
                            : 'bg-surface text-ink-3 border border-line'
                        }`}
                      >
                        {aiReviewResult.assessment === 'APPEARS_CLEARED'
                          ? '✓ APPEARS CLEARED'
                          : aiReviewResult.assessment === 'WASTE_REMAINS'
                          ? '⚠️ WASTE MAY REMAIN'
                          : 'UNABLE TO ASSESS'}
                      </span>
                      {aiReviewResult.confidence && (
                        <span className="text-[10px] text-ink-3 font-mono">
                          Confidence: {Math.round(aiReviewResult.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-2 italic">
                      "{aiReviewResult.shortReason}"
                    </p>
                    <span className="text-[9px] text-ink-3 block">
                      AI assessment is supporting evidence only. Authorized operator confirmation required to close.
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-ink-3">
                    Click to compare the before-photo with your cleanup evidence using Google Gemini vision.
                  </p>
                )}
              </div>
            )}

            {/* Specialist Recycling Fields (if applicable) */}
            {(activeEvent.reportType === 'HOUSEHOLD' ||
              activeEvent.category === 'E_WASTE' ||
              activeEvent.specialistFlag ||
              (activeEvent.specialistQueue && activeEvent.specialistQueue !== 'NONE')) && (
              <div className="p-3 bg-plum-100/30 rounded border border-plum/30 space-y-2">
                <span className="font-bold text-xs text-plum block">
                  Specialist Waste Recycler Handoff Proof *
                </span>
                <input
                  type="text"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="Receiving Facility / Recycler Service Name *"
                  className="w-full text-xs p-2 rounded border border-line bg-surface"
                />
                <input
                  type="text"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="Receipt / Transfer Reference Number *"
                  className="w-full text-xs p-2 rounded border border-line bg-surface"
                />
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="Official Recycler Directory URL (MPCB/CPCB) *"
                  className="w-full text-xs p-2 rounded border border-line bg-surface"
                />
              </div>
            )}

            {/* Operator Notes */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-ink-3 block">
                Operator / Crew Verification Note
              </label>
              <textarea
                value={operatorNote}
                onChange={(e) => setOperatorNote(e.target.value)}
                placeholder="e.g. Cleared 120 kg mixed waste from roadside corner. Site swept and sanitized."
                rows={2}
                className="w-full text-xs p-2 rounded border border-line bg-surface focus:outline-none focus:border-moss"
              />
            </div>

            {actionError && (
              <div className="p-2 bg-clay-100 text-clay text-xs rounded border border-clay/30">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-3 py-1.5 rounded border border-line text-xs font-semibold hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCollection}
                disabled={isSubmittingCompletion || !completionPhotoFile}
                className="px-4 py-2 rounded bg-moss hover:bg-moss-700 text-surface text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingCompletion ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying & Closing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize & Close Stop</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
