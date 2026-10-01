import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { api } from '../../lib/api.ts';
import {
  Camera,
  Home as HomeIcon,
  ChevronRight,
  MapPin,
  Award,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CityMap } from '../../map/CityMap.tsx';
import { WasteEventSummary, CitizenImpactResponse } from '../../types/api.ts';
import { EvidenceImage } from '../../components/shared/EvidenceImage.tsx';
import { StatusChip } from '../../components/shared/StatusChip.tsx';

export const CitizenHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [impact, setImpact] = useState<CitizenImpactResponse['totals']>({
    verifiedCredits: 0,
    pendingCredits: 0,
    uniqueIncidents: 0,
    supportingContributions: 0,
    resolvedIncidents: 0,
  });
  const [latestReport, setLatestReport] = useState<any>(null);
  const [pilotEvents, setPilotEvents] = useState<WasteEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHomeData() {
      setLoading(true);
      setError(null);
      try {
        const [impactRes, reportsRes, eventsRes] = await Promise.allSettled([
          api.get<CitizenImpactResponse>('/impact/me'),
          api.get<{ items: any[] }>('/reports/mine'),
          api.get<{ items: WasteEventSummary[] }>('/complaints?limit=6'),
        ]);

        if (impactRes.status === 'fulfilled') {
          setImpact(impactRes.value.totals);
        }
        if (reportsRes.status === 'fulfilled' && reportsRes.value.items && reportsRes.value.items.length > 0) {
          setLatestReport(reportsRes.value.items[0]);
        }
        if (eventsRes.status === 'fulfilled' && eventsRes.value.items) {
          // Only show public events on community map (shield household reports)
          setPilotEvents(eventsRes.value.items.filter((e) => e.reportType !== 'HOUSEHOLD'));
        }
      } catch (err: any) {
        console.error('Failed to load home data', err);
        setError('Unable to load latest pilot activity.');
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Citizen';

  return (
    <div className="space-y-6">
      {/* Pilot Welcome Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
          Good day, {firstName}
        </h1>
        <p className="text-xs sm:text-sm text-ink-3 mt-1">
          Greater Mumbai Operations · Waste reporting and collection coordination.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-clay-100 border border-clay/30 rounded text-xs text-clay flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Clear Entry Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Entry Action A: Public Waste */}
        <div
          onClick={() => navigate('/citizen/report?type=public')}
          className="bg-surface rounded-card border-2 border-line hover:border-moss transition p-5 shadow-xs cursor-pointer survey-corner flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-moss/10 text-moss flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="font-serif text-lg font-bold text-ink group-hover:text-moss transition-colors">
              Report waste in a public place
            </h2>
            <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
              For waste on streets, footpaths, corners, and public locations. Photographic evidence helps municipal crews verify urgency and plan consolidation.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-moss">
            <span>Start public report</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Entry Action B: Household Items / E-Waste */}
        <div
          onClick={() => navigate('/citizen/report?type=household')}
          className="bg-surface rounded-card border-2 border-line hover:border-lagoon transition p-5 shadow-xs cursor-pointer survey-corner flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-lagoon/10 text-lagoon flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <HomeIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="font-serif text-lg font-bold text-ink group-hover:text-lagoon transition-colors">
              Request disposal for items at home
            </h2>
            <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
              For old electronics (phones, chargers), appliances, and household items. Requests operational review with authorized take-back services (pickup is not automatically guaranteed).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-lagoon">
            <span>Request household review</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Prominent Active Request Card (If user has submitted reports) */}
      {latestReport && (
        <div className="bg-surface rounded-card border border-line p-4 sm:p-5 shadow-xs survey-corner space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-moss bg-moss-100 px-2 py-0.5 rounded-pill">
                Your Latest Active Request
              </span>
              <span className="font-mono text-xs font-bold text-ink">
                {latestReport.complaint?.code || 'WE-????'}
              </span>
            </div>
            <span className="text-xs text-ink-3">
              {new Date(latestReport.createdAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <EvidenceImage
              src={latestReport.imageUrl}
              alt="Submitted report photo"
              roleBadge={latestReport.role}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-card shrink-0"
              allowLightbox={true}
            />

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif text-base font-bold text-ink">
                  {latestReport.reportType === 'HOUSEHOLD'
                    ? 'Household Disposal Request'
                    : `${latestReport.category} Waste Incident`}
                </span>
                <StatusChip status={latestReport.complaint?.status || 'SUBMITTED'} size="sm" />
              </div>

              <p className="text-xs text-ink-2 flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-clay shrink-0" />
                <span>{latestReport.addressText || 'Pilot Sector'}</span>
              </p>

              <div className="p-2.5 rounded bg-surface-2 border border-line text-[11px] text-ink-2 leading-relaxed">
                <span className="font-bold text-ink">Next step: </span>
                {latestReport.complaint?.status === 'RESOLVED'
                  ? 'Cleared & resolved. Tap below to inspect completion photo.'
                  : latestReport.reportType === 'HOUSEHOLD'
                  ? 'Field coordinator reviewing item details for authorized take-back coordination.'
                  : 'Inspection team assessing consolidation for municipal collection.'}
              </div>

              <button
                onClick={() => navigate(`/citizen/reports/${latestReport.id}`)}
                className="mt-1 text-xs text-moss font-semibold hover:underline flex items-center gap-1"
              >
                <span>View full timeline & evidence dossier</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Activity in Pilot Area (Honest Labeling) */}
      <div className="bg-surface rounded-card border border-line p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-base font-bold text-ink">
              Public Cleanups in Pilot Area
            </h3>
            <p className="text-[11px] text-ink-3">
              Greater Mumbai sector · Active public incident reports undergoing municipal coordination.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-ink-2 bg-surface-2 px-2 py-1 rounded border border-line">
            {pilotEvents.length} public cleanups
          </span>
        </div>

        <div className="h-56 sm:h-64 rounded-card overflow-hidden border border-line relative">
          <CityMap
            events={pilotEvents}
            interactive={true}
            zoom={14}
            height="100%"
          />
        </div>
      </div>

      {/* Secondary: Verified Civic Impact */}
      <div
        onClick={() => navigate('/citizen/impact')}
        className="bg-surface rounded-card border border-line p-4 shadow-xs hover:border-moss/40 transition cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 uppercase tracking-wider">
            <Award className="w-4 h-4 text-moss" />
            <span>Civic Contribution Ledger</span>
          </div>
          <span className="text-xs text-moss font-semibold flex items-center gap-0.5">
            View full record <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-line pt-1">
          <div>
            <div className="font-serif text-lg sm:text-xl font-bold text-ink">{impact.uniqueIncidents}</div>
            <div className="text-[10px] text-ink-3">Unique Reports</div>
          </div>
          <div>
            <div className="font-serif text-lg sm:text-xl font-bold text-moss">{impact.resolvedIncidents}</div>
            <div className="text-[10px] text-ink-3">Cleared & Verified</div>
          </div>
          <div>
            <div className="font-serif text-lg sm:text-xl font-bold text-ochre">{impact.verifiedCredits}</div>
            <div className="text-[10px] text-ink-3">
              Verified Credits
              {impact.pendingCredits > 0 && (
                <span className="block text-[9px] text-ink-3">(+{impact.pendingCredits} pending)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
