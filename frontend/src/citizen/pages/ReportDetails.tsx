import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { Timeline } from '../../components/shared/Timeline.tsx';
import { EvidenceImage } from '../../components/shared/EvidenceImage.tsx';
import {
  ArrowLeft,
  MapPin,
  Award,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const ReportDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reopen state
  const [reopening, setReopening] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  const loadReport = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        if (!data) setLoading(true);
        else setRefreshing(true);
      }
      try {
        const res = await api.get<any>(`/reports/${id}`);
        setData(res);
        setError(null);
      } catch (err: any) {
        if (!data) {
          setError(err.message || 'Report not found.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, data]
  );

  // Initial load, modest 6s polling while open, and focus refresh
  useEffect(() => {
    loadReport(false);

    const interval = setInterval(() => {
      loadReport(true);
    }, 6000);

    const handleFocus = () => {
      loadReport(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [id]);

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setReopenError('Please provide a specific reason (e.g. waste is still present on site).');
      return;
    }

    setReopening(true);
    setReopenError(null);

    try {
      await api.post(`/reports/${id}/reopen`, { reason: reopenReason.trim() });
      setShowReopenForm(false);
      setReopenReason('');
      await loadReport(false);
    } catch (err: any) {
      setReopenError(err.message || 'Could not dispute closure.');
    } finally {
      setReopening(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-ink-3 space-y-2">
        <div className="w-5 h-5 border-2 border-moss border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading report details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-surface rounded-card border border-line text-center space-y-3 survey-corner">
        <p className="text-xs text-clay font-medium">{error || 'Unable to load report.'}</p>
        <button
          onClick={() => navigate('/reports')}
          className="text-xs text-moss font-semibold underline"
        >
          Return to My Reports
        </button>
      </div>
    );
  }

  const { report, complaint, timeline, closure, impact } = data;
  const isHousehold = report.reportType === 'HOUSEHOLD' || complaint.reportType === 'HOUSEHOLD';

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header controls: Back & Refresh */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Reports</span>
        </button>

        <button
          type="button"
          onClick={() => loadReport(false)}
          disabled={refreshing}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface border border-line hover:bg-surface-2 text-xs font-medium text-ink-2 shadow-xs transition"
          title="Refresh latest updates from field operations"
        >
          <RefreshCw className={`w-3 h-3 text-moss ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Main Evidence Dossier Card */}
      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-xs survey-corner">
        {/* Primary Evidence Photograph (with Lightbox) */}
        <div className="relative">
          <EvidenceImage
            src={report.imageUrl}
            alt="Original reported waste evidence"
            roleBadge={report.role}
            className="w-full h-56 sm:h-72"
            allowLightbox={true}
          />
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink">
                {complaint.code}
              </span>
              <span className="text-[10px] uppercase font-bold text-ink-3 px-2 py-0.5 rounded bg-surface-2 border border-line">
                {report.citizenCategory}
              </span>
            </div>
            <StatusChip status={complaint.status} />
          </div>

          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink">
              {isHousehold ? 'Household Disposal Request' : `${report.citizenCategory} Waste Incident`}
            </h1>
            <p className="text-xs text-ink-2 mt-1 flex items-start gap-1.5 leading-relaxed">
              <MapPin className="w-3.5 h-3.5 text-clay shrink-0 mt-0.5" />
              <span>{report.addressText || complaint.addressText}</span>
            </p>
          </div>

          {/* Household Privacy Clarification */}
          {isHousehold && (
            <div className="p-3 bg-surface-2 rounded-card border border-line text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-ink">
                <ShieldCheck className="w-3.5 h-3.5 text-lagoon" />
                <span>Private Household Request</span>
              </div>
              <p className="text-ink-2">
                <b>Inventory:</b> {report.householdQuantity || 1}x {report.householdItems || 'Household items'}
              </p>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Kept strictly confidential to operational dispatch coordinators. Address and items are shielded from public maps and community feeds.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Disputed / Reopened Warning Banner */}
      {complaint.status === 'REOPENED' && (
        <div className="bg-clay-100 border border-clay/30 rounded-card p-4 space-y-2 survey-corner">
          <div className="flex items-center gap-2 text-clay font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Incident Disputed & Under Re-inspection</span>
          </div>
          <p className="text-xs text-ink-2 leading-relaxed">
            You reported that this incident was not properly cleared: <i>"{complaint.reopenReason}"</i>.
            Prior clearance record has been reopened and escalated for re-inspection.
          </p>
        </div>
      )}

      {/* Resolved Clearance Record & Photograph */}
      {complaint.status === 'RESOLVED' && closure && (
        <div className="bg-moss-100/50 border border-moss/30 rounded-card p-4 sm:p-5 space-y-3.5 survey-corner">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-moss-700 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Clearance Completion Record</span>
            </div>
            <button
              onClick={() => setShowReopenForm(!showReopenForm)}
              className="text-[11px] text-clay font-semibold underline hover:text-clay/80 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Dispute / Waste Still There</span>
            </button>
          </div>

          {/* Clearance Photograph */}
          {closure.photoUrl && (
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-ink-3 block">
                Completion Evidence Photo
              </span>
              <EvidenceImage
                src={closure.photoUrl}
                alt="Cleared waste site"
                roleBadge="CLOSURE"
                className="w-full h-48 sm:h-60 rounded border border-moss/30"
                allowLightbox={true}
              />
            </div>
          )}

          {/* Specialist Handoff Record (Honest Labeling) */}
          {closure.receivingFacilityName && (
            <div className="p-3 bg-surface rounded border border-moss/30 text-xs space-y-1.5">
              <span className="font-bold text-ink block">
                Recorded Specialist Recycler Handoff:
              </span>
              <p className="text-ink-2 font-medium">{closure.receivingFacilityName}</p>
              {closure.receiptReference && (
                <p className="text-[11px] text-ink-3">
                  <b>Receipt / Transfer Ref:</b> {closure.receiptReference}
                </p>
              )}
              {closure.sourceUrl && (
                <a
                  href={closure.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-lagoon font-semibold underline flex items-center gap-1"
                >
                  <span>View Recycler Directory Reference</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {closure.note && (
            <p className="text-xs text-ink-2 bg-surface/90 p-2.5 rounded border border-moss/20">
              <b>Crew / Operator Note:</b> {closure.note}
            </p>
          )}

          <div className="text-[11px] text-ink-3">
            Cleared on {new Date(closure.resolvedAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {/* Dispute / Reopen Form */}
          {showReopenForm && (
            <div className="mt-3 p-3.5 bg-surface rounded border border-clay/30 space-y-2.5">
              <span className="text-xs font-bold text-clay block">
                Dispute Clearance & Reopen for Inspection
              </span>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                If the site was only partially cleared or waste remains, please explain what is still present. This triggers supervisor re-inspection.
              </p>

              {reopenError && <p className="text-xs text-clay font-medium">{reopenError}</p>}

              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="State what is still present at the site..."
                rows={2}
                className="w-full p-2 border border-line rounded text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-clay"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowReopenForm(false)}
                  className="px-3 py-1.5 text-xs text-ink-3 hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reopening}
                  onClick={handleReopen}
                  className="px-3.5 py-1.5 bg-clay hover:bg-clay/90 text-surface text-xs font-semibold rounded shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{reopening ? 'Submitting dispute...' : 'Confirm Dispute'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Timeline: Separated History & Next Steps */}
      <div className="bg-surface rounded-card border border-line p-4 sm:p-5 shadow-xs survey-corner">
        <Timeline
          currentStatus={complaint.status}
          category={report.citizenCategory}
          reportType={report.reportType}
          specialistQueue={complaint.specialistQueue}
          specialistFlag={complaint.specialistFlag}
          assignedRouteId={complaint.assignedRouteId}
          history={timeline}
          closure={closure}
        />
      </div>

      {/* Civic Impact Ledger Section */}
      {impact && impact.length > 0 && (
        <div className="bg-surface rounded-card border border-line p-4 shadow-xs survey-corner space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-moss" />
            <span>Civic Contribution Ledger Entry</span>
          </div>

          <div className="space-y-1.5">
            {impact.map((tx: any) => (
              <div
                key={tx._id}
                className="p-2.5 rounded bg-surface-2 border border-line flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-ink block">
                    {tx.type === 'PRIMARY_REPORT'
                      ? 'Primary Incident Contribution'
                      : tx.type === 'SUPPORT_REPORT'
                      ? 'Supporting Evidence Confirmation'
                      : 'Resolution Verification'}
                  </span>
                  <span className="text-[10px] text-ink-3">
                    Status: <b>{tx.status}</b> {tx.stateReason ? `· ${tx.stateReason}` : ''}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold ${
                    tx.status === 'VERIFIED' ? 'text-moss' : 'text-ochre'
                  }`}
                >
                  +{tx.credits} Credits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
