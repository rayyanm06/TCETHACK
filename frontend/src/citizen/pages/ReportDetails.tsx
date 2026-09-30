import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { Timeline } from '../../components/shared/Timeline.tsx';
import { ArrowLeft, MapPin, Award, CheckCircle2 } from 'lucide-react';

export const ReportDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await api.get<any>(`/reports/${id}`);
        setData(res);setError(null);
      } catch (err: any) {
        setError(err.message || 'Report not found.');
      } finally {
        setLoading(false);
      }
    }
    loadReport();
    const interval=setInterval(loadReport,10000);
    return ()=>clearInterval(interval);
  }, [id]);

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

  return (
    <div className="space-y-4">
      {data.handling && <section className="bg-surface p-4 rounded-card border border-line text-sm"><b>{data.handling.title}</b><p className="mt-2 text-ink-2">{data.handling.message}</p>{complaint.handoff?.facilityName && <p className="mt-2">Operator-recorded handoff: {complaint.handoff.facilityName} · Reference {complaint.handoff.reference}</p>}</section>}
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
              {report.citizenCategory} Waste Incident
            </h1>
            <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-clay shrink-0" />
              <span>{report.addressText || complaint.addressText}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Closure Verification Section (§6.5 & §18) */}
      {complaint.status === 'RESOLVED' && closure && (
        <div className="bg-moss-100/60 border border-moss/30 rounded-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-moss-700 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Operator-recorded completion</span>
          </div>

          {closure.photoUrl && (
            <img
              src={closure.photoUrl}
              alt="Cleared waste site"
              className="w-full h-44 rounded object-cover border border-moss/20"
            />
          )}

          {closure.note && (
            <p className="text-xs text-ink-2 bg-surface/80 p-2.5 rounded border border-moss/20">
              <b>Operator Note:</b> {closure.note}
            </p>
          )}

          <div className="text-[11px] text-ink-3">
            Completion recorded on {new Date(closure.resolvedAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      )}

      {/* Progress Timeline */}
      <div className="bg-surface rounded-card border border-line p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2 mb-3">
          Operational Progress Timeline
        </h2>
        <Timeline currentStatus={complaint.status} history={timeline} />
      </div>

      {/* What Your Report Did & Credits Card (§6.5) */}
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
              {complaint.supportCount} other neighbor{complaint.supportCount === 1 ? '' : 's'} also confirmed this incident.
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
                      : 'bg-surface-2 text-ink-3'
                  }`}
                >
                  +{tx.credits} {tx.status === 'VERIFIED' ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
