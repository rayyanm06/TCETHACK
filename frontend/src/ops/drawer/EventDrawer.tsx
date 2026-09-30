import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { WasteEventSummary, PriorityTier, WasteCategory } from '../../types/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { PriorityChip } from '../../components/shared/PriorityChip.tsx';
import { CATEGORY_DETAILS } from '../../components/shared/CategoryChip.tsx';
import {
  X,
  MapPin,
  CheckCircle,
  Truck,
  AlertTriangle,
  Sparkles,
  Users,
  Camera,
  Check,
  Send,
} from 'lucide-react';

interface EventDrawerProps {
  eventId: string;
  onClose: () => void;
  onEventUpdated: () => void;
}

export const EventDrawer: React.FC<EventDrawerProps> = ({ eventId, onClose, onEventUpdated }) => {
  const navigate = useNavigate();
  const [proof, setProof] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [facility, setFacility] = useState('');
  const [reference, setReference] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [special, setSpecial] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification Form State
  const [severity, setSeverity] = useState<number>(2);
  const [estimatedWeightKg, setEstimatedWeightKg] = useState<number>(100);
  const [sensitiveSite, setSensitiveSite] = useState<string>('NONE');
  const [category, setCategory] = useState<WasteCategory>('PLASTIC');

  // Closure Form State
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [closureNote, setClosureNote] = useState('');

  useEffect(() => {
    async function fetchEventDetails() {
      setLoading(true);
      setProof(null);
      setClosureNote('');
      setFacility('');
      setReference('');
      setSourceUrl('');
      setError(null);
      try {
        const res = await api.get<any>(`/complaints/${eventId}`);
        setData(res);
        if (res.event) {
          setSpecial(!!res.event.requiresSpecialHandling);
          setSeverity(res.event.severity || 2);
          setEstimatedWeightKg(res.event.estimatedWeightKg || 100);
          setSensitiveSite(res.event.sensitiveSite || 'NONE');
          setCategory(res.event.category || 'PLASTIC');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch event.');
      } finally {
        setLoading(false);
      }
    }
    fetchEventDetails();
  }, [eventId]);

  const handleVerify = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/complaints/${eventId}`, {
        verify: true,
        category,
        severity,
        estimatedWeightKg,
        sensitiveSite,
        requiresSpecialHandling: special,
      });
      onEventUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Please enter the reason for rejecting this event:');
    if (!reason) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/complaints/${eventId}`, {
        reject: { reason },
      });
      onEventUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/complaints/${eventId}/status`, {
        to: 'RESOLVED',
        note: closureNote,
        closurePhoto: proof,
        ...(data.requiresHandoff
          ? { handoff: { facilityName: facility, reference, sourceUrl } }
          : {}),
      });
      onEventUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Resolution failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-surface shadow-panel border-l border-line p-6 flex items-center justify-center">
        <span className="text-xs text-ink-3">Loading event dossier...</span>
      </div>
    );
  }

  if (!data || !data.event) {
    return null;
  }

  const { event, photos, linkedReports, priority, timeline, closure } = data;
  const isSubmitted = event.status === 'SUBMITTED';
  const isScheduled = event.status === 'SCHEDULED';
  const isResolved = event.status === 'RESOLVED';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-surface shadow-panel border-l border-line flex flex-col survey-corner">
      {/* Drawer Header (§6.8) */}
      <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2/40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-ink">{event.code}</span>
          <StatusChip status={event.status} size="sm" />
          <PriorityChip tier={priority.tier} score={priority.score} size="sm" />
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-2 text-ink-3 hover:text-ink transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {error && (
          <div className="p-3 bg-clay-100 border border-clay/30 rounded text-clay flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Photo Gallery (§6.8) */}
        {photos && photos.length > 0 && (
          <div className="space-y-2">
            <div className="rounded overflow-hidden border border-line aspect-[16/10] bg-ink/5">
              <img src={photos[0].url} alt="Primary waste" className="w-full h-full object-cover" />
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.slice(1).map((ph: any, idx: number) => (
                  <img
                    key={idx}
                    src={ph.url}
                    alt={ph.caption}
                    title={ph.caption}
                    className="w-16 h-16 rounded object-cover border border-line shrink-0"
                  />
                ))}
              </div>
            )}
            <p className="text-[11px] text-ink-3">{photos[0].caption}</p>
          </div>
        )}

        {/* 2. Location */}
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3 block mb-1">
            Location
          </span>
          <div className="flex items-start gap-1.5 text-ink-2">
            <MapPin className="w-4 h-4 text-clay shrink-0 mt-0.5" />
            <span>{event.addressText}</span>
          </div>
        </div>

        {data.handling && (
          <div className="p-3 bg-plum-100 rounded border border-plum/20">
            <b>{data.handling.title}</b>
            <p className="mt-1">{data.handling.message}</p>
            {event.reportContext === 'HOUSEHOLD' && (
              <p className="mt-2 font-semibold">
                Private request · {event.itemCount} × {event.itemDescription}
              </p>
            )}
          </div>
        )}
        {/* 3. Classification & Citizen Correction Flag (§6.8) */}
        <div className="p-3 bg-surface-2 rounded border border-line space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
              Classification
            </span>
            <span className="font-semibold text-ink">{event.category}</span>
          </div>
          {event.aiSuggestedCategory && event.aiSuggestedCategory !== event.category && (
            <p className="text-[11px] text-moss font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>
                AI suggested {event.aiSuggestedCategory} · Citizen changed to {event.category}
              </span>
            </p>
          )}
        </div>

        {/* 4. Verification Form (Shown if SUBMITTED) (§6.8) */}
        {isSubmitted && (
          <div className="p-3.5 bg-ochre-100/30 rounded border border-ochre/30 space-y-3">
            <span className="text-[11px] uppercase font-bold tracking-wider text-ochre block">
              Operator Verification
            </span>

            <label className="block">
              Confirmed category
              <select
                className="w-full p-2 border border-line mt-1"
                value={category}
                onChange={(e) => setCategory(e.target.value as WasteCategory)}
              >
                {Object.entries(CATEGORY_DETAILS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={special}
                onChange={(e) => setSpecial(e.target.checked)}
              />
              Requires specialist handling
            </label>
            {/* Severity S1 - S3 */}
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Severity Level
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { val: 1, label: 'S1 Small (+10)' },
                  { val: 2, label: 'S2 Medium (+25)' },
                  { val: 3, label: 'S3 Large (+40)' },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => setSeverity(s.val)}
                    className={`py-1.5 px-2 rounded text-[11px] font-semibold border ${
                      severity === s.val
                        ? 'bg-ink text-surface border-ink'
                        : 'bg-surface text-ink-2 border-line hover:border-ink/30'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Weight (kg) */}
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Estimated Weight (kg)
              </label>
              <input
                type="number"
                value={estimatedWeightKg}
                onChange={(e) => setEstimatedWeightKg(Number(e.target.value))}
                min={0.1}
                step={0.1}
                max={2000}
                className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink font-mono font-medium"
              />
              <span className="text-[10px] text-ink-3">
                Operator estimate for vehicle capacity allocation
              </span>
            </div>

            {/* Sensitive Site */}
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Sensitive Site (+15 pts)
              </label>
              <select
                value={sensitiveSite}
                onChange={(e) => setSensitiveSite(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink"
              >
                <option value="NONE">None</option>
                <option value="SCHOOL">School Area</option>
                <option value="HOSPITAL">Hospital Corridor</option>
                <option value="MARKET">Public Market</option>
                <option value="DRAIN">Storm Drain Inflow</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. Priority Reasoning Breakdown Bar (§6.8 & §13) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
              Priority Reasoning ({priority.score} pts · {priority.tier})
            </span>
          </div>

          {/* Stacked Breakdown Bar */}
          <div className="h-3.5 bg-surface-2 rounded-full overflow-hidden flex border border-line">
            {priority.breakdown.map((item: any) => {
              const bg =
                item.key === 'severity'
                  ? 'bg-clay'
                  : item.key === 'waiting_time'
                    ? 'bg-ochre'
                    : item.key === 'community'
                      ? 'bg-lagoon'
                      : 'bg-plum';
              const widthPct = `${Math.max(4, item.points)}%`;
              return (
                <div
                  key={item.key}
                  style={{ width: widthPct }}
                  title={`${item.label}: +${item.points} (${item.detail})`}
                  className={`${bg} h-full transition-all`}
                />
              );
            })}
          </div>

          <div className="p-2.5 bg-surface-2/60 rounded border border-line text-[11px] text-ink-2 italic">
            "{priority.sentence}"
          </div>
        </div>

        {/* 6. Linked Citizen Reports (§6.8) */}
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3 block mb-1.5">
            Linked Citizen Evidence ({linkedReports.length})
          </span>
          <div className="space-y-1.5">
            {linkedReports.map((rep: any) => (
              <div
                key={rep.id}
                className="p-2 bg-surface rounded border border-line flex items-center justify-between text-[11px]"
              >
                <div>
                  <span className="font-semibold text-ink">{rep.citizenDisplayName}</span>
                  <span className="text-ink-3 ml-1.5">
                    ({rep.role === 'PRIMARY' ? 'Primary' : 'Supporting'})
                  </span>
                </div>
                {rep.role === 'SUPPORTING' &&
                  rep.evidenceReview === 'PENDING' &&
                  ['VERIFIED', 'SCHEDULED'].includes(event.status) && (
                    <div className="flex gap-2">
                      {[true, false].map((accepted) => (
                        <button
                          key={String(accepted)}
                          disabled={submitting}
                          className="underline text-moss"
                          onClick={async () => {
                            setSubmitting(true);
                            try {
                              await api.patch(`/complaints/${eventId}/evidence`, {
                                reportId: rep.id,
                                accepted,
                              });
                              setData(await api.get(`/complaints/${eventId}`));
                              onEventUpdated();
                            } catch (e: any) {
                              setError(e.message);
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          {accepted ? 'Accept' : 'Reject'}
                        </button>
                      ))}
                    </div>
                  )}
                <span
                  className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                    rep.creditState === 'VERIFIED'
                      ? 'bg-moss-100 text-moss-700'
                      : 'bg-surface-2 text-ink-3'
                  }`}
                >
                  +{rep.credits} {rep.creditState}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Closure Evidence (if RESOLVED) */}
        {isResolved && closure && (
          <div className="p-3 bg-moss-100/50 rounded border border-moss/30 space-y-2">
            <span className="text-[10px] uppercase font-bold text-moss-700 block">
              Resolution Record
            </span>
            {closure.photoUrl && (
              <img
                src={closure.photoUrl}
                alt="Cleared"
                className="w-full h-32 rounded object-cover border border-moss/20"
              />
            )}
            {event.handoff?.facilityName && (
              <p>
                Received by {event.handoff.facilityName} · Reference {event.handoff.reference}
              </p>
            )}
            {closure.note && <p className="text-[11px] text-ink-2 font-medium">{closure.note}</p>}
            <p className="text-[10px] text-ink-3">
              Resolved on {new Date(closure.resolvedAt).toLocaleString('en-IN')}
            </p>
          </div>
        )}

        {/* Closure Form (if SCHEDULED and operator clicks Mark Resolved) */}
        {(isScheduled || (event.status === 'VERIFIED' && data.requiresHandoff)) && (
          <div className="p-3 bg-surface-2 rounded border border-line space-y-2">
            <span className="text-[11px] font-bold text-ink block">Record completion evidence</span>
            <p>
              Upload the clearance photo or receiving-service receipt. Review the linked evidence
              before confirming.
            </p>
            <label className="block">
              Completion photograph (required)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading || submitting}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setProof(null);
                  setError(null);
                  try {
                    const form = new FormData();
                    form.append('image', file);
                    setProof(await api.post('/uploads', form));
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {uploading && <p>Uploading evidence…</p>}
            {proof && (
              <img
                src={proof.imageUrl}
                alt="Uploaded completion evidence"
                className="h-24 rounded"
              />
            )}
            {data.requiresHandoff && (
              <div className="space-y-2">
                <label className="block">
                  Receiving facility / service
                  <input
                    className="w-full p-2 border border-line"
                    value={facility}
                    maxLength={150}
                    onChange={(e) => setFacility(e.target.value)}
                  />
                </label>
                <label className="block">
                  Receipt or acceptance reference
                  <input
                    className="w-full p-2 border border-line"
                    value={reference}
                    maxLength={150}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label className="block">
                  Verified service source URL
                  <input
                    type="url"
                    placeholder="https://…"
                    className="w-full p-2 border border-line"
                    value={sourceUrl}
                    maxLength={500}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </label>
                <p className="text-ink-3">
                  Confirm current registration/eligibility and actual acceptance with the receiving
                  service. This is an operator-recorded handoff, not an automatic booking.
                </p>
              </div>
            )}
            <input
              type="text"
              placeholder="Operator clearance note..."
              value={closureNote}
              onChange={(e) => setClosureNote(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink text-xs"
            />
            <button
              disabled={
                submitting ||
                uploading ||
                !proof ||
                closureNote.trim().length < 10 ||
                (data.requiresHandoff &&
                  (!facility.trim() || !reference.trim() || !sourceUrl.startsWith('https://')))
              }
              onClick={handleResolve}
              className="w-full py-2 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Resolution</span>
            </button>
          </div>
        )}
      </div>

      {/* Sticky Action Footer (§6.8) */}
      <div className="p-3.5 border-t border-line bg-surface flex gap-2">
        {isSubmitted && (
          <>
            <button
              disabled={submitting}
              onClick={handleVerify}
              className="flex-1 py-2.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Verify Event & Evidence</span>
            </button>
            <button
              disabled={submitting}
              onClick={handleReject}
              className="py-2.5 px-3 bg-surface hover:bg-clay-100 border border-line text-clay font-semibold text-xs rounded"
            >
              Reject
            </button>
          </>
        )}

        {event.status === 'VERIFIED' && !data.requiresHandoff && (
          <button
            onClick={() => {
              onClose();
              navigate('/ops/routes');
            }}
            className="w-full py-2.5 bg-lagoon hover:bg-lagoon/90 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>Open Collection Planner</span>
          </button>
        )}
      </div>
    </div>
  );
};
