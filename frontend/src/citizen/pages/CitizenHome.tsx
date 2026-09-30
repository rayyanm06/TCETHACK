import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.tsx';
import { api } from '../../lib/api.ts';
import { Camera, ChevronRight, MapPin, Award, CheckCircle2, Clock } from 'lucide-react';
import { CityMap } from '../../map/CityMap.tsx';
import { WasteEventSummary, CitizenImpactResponse } from '../../types/api.ts';

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
  const [nearbyEvents, setNearbyEvents] = useState<WasteEventSummary[]>([]);
  const [loadError,setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [impactRes, reportsRes, eventsRes] = await Promise.allSettled([
          api.get<CitizenImpactResponse>('/impact/me'),
          api.get<{ items: any[] }>('/reports/mine'),
          api.get<{ items: WasteEventSummary[] }>('/public/events'),
        ]);

        if ([impactRes,reportsRes,eventsRes].some(r=>r.status==='rejected')) setLoadError('Some live information could not load. Refresh to try again.');
        if (impactRes.status === 'fulfilled') {
          setImpact(impactRes.value.totals);
        }
        if (reportsRes.status === 'fulfilled' && reportsRes.value.items.length > 0) {
          setLatestReport(reportsRes.value.items[0]);
        }
        if (eventsRes.status === 'fulfilled') {
          setNearbyEvents(eventsRes.value.items);
        }
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Citizen';

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="text-clay text-sm">{loadError}</p>}
      {/* Greeting Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">
          Hello, {firstName}
        </h1>
        <p className="text-xs text-ink-3 mt-0.5">
          Welcome to your local civic cleanup portal.
        </p>
      </div>

      {/* Hero Block (§6.2) */}
      <div className="bg-surface rounded-card border border-line p-5 shadow-sm survey-corner relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[10px] uppercase font-bold tracking-wider text-moss bg-moss-100 px-2 py-0.5 rounded-pill inline-block mb-2">
            Photo · Location · Follow-through
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink leading-snug">
            See waste on the street?<br />Help get it handled correctly.
          </h2>
          <p className="text-xs text-ink-2 mt-1.5 max-w-md">
            Your photograph helps operators consolidate duplicate stops, verify urgency, and plan collections.
          </p>

          <button
            onClick={() => navigate('/report')}
            className="mt-4 w-full sm:w-auto min-h-[52px] px-6 py-3 bg-moss hover:bg-moss-700 text-surface font-semibold text-sm rounded-card flex items-center justify-center gap-2.5 shadow transition transform active:scale-98"
          >
            <Camera className="w-5 h-5 stroke-[2.2]" />
            <span>Report Waste Now</span>
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={()=>navigate('/report?mode=household')} className="bg-surface rounded-card border border-line p-4 text-left"><b className="font-serif text-lg">Something to dispose of at home?</b><p className="text-xs text-ink-2 mt-1">Electronics, bulky items or recyclables. Send a private request for handling review.</p></button>
        <button onClick={()=>navigate('/guide')} className="bg-moss-100 rounded-card border border-moss/20 p-4 text-left"><b className="font-serif text-lg">Which waste goes where?</b><p className="text-xs text-ink-2 mt-1">Simple separation guidance and official disposal resources.</p></button>
      </div>
      {/* Your Impact Strip (§6.2 & §2.2) */}
      <div
        onClick={() => navigate('/impact')}
        className="bg-surface rounded-card border border-line p-4 shadow-sm hover:border-moss/40 transition cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 uppercase tracking-wider">
            <Award className="w-4 h-4 text-moss" />
            <span>Your Civic Impact</span>
          </div>
          <span className="text-xs text-moss font-medium flex items-center gap-0.5">
            View ledger <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-line pt-1">
          <div>
            <div className="font-serif text-xl font-bold text-ink">{impact.uniqueIncidents}</div>
            <div className="text-[11px] text-ink-3">Unique Reported</div>
          </div>
          <div>
            <div className="font-serif text-xl font-bold text-moss">{impact.resolvedIncidents}</div>
            <div className="text-[11px] text-ink-3">Cleared & Resolved</div>
          </div>
          <div>
            <div className="font-serif text-xl font-bold text-ochre">{impact.verifiedCredits}</div>
            <div className="text-[11px] text-ink-3">
              Verified Credits
              {impact.pendingCredits > 0 && (
                <span className="block text-[9px] text-ink-3">(+{impact.pendingCredits} pending)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Update Card */}
      {latestReport && (
        <div
          onClick={() => navigate(`/reports/${latestReport.id}`)}
          className="bg-surface rounded-card border border-line p-4 shadow-sm hover:border-lagoon/40 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-ink-3 mb-2">
            <span className="font-semibold uppercase tracking-wider text-ink-2">Latest Update</span>
            <span>{new Date(latestReport.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={latestReport.imageUrl}
              alt="Waste report"
              className="w-14 h-14 rounded-card object-cover border border-line shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink truncate">
                  {latestReport.category} Waste
                </span>
                <span className="text-xs px-2 py-0.5 rounded-pill bg-moss-100 text-moss font-medium">
                  {latestReport.complaint?.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-ink-3 truncate mt-0.5">
                {latestReport.addressText || 'Local area'}
              </p>
              <p className="text-[11px] text-lagoon font-medium mt-1">
                Tap to view timeline and completion evidence
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Near You Mini-Map Strip */}
      <div className="bg-surface rounded-card border border-line p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-lagoon" />
            <span>Active public reports</span>
          </div>
          <span className="text-[11px] text-ink-3 font-medium">
            {nearbyEvents.length} shown
          </span>
        </div>

        <div className="h-44 rounded-card overflow-hidden border border-line relative">
          <CityMap
            events={nearbyEvents}
            interactive={true}
            zoom={11}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};
