import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import { WasteCategory } from '../../types/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { PriorityChip } from '../../components/shared/PriorityChip.tsx';
import { EvidenceImage } from '../../components/shared/EvidenceImage.tsx';
import {
  X,
  MapPin,
  CheckCircle,
  Truck,
  AlertTriangle,
  Sparkles,
  Camera,
  Check,
  ExternalLink,
  ShieldCheck,
  Home,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface EventDrawerProps {
  eventId: string;
  onClose: () => void;
  onEventUpdated: () => void;
}

export const EventDrawer: React.FC<EventDrawerProps> = ({ eventId, onClose, onEventUpdated }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification Form State
  const [severity, setSeverity] = useState<number>(2);
  const [estimatedWeightKg, setEstimatedWeightKg] = useState<number>(100);
  const [sensitiveSite, setSensitiveSite] = useState<string>('NONE');
  const [category, setCategory] = useState<WasteCategory>('PLASTIC');

  // Resolution Form State
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [closureNote, setClosureNote] = useState('');
  const [closurePhotoFile, setClosurePhotoFile] = useState<File | null>(null);
  const [closurePhotoPreview, setClosurePhotoPreview] = useState<string | null>(null);
  const [closureUploadToken, setClosureUploadToken] = useState<string | null>(null);
  const [closureUploading, setClosureUploading] = useState<boolean>(false);

  // Specialist handoff fields
  const [receivingFacilityName, setReceivingFacilityName] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const closureFileInputRef = useRef<HTMLInputElement>(null);

  // Clean up closure temporary object URL
  useEffect(() => {
    return () => {
      if (closurePhotoPreview && closurePhotoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(closurePhotoPreview);
      }
    };
  }, [closurePhotoPreview]);

  async function fetchEventDetails() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>(`/complaints/${eventId}`);
      setData(res);
      if (res.event) {
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

  useEffect(() => {
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
      });
      onEventUpdated();
      await fetchEventDetails();
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

  const handleClosurePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClosurePhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setClosurePhotoPreview(objectUrl);
    setClosureUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post<{ imageUrl: string; imagePublicId: string; uploadToken: string }>(
        '/uploads',
        formData
      );
      setClosureUploadToken(res.uploadToken);
    } catch (err: any) {
      setError(err.message || 'Failed to upload closure photograph.');
      setClosureUploadToken(null);
    } finally {
      setClosureUploading(false);
    }
  };

  const handleResolve = async () => {
    if (!closureUploadToken) {
      setError('A verified clearance photograph must be uploaded before closing an incident.');
      return;
    }

    const isSpecialistOrHousehold =
      data.event.reportType === 'HOUSEHOLD' ||
      data.event.category === 'E_WASTE' ||
      data.event.specialistFlag ||
      data.event.specialistQueue !== 'NONE';

    if (isSpecialistOrHousehold) {
      if (!receivingFacilityName.trim()) {
        setError('Receiving facility or recycler name is required for specialist handoff.');
        return;
      }
      if (!receiptReference.trim()) {
        setError('Receipt or acceptance reference number is required.');
        return;
      }
      if (!sourceUrl.trim() || !sourceUrl.startsWith('http')) {
        setError('Valid official directory source URL (e.g. MPCB/CPCB portal link) is required.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/complaints/${eventId}/status`, {
        to: 'RESOLVED',
        note: closureNote.trim() || (isSpecialistOrHousehold ? 'Specialist handoff recorded.' : 'Cleared by sanitation squad.'),
        closurePhoto: { uploadToken: closureUploadToken },
        receivingFacilityName: receivingFacilityName.trim() || undefined,
        receiptReference: receiptReference.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
      });
      onEventUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Resolution failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSupport = async (reportId: string, accept: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/complaints/${eventId}/support/${reportId}/review`, {
        accept,
        reason: accept ? undefined : 'Duplicate or unconfirmed angle',
      });
      await fetchEventDetails();
      onEventUpdated();
    } catch (err: any) {
      setError(err.message || 'Could not update supporting evidence.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface shadow-panel border-l border-line p-6 flex items-center justify-center">
        <span className="text-xs text-ink-3">Loading event dossier...</span>
      </div>
    );
  }

  if (!data || !data.event) {
    return null;
  }

  const { event, photos, linkedReports, priority, timeline, closure } = data;
  const isSubmitted = event.status === 'SUBMITTED';
  const isVerified = event.status === 'VERIFIED';
  const isScheduled = event.status === 'SCHEDULED';
  const isResolved = event.status === 'RESOLVED';
  const isReopened = event.status === 'REOPENED';
  const isHousehold = event.reportType === 'HOUSEHOLD';
  const isSpecialistOrHousehold =
    isHousehold || event.category === 'E_WASTE' || event.specialistFlag || event.specialistQueue !== 'NONE';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface shadow-panel border-l border-line flex flex-col survey-corner">
      {/* Drawer Header */}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-clay-100 border border-clay/30 rounded text-clay flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Reopened Alert */}
        {isReopened && (
          <div className="p-3 bg-clay-100/70 border border-clay/30 rounded text-clay space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Citizen Disputed Closure: Reopened</span>
            </div>
            <p className="text-[11px] text-ink-2">
              Reason: <i>"{event.reopenReason}"</i>. Resolution credits revoked.
            </p>
          </div>
        )}

        {/* Household / Specialist Queue Banner */}
        {isHousehold && (
          <div className="p-3 bg-lagoon-100/40 border border-lagoon/30 rounded text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-lagoon">
              <Home className="w-4 h-4 shrink-0" />
              <span>Private Household Disposal Request</span>
            </div>
            <p className="text-ink-2">
              <b>Inventory:</b> {event.householdQuantity || 1}x {event.householdItems || 'Items'}
            </p>
            <p className="text-[11px] text-ink-3">
              Protected from public map endpoints. Operator coordinates authorized specialist receiving handoff.
            </p>
          </div>
        )}

        {event.category === 'E_WASTE' && (
          <div className="p-3 bg-plum-100/40 border border-plum/30 rounded text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-plum">
              <Zap className="w-4 h-4 shrink-0" />
              <span>E-Waste Specialist Stream</span>
            </div>
            <p className="text-ink-2">
              Under MPCB / CPCB E-Waste Management Rules, electronic waste is excluded from ordinary compactor trucks and routed to authorized recyclers.
            </p>
          </div>
        )}

        {/* 1. Evidence Photographs */}
        {photos && photos.length > 0 && (
          <div className="space-y-2">
            <EvidenceImage
              src={photos[0].url}
              alt="Primary reported evidence"
              roleBadge="PRIMARY"
              className="w-full aspect-[16/10] rounded"
              allowLightbox={true}
            />
            {photos.length > 1 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-ink-3 block">
                  Supporting Neighbor Photographs ({photos.length - 1})
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.slice(1).map((ph: any, idx: number) => (
                    <EvidenceImage
                      key={idx}
                      src={ph.url}
                      alt={ph.caption || 'Supporting incident evidence'}
                      roleBadge="SUPPORTING"
                      className="w-16 h-16 rounded shrink-0"
                      allowLightbox={true}
                    />
                  ))}
                </div>
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
          {isHousehold && (
            <span className="text-[10px] text-moss font-semibold uppercase tracking-wider block mt-0.5">
              ✓ Address shielded from public map layers
            </span>
          )}
        </div>

        {/* 3. Classification & Citizen Correction Flag */}
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

        {/* 4. Verification Form (Shown if SUBMITTED or REOPENED) */}
        {(isSubmitted || isReopened) && (
          <div className="p-3.5 bg-ochre-100/30 rounded border border-ochre/30 space-y-3">
            <span className="text-[11px] uppercase font-bold tracking-wider text-ochre block">
              Municipal Verification Input
            </span>

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
                Estimated Weight (kg) *
              </label>
              <input
                type="number"
                value={estimatedWeightKg}
                onChange={(e) => setEstimatedWeightKg(Number(e.target.value))}
                min={5}
                max={2000}
                className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink font-mono font-medium"
              />
              <span className="text-[10px] text-ink-3">Operator estimate for vehicle capacity allocation</span>
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

        {/* 5. Priority Reasoning Breakdown Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
              Priority Reasoning ({priority.score} pts · {priority.tier})
            </span>
          </div>

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

        {/* 6. Linked Citizen Evidence & Operator Accept/Reject */}
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-3 block mb-1.5">
            Linked Citizen Evidence ({linkedReports.length})
          </span>
          <div className="space-y-2">
            {linkedReports.map((rep: any) => (
              <div
                key={rep.id}
                className="p-2.5 bg-surface rounded border border-line space-y-1.5 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-ink">{rep.citizenDisplayName}</span>
                    <span className="text-ink-3 ml-1.5">
                      ({rep.role === 'PRIMARY' ? 'Primary' : 'Supporting'})
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                      rep.creditState === 'VERIFIED'
                        ? 'bg-moss-100 text-moss-700'
                        : rep.creditState === 'REJECTED'
                        ? 'bg-clay-100 text-clay'
                        : 'bg-surface-2 text-ink-3'
                    }`}
                  >
                    +{rep.credits} {rep.creditState}
                  </span>
                </div>

                {/* Operator Accept/Reject actions for Supporting Reports */}
                {rep.role === 'SUPPORTING' && rep.creditState === 'PENDING' && (
                  <div className="pt-1.5 border-t border-line flex items-center justify-between">
                    <span className="text-[10px] text-ink-3">Operator Support Review:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleReviewSupport(rep.id, true)}
                        className="px-2 py-0.5 bg-moss hover:bg-moss-700 text-surface text-[10px] font-semibold rounded flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Accept (+1 support)</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleReviewSupport(rep.id, false)}
                        className="px-2 py-0.5 bg-surface hover:bg-clay-100 text-clay border border-line text-[10px] font-semibold rounded flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 7. Closure Evidence (if RESOLVED) */}
        {isResolved && closure && (
          <div className="p-3 bg-moss-100/50 rounded border border-moss/30 space-y-2">
            <span className="text-[10px] uppercase font-bold text-moss-700 block">
              Resolution & Verification Record
            </span>
            {closure.photoUrl && (
              <EvidenceImage
                src={closure.photoUrl}
                alt="Cleared site completion record"
                roleBadge="CLOSURE"
                className="w-full h-36 rounded border border-moss/30"
                allowLightbox={true}
              />
            )}
            {closure.receivingFacilityName && (
              <div className="p-2.5 bg-surface rounded border border-moss/30 text-[11px] space-y-1">
                <span className="font-bold text-ink block">Recorded Specialist Recycler Handoff:</span>
                <p><b>Receiving Facility:</b> {closure.receivingFacilityName}</p>
                {closure.receiptReference && (
                  <p><b>Receipt / Transfer Ref:</b> {closure.receiptReference}</p>
                )}
                {closure.sourceUrl && (
                  <a
                    href={closure.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lagoon underline flex items-center gap-1 font-medium mt-1"
                  >
                    <span>Operator Recorded Reference Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
            {closure.note && <p className="text-[11px] text-ink-2 font-medium">{closure.note}</p>}
            <p className="text-[10px] text-ink-3">
              Resolved on {new Date(closure.resolvedAt).toLocaleString('en-IN')}
            </p>
          </div>
        )}

        {/* Resolution / Completion Form */}
        {showResolveForm && (
          <div className="p-3.5 bg-surface-2 rounded-card border-2 border-moss space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">
                {isSpecialistOrHousehold ? 'Document Specialist Handoff' : 'Record Clearance & Resolve'}
              </span>
              <button
                type="button"
                onClick={() => setShowResolveForm(false)}
                className="text-ink-3 hover:text-ink text-[11px]"
              >
                Cancel
              </button>
            </div>

            {/* Clearance Photograph Upload */}
            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Clearance / Handover Photograph *
              </label>
              <input
                ref={closureFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleClosurePhotoSelect}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => closureFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-surface border border-line rounded text-xs text-ink font-semibold flex items-center gap-1.5 hover:bg-surface-2"
                >
                  <Camera className="w-3.5 h-3.5 text-moss" />
                  <span>{closurePhotoFile ? 'Replace Photo' : 'Upload Clearance Photo'}</span>
                </button>
                {closureUploading && <span className="text-[10px] text-ink-3">Uploading...</span>}
                {closureUploadToken && <span className="text-[10px] text-moss font-bold">✓ Uploaded</span>}
              </div>
              {closurePhotoPreview && (
                <EvidenceImage
                  src={closurePhotoPreview}
                  alt="Clearance photograph preview"
                  roleBadge="CLOSURE"
                  className="w-full h-28 rounded border border-line mt-2"
                  allowLightbox={false}
                />
              )}
            </div>

            {/* Specialist handoff fields */}
            {isSpecialistOrHousehold && (
              <div className="space-y-2 pt-2 border-t border-line">
                <span className="text-[10px] uppercase font-bold text-plum block">
                  Authorised Recycler / Receiving Facility Fields
                </span>

                <div>
                  <label className="block text-[11px] font-semibold text-ink mb-1">
                    Facility / Service Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EcoRecycle MPCB Authorised Facility #208"
                    value={receivingFacilityName}
                    onChange={(e) => setReceivingFacilityName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink mb-1">
                    Receipt / Acceptance Reference *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REC-EW-2026-9041"
                    value={receiptReference}
                    onChange={(e) => setReceiptReference(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink mb-1">
                    Official Directory Source URL *
                  </label>
                  <input
                    type="url"
                    placeholder="https://mpcb.gov.in/e-waste/authorised-dismantlers"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-ink mb-1">
                Operator Clearance Note *
              </label>
              <input
                type="text"
                placeholder="Clearance note or handoff description..."
                value={closureNote}
                onChange={(e) => setClosureNote(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-line bg-surface text-ink text-xs"
              />
            </div>

            <p className="text-[10px] text-ink-3">
              Note: This records a verified human-confirmed handoff on the municipal ledger. It does not claim automated recycler partnerships.
            </p>

            <button
              disabled={submitting || !closureUploadToken}
              onClick={handleResolve}
              className="w-full py-2.5 bg-moss hover:bg-moss-700 disabled:bg-line text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Record Resolution</span>
            </button>
          </div>
        )}
      </div>

      {/* Sticky Action Footer */}
      <div className="p-3.5 border-t border-line bg-surface flex gap-2">
        {(isSubmitted || isReopened) && !showResolveForm && (
          <>
            <button
              disabled={submitting}
              onClick={handleVerify}
              className="flex-1 py-2.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Verify Event</span>
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

        {(isVerified || isScheduled) && !isResolved && !showResolveForm && (
          <div className="flex w-full gap-2">
            {!isSpecialistOrHousehold && isVerified && (
              <button
                onClick={() => {
                  onClose();
                  navigate('/ops/routes');
                }}
                className="flex-1 py-2.5 bg-lagoon hover:bg-lagoon/90 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>Open Collection Planner</span>
              </button>
            )}

            <button
              onClick={() => setShowResolveForm(true)}
              className="flex-1 py-2.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSpecialistOrHousehold ? 'Specialist Handoff' : 'Mark Resolved'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
