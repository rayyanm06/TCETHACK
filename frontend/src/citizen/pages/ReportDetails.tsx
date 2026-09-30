import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { Timeline } from '../../components/shared/Timeline.tsx';
import {
  ArrowLeft,
  MapPin,
  Award,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const ReportDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reopen state
  const [reopening, setReopening] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  async function loadReport() {
    try {
      const res = await api.get<any>(`/reports/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Report not found.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
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
      await loadReport();
    } catch (err: any) {
      setReopenError(err.message || 'Could not dispute closure.');
    } finally {
      setReopening(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-ink-3">Loading report details...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-surface rounded-card border border-line text-center space-y-3">
        <p className="text-xs text-clay">{error || 'Unable to load report.'}</p>
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
    <div className="space-y-4">
      <button
        onClick={() => navigate('/reports')}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Reports</span>
      </button>

      {/* Photo Header */}
      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <img
          src={report.imageUrl}
          alt="Reported waste"
          className="w-full h-48 sm:h-64 object-cover"
        />

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold text-ink">
              {complaint.code}
            </span>
            <StatusChip status={complaint.status} />
          </div>

          <div>
            <h1 className="font-serif text-xl font-bold text-ink">
              {isHousehold ? 'Household Disposal Request' : `${report.citizenCategory} Waste Incident`}
            </h1>
            <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-clay shrink-0" />
              <span>{report.addressText || complaint.addressText}</span>
            </p>
          </div>

          {isHousehold && report.householdItems && (
            <div className="p-3 bg-surface-2 rounded border border-line text-xs space-y-1">
              <span className="font-bold text-ink block">Household Item Details:</span>
              <p className="text-ink-2">
                {report.householdQuantity || 1}x {report.householdItems}
              </p>
              <p className="text-[11px] text-ink-3">
                Kept confidential to municipal operations. Not displayed on public maps.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reopened Alert */}
      {complaint.status === 'REOPENED' && (
        <div className="bg-clay-100 border border-clay/30 rounded-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-clay font-bold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Incident Disputed & Reopened</span>
          </div>
          <p className="text-xs text-ink-2">
            You reported that this incident was not properly cleared: <i>"{complaint.reopenReason}"</i>.
            Municipal resolution credits have been revoked and the incident has been escalated for re-investigation.
          </p>
        </div>
      )}

      {/* Closure Verification Section */}
      {complaint.status === 'RESOLVED' && closure && (
        <div className="bg-moss-100/60 border border-moss/30 rounded-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-moss-700 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Municipal Clearance & Completion Record</span>
            </div>
            <button
              onClick={() => setShowReopenForm(!showReopenForm)}
              className="text-[11px] text-clay font-semibold underline hover:text-clay/80 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Dispute / Waste Still There</span>
            </button>
          </div>

          {closure.photoUrl && (
            <img
              src={closure.photoUrl}
              alt="Cleared waste site"
              className="w-full h-44 rounded object-cover border border-moss/20"
            />
          )}

          {/* Specialist Handoff Record if present */}
          {closure.receivingFacilityName && (
            <div className="p-3 bg-surface rounded border border-moss/30 text-xs space-y-1.5">
              <span className="font-bold text-ink block">Authorized Receiving Facility:</span>
              <p className="text-ink-2">{closure.receivingFacilityName}</p>
              {closure.receiptReference && (
                <p className="text-[11px] text-ink-3">
                  <b>Receipt / Acceptance Ref:</b> {closure.receiptReference}
                </p>
              )}
              {closure.sourceUrl && (
                <a
                  href={closure.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-lagoon font-semibold underline flex items-center gap-1"
                >
                  <span>Verify Service Directory Listing</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {closure.note && (
            <p className="text-xs text-ink-2 bg-surface/80 p-2.5 rounded border border-moss/20">
              <b>Operator Note:</b> {closure.note}
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
            <div className="mt-3 p-3 bg-surface rounded border border-clay/30 space-y-2">
              <span className="text-xs font-bold text-clay block">
                Dispute Closure & Reopen Incident
              </span>
              <p className="text-[11px] text-ink-3">
                If the waste was not actually removed or was only partially cleared, please state what remains. This will notify municipal supervision and revoke resolution bonus credits.
              </p>

              {reopenError && <p className="text-xs text-clay">{reopenError}</p>}

              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Explain what is still present at the site..."
                rows={2}
                className="w-full p-2 border border-line rounded text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-clay"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowReopenForm(false)}
                  className="px-2.5 py-1 text-xs text-ink-3 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reopening}
                  onClick={handleReopen}
                  className="px-3 py-1.5 bg-clay hover:bg-clay/90 text-surface text-xs font-semibold rounded shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{reopening ? 'Reopening...' : 'Confirm Dispute & Reopen'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Timeline */}
      <div className="bg-surface rounded-card border border-line p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2 mb-3">
          Operational Progress Timeline
        </h2>
        <Timeline currentStatus={complaint.status} history={timeline} />
      </div>

      {/* Contribution & Impact Credits Card */}
      <div className="bg-surface rounded-card border border-line p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-2 uppercase tracking-wider">
          <Award className="w-4 h-4 text-moss" />
          <span>Your Contribution</span>
        </div>

        <div className="text-xs text-ink-2">
          {report.role === 'PRIMARY' ? (
            <p>You were the <b>primary reporter</b> who identified this waste pile.</p>
          ) : (
            <p>You <b>confirmed and supported</b> an existing nearby waste incident.</p>
          )}
          {complaint.supportCount > 0 && (
            <p className="text-ink-3 mt-0.5">
              {complaint.supportCount} other neighbor{complaint.supportCount === 1 ? '' : 's'} also contributed to this incident.
            </p>
          )}
        </div>

        {impact && impact.length > 0 && (
          <div className="pt-2 border-t border-line space-y-1.5">
            {impact.map((tx: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-ink-2">{tx.reason}</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    tx.status === 'VERIFIED'
                      ? 'bg-moss-100 text-moss-700'
                      : tx.status === 'REVOKED'
                      ? 'bg-clay-100 text-clay line-through'
                      : 'bg-surface-2 text-ink-3'
                  }`}
                >
                  +{tx.credits} {tx.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
