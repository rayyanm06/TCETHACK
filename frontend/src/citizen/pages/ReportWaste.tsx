import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Home,
  Trash2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { CategoryChip, CATEGORY_DETAILS } from '../../components/shared/CategoryChip.tsx';
import { WasteCategory, ClassifyResponse, DuplicateCandidate, ReportType } from '../../types/api.ts';
import { CitizenLocationPicker } from '../components/CitizenLocationPicker.tsx';
import { EvidenceImage } from '../../components/shared/EvidenceImage.tsx';

export const ReportWaste: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const initialType: ReportType = typeParam === 'household' ? 'HOUSEHOLD' : 'PUBLIC';

  // Multi-step flow:
  // Step 0: Scope Selection (Public vs Household)
  // Step 1: Photo Upload
  // Step 2: Category & Details
  // Step 3: Location (Real Leaflet Map + GPS)
  // Step 4: Review & Submit
  // Step 5: Success
  // If user navigated directly via action button with ?type=..., start at Step 1
  const [step, setStep] = useState<number>(typeParam ? 1 : 0);

  // Scope selection
  const [reportType, setReportType] = useState<ReportType>(initialType);
  const [householdItems, setHouseholdItems] = useState<string>('');
  const [householdQuantity, setHouseholdQuantity] = useState<number>(1);
  const [specialistFlag, setSpecialistFlag] = useState<boolean>(false);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const isAddressManuallyEditedRef = useRef<boolean>(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [classifyData, setClassifyData] = useState<ClassifyResponse | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<WasteCategory>('PLASTIC');
  const [description, setDescription] = useState<string>('');

  // Location state (strictly requires explicit user action: GPS or tap pin)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<'GPS' | 'MAP_PIN' | null>(null);
  const [locationAccuracyM, setLocationAccuracyM] = useState<number | undefined>(undefined);
  const [addressText, setAddressText] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');

  // Duplicate detection state (for public reports)
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateSheet, setShowDuplicateSheet] = useState<boolean>(false);
  const [duplicateDecision, setDuplicateDecision] = useState<'NONE_FOUND' | 'SUPPORT' | 'SEPARATE'>('NONE_FOUND');

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEventCode, setCreatedEventCode] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [nextStepNote, setNextStepNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Photo upload handler
  const handleUploadBlob = async (fileOrBlob: Blob, fileName: string) => {
    setError(null);
    setUploadError(null);
    setPhotoFile({ name: fileName } as any);

    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    const objectUrl = URL.createObjectURL(fileOrBlob);
    setPhotoPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', fileOrBlob, fileName);

      const res = await api.post<ClassifyResponse>('/classify', formData);
      setClassifyData(res);

      if (res.ai && res.ai.status === 'OK' && res.ai.category) {
        setSelectedCategory(res.ai.category);
      } else {
        setSelectedCategory(reportType === 'HOUSEHOLD' ? 'E_WASTE' : 'MIXED');
      }

      setStep(2); // Proceed to Category & Details once successfully uploaded
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Image upload failed. Please retry.');
      setClassifyData(null);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUploadBlob(file, file.name);
  };

  const handleUseSamplePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = reportType === 'HOUSEHOLD' ? '#2A9D8F' : '#E76F51';
      ctx.fillRect(0, 0, 480, 360);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(reportType === 'HOUSEHOLD' ? 'E-Waste Items (4 old phones)' : 'Civic Waste Accumulation', 30, 160);
      ctx.font = '14px sans-serif';
      ctx.fillText('CivicClean Field Pilot Evidence Photo', 30, 200);
      ctx.fillText(new Date().toLocaleString(), 30, 230);
      canvas.toBlob((blob) => {
        if (blob) {
          handleUploadBlob(blob, 'field_evidence.jpg');
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleRetryUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Step 3 location verification and duplicate check
  const handleConfirmLocation = async () => {
    if (!location) {
      setError('Please tap on the map or click "Use My GPS" to mark the incident location.');
      return;
    }

    // Client-side bounding box verification
    const [minLng, minLat, maxLng, maxLat] = [72.84, 19.18, 72.91, 19.24];
    if (
      location.lng < minLng ||
      location.lng > maxLng ||
      location.lat < minLat ||
      location.lat > maxLat
    ) {
      setError('Selected coordinates are outside the rectangular pilot service area (Kandivali East / Borivali East).');
      return;
    }

    setError(null);

    // Private household requests bypass public duplicate checks
    if (reportType === 'HOUSEHOLD') {
      setDuplicateDecision('NONE_FOUND');
      setStep(4);
      return;
    }

    // Public reports check for active nearby public incidents
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
      setStep(4);
    }
  };

  // Support an existing duplicate report
  const handleSupportDuplicate = async (candidateId: string) => {
    if (!classifyData) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<any>(`/complaints/${candidateId}/support`, {
        uploadToken: classifyData.uploadToken,
        location,
        locationSource,
        locationAccuracyM,
        addressText,
        citizenCategory: selectedCategory,
        description,
      });

      setCreatedEventCode(res.complaint.code);
      setCreatedReportId(res.report._id);
      setShowDuplicateSheet(false);
      setNextStepNote('Thank you for confirming this incident. Your evidence helps municipal crews plan consolidation.');
      setStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to submit supporting report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit primary report
  const handleSubmitReport = async () => {
    if (!classifyData || !location) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<any>('/reports', {
        requestId: crypto.randomUUID(),
        uploadToken: classifyData.uploadToken,
        location,
        locationSource,
        locationAccuracyM,
        addressText: landmark
          ? `${addressText || 'Location'} (Landmark: ${landmark})`
          : addressText || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
        citizenCategory: selectedCategory,
        description,
        duplicateDecision,
        reportType,
        householdItems: reportType === 'HOUSEHOLD' ? householdItems : undefined,
        householdQuantity: reportType === 'HOUSEHOLD' ? householdQuantity : undefined,
        specialistFlag,
      });

      setCreatedEventCode(res.complaint.code);
      setCreatedReportId(res.report._id);
      setNextStepNote(res.complaint.nextStepNote);
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
      {/* Step Indicator Header */}
      {step > 0 && step < 5 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Step {step} of 4:{' '}
              {step === 1 ? 'Photo' : step === 2 ? 'Details' : step === 3 ? 'Location' : 'Review'}
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

      {/* STEP 0: SCOPE SELECTION (Public vs Household) */}
      {step === 0 && (
        <div className="bg-surface rounded-card border border-line p-5 shadow-sm space-y-4 survey-corner">
          <div>
            <h1 className="font-serif text-xl font-bold text-ink">What are you reporting?</h1>
            <p className="text-xs text-ink-2 mt-1">
              Select whether this is an outdoor public waste accumulation or personal items at home requiring authorized disposal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              id="scope-public-btn"
              onClick={() => {
                setReportType('PUBLIC');
                setSelectedCategory('PLASTIC');
                setStep(1);
              }}
              className="p-4 rounded-card border-2 border-line hover:border-moss bg-surface text-left transition flex flex-col justify-between space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-moss-100 flex items-center justify-center text-moss">
                  <Trash2 className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-ink-3 group-hover:text-moss transition" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">A. Waste in a public place</h3>
                <p className="text-xs text-ink-3 mt-1">
                  Roadside piles, open ground overflow, public bin overflow, plastic or mixed dumps.
                </p>
              </div>
            </button>

            <button
              type="button"
              id="scope-household-btn"
              onClick={() => {
                setReportType('HOUSEHOLD');
                setSelectedCategory('E_WASTE');
                setStep(1);
              }}
              className="p-4 rounded-card border-2 border-line hover:border-lagoon bg-surface text-left transition flex flex-col justify-between space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-lagoon-100 flex items-center justify-center text-lagoon">
                  <Home className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-ink-3 group-hover:text-lagoon transition" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">B. Items at my home</h3>
                <p className="text-xs text-ink-3 mt-1">
                  Old smartphones (4–5 phones), laptops, broken appliances, electronic scrap.
                </p>
              </div>
            </button>
          </div>

          <div className="p-3 bg-surface-2 rounded border border-line text-xs text-ink-2 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-moss shrink-0 mt-0.5" />
            <span>
              <b>Privacy Guarantee:</b> Household disposal addresses and item details remain confidential to municipal dispatch officers and are never displayed on public map layers.
            </span>
          </div>
        </div>
      )}

      {/* STEP 1: PHOTO EVIDENCE UPLOAD */}
      {step === 1 && (
        <div className="bg-surface rounded-card border border-line p-6 shadow-sm text-center survey-corner space-y-4">
          <div className="max-w-sm mx-auto space-y-2">
            <h2 className="font-serif text-lg font-bold text-ink">
              {reportType === 'HOUSEHOLD' ? 'Photograph the Household Items' : 'Photograph the Waste Incident'}
            </h2>
            <p className="text-xs text-ink-2">
              {reportType === 'HOUSEHOLD'
                ? 'Take a clear photograph showing the devices or appliances needing disposal.'
                : 'Upload real photographic evidence. Photos are validated and stored persistently on the server.'}
            </p>
          </div>

          {uploadError && (
            <div className="p-3 bg-clay-100 border border-clay/30 rounded text-xs text-clay flex items-center justify-between max-w-sm mx-auto">
              <span>{uploadError}</span>
              <button
                onClick={handleRetryUpload}
                className="px-2 py-1 bg-surface border border-clay/40 rounded font-semibold text-[11px] flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {uploading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-moss border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-ink-2 font-medium">
                Uploading photo and processing AI assistance...
              </p>
            </div>
          ) : (
            <div className="pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                <button
                  type="button"
                  id="take-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 px-4 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo / Upload</span>
                </button>
                <button
                  type="button"
                  id="sample-photo-btn"
                  onClick={handleUseSamplePhoto}
                  className="py-3 px-3 bg-surface border border-line hover:border-moss text-ink-2 hover:text-ink font-semibold text-xs rounded-card flex items-center justify-center gap-1.5 transition"
                  title="Generate a valid timestamped pilot evidence photo"
                >
                  <span>Sample Pilot Photo</span>
                </button>
              </div>

              <p className="text-[11px] text-ink-3 mt-3">
                Accepted: JPEG, PNG, WebP up to 5MB. Metadata is sanitized on upload.
              </p>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: CATEGORY & DETAILS */}
      {step === 2 && (
        <div className="bg-surface rounded-card border border-line p-5 shadow-sm space-y-4 survey-corner">
          {/* Photo Thumbnail */}
          {photoPreview && (
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-card border border-line">
              <img
                src={photoPreview}
                alt="Selected evidence"
                className="w-16 h-16 rounded object-cover border border-line shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-moss uppercase tracking-wider block">
                  Photo Received & Attached
                </span>
                <span className="text-xs font-semibold text-ink truncate block">
                  {photoFile?.name || 'Evidence photograph'}
                </span>
                <span className="text-[11px] text-ink-3">
                  {classifyData?.ai?.status === 'OK'
                    ? `AI classification: ${classifyData.ai.category}`
                    : 'AI offline · Manual category selection'}
                </span>
              </div>
            </div>
          )}

          {/* Household item details */}
          {reportType === 'HOUSEHOLD' && (
            <div className="p-3.5 bg-lagoon-100/30 border border-lagoon/30 rounded-card space-y-3">
              <span className="text-xs font-bold text-lagoon uppercase tracking-wider block">
                Household Item Inventory
              </span>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Item Description (e.g. 4 old smartphones, washing machine) *
                </label>
                <input
                  type="text"
                  value={householdItems}
                  onChange={(e) => setHouseholdItems(e.target.value)}
                  placeholder="e.g. 4 old Android/iPhone phones with chargers"
                  className="w-full px-3 py-2 rounded border border-line text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-lagoon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Quantity / Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={householdQuantity}
                  onChange={(e) => setHouseholdQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-24 px-3 py-1.5 rounded border border-line text-xs bg-surface text-ink font-mono"
                />
              </div>
            </div>
          )}

          {/* Category selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-3">
              Confirm Waste Category
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`p-2.5 rounded border text-left text-xs font-semibold flex items-center justify-between transition ${
                    selectedCategory === cat
                      ? 'border-ink bg-ink text-surface shadow'
                      : 'border-line bg-surface text-ink-2 hover:border-ink/40'
                  }`}
                >
                  <span>{cat}</span>
                  {selectedCategory === cat && <CheckCircle2 className="w-3.5 h-3.5 text-surface" />}
                </button>
              ))}
            </div>

            {selectedCategory === 'E_WASTE' && (
              <div className="p-3 bg-plum-100/50 border border-plum/30 rounded text-xs text-plum flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <b>Electronic Waste:</b> Handled separately from ordinary wet/dry trucks. In accordance with CPCB & MPCB rules, e-waste is transferred to authorized dismantlers.
                </span>
              </div>
            )}
          </div>

          {/* Specialist Handling Flag */}
          <div className="p-3 bg-surface-2 rounded border border-line space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={specialistFlag}
                onChange={(e) => setSpecialistFlag(e.target.checked)}
                className="mt-0.5 rounded text-clay focus:ring-clay"
              />
              <div className="text-xs">
                <span className="font-bold text-ink">Specialist / Hazardous waste present</span>
                <p className="text-ink-3 text-[11px] mt-0.5">
                  Check if this pile contains batteries, fluorescent tubes, chemicals, paints, or medical items requiring dedicated safety handling.
                </p>
              </div>
            </label>
          </div>

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">
              Optional landmark or access note
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
            type="button"
            id="proceed-to-location-btn"
            onClick={() => {
              if (reportType === 'HOUSEHOLD' && !householdItems.trim()) {
                setError('Please specify the household items needing disposal.');
                return;
              }
              setError(null);
              setStep(3);
            }}
            className="w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
          >
            <span>Proceed to Location</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 3: INTERACTIVE LEAFLET LOCATION MAP */}
      {step === 3 && (
        <div className="bg-surface rounded-card border border-line p-5 shadow-sm space-y-4 survey-corner">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Pin the Location</h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Acquire your GPS coordinates or tap on the map to place a pin within the rectangular pilot boundary.
            </p>
          </div>

          <CitizenLocationPicker
            location={location}
            locationAccuracyM={locationAccuracyM}
            locationSource={locationSource}
            onLocationChange={(loc, src, acc) => {
              setLocation(loc);
              setLocationSource(src);
              setLocationAccuracyM(acc);
            }}
            onAddressResolved={(addr) => {
              if (!isAddressManuallyEditedRef.current && addr) {
                setAddressText(addr);
              }
            }}
          />

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                Street Address / Locality (Auto-geocoded or editable)
              </label>
              <input
                type="text"
                value={addressText}
                onChange={(e) => {
                  isAddressManuallyEditedRef.current = true;
                  setAddressText(e.target.value);
                }}
                placeholder="e.g. Thakur Complex Main Road, Kandivali East"
                className="w-full px-3 py-2 rounded-card border border-line text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-lagoon"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1">
                Nearby Landmark / Access Note (Optional)
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near ICICI Bank ATM / Gate No. 2"
                className="w-full px-3 py-2 rounded-card border border-line text-xs bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-lagoon"
              />
            </div>
          </div>

          <button
            type="button"
            id="confirm-location-btn"
            onClick={handleConfirmLocation}
            className="w-full py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
          >
            <span>Confirm Location & Check Area</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 3b: DUPLICATE DETECTION MODAL */}
      {showDuplicateSheet && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-panel sm:rounded-panel border border-line p-5 w-full max-w-lg shadow-panel space-y-4">
            <div className="flex items-center gap-2 text-ochre">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-lg font-bold text-ink">Possible Nearby Incident Found</h3>
            </div>

            <p className="text-xs text-ink-2">
              An active incident with a compatible category was reported nearby. Supporting this existing incident consolidates municipal collection and prevents duplicate truck dispatches.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {duplicateCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className="p-3 bg-surface-2 rounded-card border border-line flex items-center gap-3"
                >
                  <EvidenceImage
                    src={cand.photoUrl}
                    alt={`Nearby incident ${cand.code}`}
                    roleBadge="SUPPORTING"
                    className="w-16 h-16 rounded shrink-0"
                    allowLightbox={true}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink">{cand.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-line text-ink-2">
                        {cand.distanceM}m away
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      Reported {cand.ageHours}h ago · {cand.supportCount} neighbor confirmation(s)
                    </p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSupportDuplicate(cand.id)}
                      className="mt-2 px-3 py-1.5 bg-moss hover:bg-moss-700 text-surface text-xs font-semibold rounded shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Support This Incident</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-line flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateDecision('SEPARATE');
                  setShowDuplicateSheet(false);
                  setStep(4);
                }}
                className="px-3 py-2 bg-surface hover:bg-surface-2 border border-line rounded text-xs text-ink font-semibold"
              >
                No, this is a separate distinct pile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & SUBMIT */}
      {step === 4 && (
        <div className="bg-surface rounded-card border border-line p-5 shadow-sm space-y-4 survey-corner">
          <h2 className="font-serif text-lg font-bold text-ink">Review Submission</h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-card border border-line">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Thumbnail"
                  className="w-14 h-14 rounded object-cover border border-line shrink-0"
                />
              )}
              <div>
                <span className="font-bold text-ink text-sm block">
                  {reportType === 'HOUSEHOLD' ? 'Private Household Request' : 'Public Waste Report'}
                </span>
                <span className="text-ink-2">Category: {selectedCategory}</span>
              </div>
            </div>

            {reportType === 'HOUSEHOLD' && (
              <div className="p-3 bg-lagoon-100/40 border border-lagoon/30 rounded text-xs space-y-1">
                <span className="font-bold text-lagoon">Item Inventory:</span>
                <p className="text-ink-2">
                  {householdQuantity}x {householdItems}
                </p>
              </div>
            )}

            {specialistFlag && (
              <div className="p-2.5 bg-clay-100 border border-clay/30 rounded text-clay text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Specialist / hazardous handling flagged by citizen.</span>
              </div>
            )}

            <div className="p-3 bg-surface-2 rounded border border-line space-y-1">
              <span className="text-[10px] uppercase font-bold text-ink-3">Location</span>
              <p className="text-ink font-medium">{addressText || 'Street coordinates'}</p>
              <p className="text-ink-3 font-mono text-[11px]">
                Lat: {location?.lat.toFixed(5)}, Lng: {location?.lng.toFixed(5)}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="confirm-submit-report-btn"
            disabled={submitting}
            onClick={handleSubmitReport}
            className="w-full py-3.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2 shadow"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Submit Report</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 5: SUCCESS STATE */}
      {step === 5 && (
        <div className="bg-surface rounded-card border border-line p-6 shadow-sm text-center space-y-4 survey-corner">
          <div className="w-12 h-12 bg-moss-100 text-moss rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div>
            <span className="font-mono text-xs font-bold text-moss uppercase tracking-wider block">
              Incident Registered
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink mt-1">
              {createdEventCode || 'Report Recorded'}
            </h2>
            <p className="text-xs text-ink-2 mt-2 max-w-sm mx-auto">
              {nextStepNote ||
                'Your submission has been securely recorded on the municipal ledger for operator review.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-xs mx-auto">
            {createdReportId && (
              <button
                type="button"
                onClick={() => navigate(`/reports/${createdReportId}`)}
                className="w-full py-2.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded shadow"
              >
                Track This Report
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="w-full py-2.5 bg-surface hover:bg-surface-2 border border-line text-ink font-semibold text-xs rounded"
            >
              Go to My Reports
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
