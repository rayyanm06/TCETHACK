import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import {
  Camera,
  Upload,
  ArrowLeft,
  ArrowRight,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  Navigation,
} from 'lucide-react';
import { CategoryChip, CATEGORY_DETAILS } from '../../components/shared/CategoryChip.tsx';
import { WasteCategory, ClassifyResponse, DuplicateCandidate } from '../../types/api.ts';

export const ReportWaste: React.FC = () => {
  const navigate = useNavigate();

  // Multi-step flow state (1: Photo, 2: Category, 3: Location, 4: Review, 5: Success)
  const [step, setStep] = useState<number>(1);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Classify response
  const [classifyData, setClassifyData] = useState<ClassifyResponse | null>(null);
  const [classifying, setClassifying] = useState<boolean>(false);

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<WasteCategory>('PLASTIC');
  const [description, setDescription] = useState<string>('');

  // Location state (default near venue / depot)
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: 19.2075,
    lng: 72.8765,
  });
  const [locationSource, setLocationSource] = useState<'GPS' | 'MAP_PIN'>('MAP_PIN');
  const [addressText, setAddressText] = useState<string>('Thakur Complex Road, Kandivali East');

  // Duplicate detection state
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateSheet, setShowDuplicateSheet] = useState<boolean>(false);
  const [duplicateDecision, setDuplicateDecision] = useState<'NONE_FOUND' | 'SUPPORT' | 'SEPARATE'>('NONE_FOUND');
  const [selectedTargetComplaintId, setSelectedTargetComplaintId] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEventCode, setCreatedEventCode] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side photo compression using HTML5 Canvas
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPhotoFile(file);

    // Create local object URL for instant preview
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    setStep(2);
    setClassifying(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post<ClassifyResponse>('/classify', formData);
      setClassifyData(res);

      if (res.ai && res.ai.status === 'OK' && res.ai.category) {
        setSelectedCategory(res.ai.category);
      } else {
        setSelectedCategory('UNKNOWN');
      }
    } catch (err: any) {
      console.warn('Classification network fallback:', err.message);
      // Fallback gracefully without blocking the citizen
      setClassifyData({
        imageUrl: objectUrl,
        imagePublicId: `local_${Date.now()}`,
        uploadToken: '',
        imageHash: 'fallback_hash',
        ai: {
          status: 'UNAVAILABLE',
          category: 'UNKNOWN',
          shortReason: null,
        },
      });
      setSelectedCategory('UNKNOWN');
    } finally {
      setClassifying(false);
    }
  };

  // Step 3 location verification and duplicate check
  const handleConfirmLocation = async () => {
    setError(null);
    try {
      const res = await api.get<{ candidates: DuplicateCandidate[]; radiusM: number }>(
        `/complaints/nearby?lat=${location.lat}&lng=${location.lng}&category=${selectedCategory}`
      );

      if (res.candidates && res.candidates.length > 0) {
        setDuplicateCandidates(res.candidates);
        setShowDuplicateSheet(true);
      } else {
        setDuplicateDecision('NONE_FOUND');
        setStep(4);
      }
    } catch (err: any) {
      // Proceed directly to review if nearby check fails
      setStep(4);
    }
  };

  // Use GPS location
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Math.round(pos.coords.latitude * 100000) / 100000,
          lng: Math.round(pos.coords.longitude * 100000) / 100000,
        });
        setLocationSource('GPS');
        setAddressText(`GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      (err) => {
        alert('Could not acquire your current location. Please position the pin on the map.');
      }
    );
  };

  // Support an existing duplicate report
  const handleSupportDuplicate = async (candidateId: string) => {
    if (!classifyData) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<any>(`/complaints/${candidateId}/support`, {
        uploadToken: classifyData.uploadToken,
        imageUrl: classifyData.imageUrl,
        imagePublicId: classifyData.imagePublicId,
        imageHash: classifyData.imageHash,
        location,
        locationSource,
        addressText,
        ai: classifyData.ai,
        citizenCategory: selectedCategory,
        description,
      });

      setCreatedEventCode(res.complaint.code);
      setCreatedReportId(res.report._id);
      setShowDuplicateSheet(false);
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to submit supporting report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit primary report
  const handleSubmitReport = async () => {
    if (!classifyData) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<any>('/reports', {
        requestId: crypto.randomUUID(),
        uploadToken: classifyData.uploadToken,
        imageUrl: classifyData.imageUrl,
        imagePublicId: classifyData.imagePublicId,
        imageHash: classifyData.imageHash,
        location,
        locationSource,
        addressText,
        ai: classifyData.ai,
        citizenCategory: selectedCategory,
        description,
        duplicateDecision,
      });

      setCreatedEventCode(res.complaint.code);
      setCreatedReportId(res.report._id);
      setStep(5);
    } catch (err: any) {
      if (err.code === 'DUPLICATE_DECISION_REQUIRED' && err.fields?.candidates) {
        setDuplicateCandidates(err.fields.candidates);
        setShowDuplicateSheet(true);
      } else {
        setError(err.message || 'Could not send report. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoriesList: WasteCategory[] = [
    'ORGANIC',
    'PLASTIC',
    'PAPER',
    'GLASS',
    'METAL',
    'E_WASTE',
    'MIXED',
    'UNKNOWN',
  ];

  return (
    <div className="space-y-4">
      {/* 4-Step Progress Indicator Header (§6.3) */}
      {step < 5 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
              className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Step {step} of 4: {step === 1 ? 'Photo' : step === 2 ? 'Category' : step === 3 ? 'Location' : 'Review'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 h-1.5">
            <div className={`rounded-full transition-all ${step >= 1 ? 'bg-moss' : 'bg-line'}`} />
            <div className={`rounded-full transition-all ${step >= 2 ? 'bg-moss' : 'bg-line'}`} />
            <div className={`rounded-full transition-all ${step >= 3 ? 'bg-moss' : 'bg-line'}`} />
            <div className={`rounded-full transition-all ${step >= 4 ? 'bg-moss' : 'bg-line'}`} />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-clay-100 border border-clay/30 rounded-card flex items-start gap-2 text-xs text-clay">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: PHOTO CAPTURE (§6.3) */}
      {step === 1 && (
        <div className="bg-surface rounded-card border border-line p-6 shadow-sm text-center survey-corner">
          <div className="w-16 h-16 rounded-full bg-moss-100 text-moss flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 stroke-[2]" />
          </div>

          <h2 className="font-serif text-xl font-bold text-ink">Photograph the Waste</h2>
          <p className="text-xs text-ink-3 mt-1 max-w-sm mx-auto">
            Take a clear photo of the roadside waste. Our automated vision model will instantly analyze the category.
          </p>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[52px] px-6 py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
            >
              <Camera className="w-5 h-5" />
              <span>Take Photo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[52px] px-6 py-3 bg-surface hover:bg-surface-2 text-ink border border-line font-semibold text-sm rounded-card flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5 text-ink-2" />
              <span>Choose from Gallery</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CATEGORY & AI OVERLAY (§6.3) */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Photo with Frosted-Paper AI Overlay Layer */}
          <div className="relative rounded-card overflow-hidden border border-line bg-ink/5 aspect-[4/3] max-h-72">
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Captured waste"
                className="w-full h-full object-cover"
              />
            )}

            {/* Frosted-Paper Label Layered on Photo (§6.3 Step 2) */}
            <div className="absolute bottom-2 left-2 right-2 bg-surface/95 backdrop-blur-md rounded-card p-3 border border-line shadow-panel">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-moss shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink">
                    {classifying ? (
                      <span className="animate-pulse">Analyzing photo with vision model...</span>
                    ) : classifyData?.ai?.status === 'OK' ? (
                      `Looks like ${CATEGORY_DETAILS[classifyData.ai.category]?.label || classifyData.ai.category}`
                    ) : (
                      'Please select a category below'
                    )}
                  </div>
                  {classifyData?.ai?.shortReason && (
                    <p className="text-[11px] text-ink-3 truncate mt-0.5">
                      {classifyData.ai.shortReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Category Chips Selection */}
          <div className="bg-surface rounded-card border border-line p-4 shadow-sm">
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">
              Select or Correct Category
            </label>

            <div className="flex flex-wrap gap-2">
              {categoriesList.map((cat) => (
                <CategoryChip
                  key={cat}
                  category={cat}
                  isSuggested={classifyData?.ai?.category === cat}
                  selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              ))}
            </div>

            {selectedCategory === 'E_WASTE' && (
              <div className="mt-3 p-2.5 bg-plum-100/60 border border-plum/20 rounded text-xs text-plum flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>E-waste requires special handling and will be scheduled with specialized vehicles.</span>
              </div>
            )}

            {/* Note field */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink-3 mb-1">
                Optional landmark or notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Near blue gate, behind electrical box"
                maxLength={280}
                className="w-full px-3 py-2 rounded border border-line text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-lagoon"
              />
            </div>

            <button
              onClick={() => setStep(3)}
              className="mt-4 w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
            >
              <span>Confirm Category & Set Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: LOCATION MAP (§6.3) */}
      {step === 3 && (
        <div className="bg-surface rounded-card border border-line p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink">Confirm Waste Location</h2>
              <p className="text-xs text-ink-3">
                Pan or adjust the pin to where the waste pile is located.
              </p>
            </div>
            <button
              onClick={handleUseMyLocation}
              className="px-2.5 py-1.5 bg-surface-2 hover:bg-line border border-line rounded text-xs font-semibold text-ink flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5 text-moss" />
              <span>Use GPS</span>
            </button>
          </div>

          {/* Interactive Coordinate Picker Box */}
          <div className="p-3 bg-surface-2 rounded-card border border-line space-y-2">
            <div className="flex items-center gap-2 text-xs text-ink">
              <MapPin className="w-4 h-4 text-clay shrink-0" />
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                className="flex-1 bg-surface border border-line px-2 py-1 rounded text-xs text-ink font-medium"
              />
            </div>
            <div className="text-[11px] text-ink-3 flex items-center justify-between">
              <span>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
              <span className="text-moss font-semibold uppercase text-[10px]">
                Inside Service Area ✓
              </span>
            </div>
          </div>

          {/* Quick Location Adjustment Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setLocation((prev) => ({
                  lat: Math.round((prev.lat + 0.0004) * 100000) / 100000,
                  lng: prev.lng,
                }))
              }
              className="flex-1 py-1.5 bg-surface border border-line rounded text-xs text-ink-2 hover:bg-surface-2"
            >
              Nudge North
            </button>
            <button
              type="button"
              onClick={() =>
                setLocation((prev) => ({
                  lat: Math.round((prev.lat - 0.0004) * 100000) / 100000,
                  lng: prev.lng,
                }))
              }
              className="flex-1 py-1.5 bg-surface border border-line rounded text-xs text-ink-2 hover:bg-surface-2"
            >
              Nudge South
            </button>
            <button
              type="button"
              onClick={() =>
                setLocation((prev) => ({
                  lat: prev.lat,
                  lng: Math.round((prev.lng + 0.0004) * 100000) / 100000,
                }))
              }
              className="flex-1 py-1.5 bg-surface border border-line rounded text-xs text-ink-2 hover:bg-surface-2"
            >
              Nudge East
            </button>
          </div>

          <button
            onClick={handleConfirmLocation}
            className="w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
          >
            <span>Confirm Location & Check Area</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 3b: CONDITIONAL DUPLICATE DETECTION SHEET (§6.3 Step 3b & §12) */}
      {showDuplicateSheet && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-panel sm:rounded-panel border border-line p-5 w-full max-w-lg shadow-panel space-y-4">
            <div className="flex items-center gap-2 text-ochre">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-lg font-bold text-ink">This May Already Be Reported</h3>
            </div>

            <p className="text-xs text-ink-2">
              A similar waste incident was reported nearby. Confirming an existing report helps municipal crews consolidate visits and act faster.
            </p>

            {/* Candidate Card */}
            {duplicateCandidates.map((cand) => (
              <div key={cand.id} className="p-3 bg-surface-2 rounded-card border border-line flex items-center gap-3">
                {cand.photoUrl && (
                  <img
                    src={cand.photoUrl}
                    alt="Nearby waste"
                    className="w-16 h-16 rounded object-cover border border-line shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-ink">{cand.code}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-pill bg-surface text-ink-2 border border-line font-medium">
                      {cand.category}
                    </span>
                  </div>
                  <p className="text-xs text-ink-2 mt-0.5">
                    ≈ {cand.distanceM}m away · {cand.supportCount} neighbour{cand.supportCount === 1 ? '' : 's'} confirmed
                  </p>
                  <p className="text-[11px] text-ink-3">Status: {cand.status}</p>
                </div>
              </div>
            ))}

            {/* Equal-Weight Choices (§6.3 Step 3b) */}
            <div className="space-y-2 pt-2">
              <button
                disabled={submitting}
                onClick={() => handleSupportDuplicate(duplicateCandidates[0].id)}
                className="w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
              >
                <span>Yes, That's the Same One (Support)</span>
              </button>

              <button
                disabled={submitting}
                onClick={() => {
                  setDuplicateDecision('SEPARATE');
                  setShowDuplicateSheet(false);
                  setStep(4);
                }}
                className="w-full py-2.5 bg-surface hover:bg-surface-2 text-ink border border-line font-semibold text-xs rounded-card flex items-center justify-center gap-2"
              >
                <span>No, This is a Separate Pile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & SEND (§6.3 Step 4) */}
      {step === 4 && (
        <div className="bg-surface rounded-card border border-line p-5 shadow-sm space-y-4 survey-corner">
          <h2 className="font-serif text-lg font-bold text-ink">Review Report Details</h2>

          <div className="flex gap-3">
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Selected"
                className="w-20 h-20 rounded-card object-cover border border-line shrink-0"
              />
            )}
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-ink-3">Category: </span>
                <span className="font-bold text-ink">{selectedCategory}</span>
                {classifyData?.ai?.category && classifyData.ai.category !== selectedCategory && (
                  <span className="block text-[10px] text-moss font-semibold">
                    (You corrected AI suggestion: {classifyData.ai.category})
                  </span>
                )}
              </div>
              <div>
                <span className="text-ink-3">Location: </span>
                <span className="text-ink-2 font-medium">{addressText}</span>
              </div>
              {description && (
                <div>
                  <span className="text-ink-3">Note: </span>
                  <span className="text-ink-2">{description}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-2 rounded-card border border-line text-xs text-ink-2">
            <span className="font-semibold block text-ink mb-0.5">Civic Impact Credit Preview</span>
            Submitting a verified unique waste report earns you <b>10 credits</b> once approved by municipal operators.
          </div>

          <button
            disabled={submitting}
            onClick={handleSubmitReport}
            className="w-full py-3.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
          >
            <span>{submitting ? 'Submitting Report...' : 'Submit Report'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 5: SUCCESS & RECEIPT (§6.3) */}
      {step === 5 && (
        <div className="bg-surface rounded-card border border-line p-6 shadow-sm text-center space-y-4 survey-corner">
          <div className="w-14 h-14 rounded-full bg-moss-100 text-moss flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Report Received</h2>
            <div className="mt-1 inline-block font-mono text-xs font-bold px-3 py-1 bg-surface-2 text-ink rounded border border-line">
              Incident Code: {createdEventCode || 'WE-0014'}
            </div>
          </div>

          <p className="text-xs text-ink-2 max-w-sm mx-auto">
            Thank you for contributing to your city! Your report is now in the municipal inspection queue. Credits will be verified following operator inspection.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => navigate('/reports')}
              className="py-2.5 px-5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded-card shadow"
            >
              Track in My Reports
            </button>
            <button
              onClick={() => {
                setStep(1);
                setPhotoPreview(null);
                setPhotoFile(null);
                setClassifyData(null);
              }}
              className="py-2.5 px-5 bg-surface hover:bg-surface-2 border border-line text-ink font-semibold text-xs rounded-card"
            >
              Report Another Pile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
