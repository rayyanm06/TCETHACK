import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.ts';
import { Award, CheckCircle, Info, ShieldCheck, X } from 'lucide-react';
import { CitizenImpactResponse } from '../../types/api.ts';

export const MyImpact: React.FC = () => {
  const [data, setData] = useState<CitizenImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    async function loadImpact() {
      try {
        const res = await api.get<CitizenImpactResponse>('/impact/me');
        setData(res);
      } catch (err) {
        console.error('Failed to load impact', err);
      } finally {
        setLoading(false);
      }
    }
    loadImpact();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-ink-3">Loading your impact ledger...</div>;
  }

  const totals = data?.totals || {
    verifiedCredits: 0,
    pendingCredits: 0,
    uniqueIncidents: 0,
    supportingContributions: 0,
    resolvedIncidents: 0,
  };

  const nextTierTarget = data?.tier?.nextAt || 50;
  const progressRatio = Math.min(1, totals.verifiedCredits / Math.max(1, nextTierTarget));
  const strokeDashoffset = 440 - 440 * progressRatio;

  return (
    <div className="space-y-6">
      {/* Impact Headline Sentence (§6.6) */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink leading-tight">
          You helped identify <span className="text-moss">{totals.uniqueIncidents}</span> unique waste incidents.{' '}
          <span className="text-moss">{totals.resolvedIncidents}</span> have been resolved.
        </h1>
        <p className="text-xs text-ink-3 mt-1">
          Every verified report helps make city cleanup accountable and transparent.
        </p>
      </div>

      {/* Civic Impact Ring Card (§6.6) */}
      <div className="bg-surface rounded-card border border-line p-6 shadow-sm text-center survey-corner">
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#EFEBE0"
              strokeWidth="12"
              fill="transparent"
            />
            {/* Verified credits progress arc */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#2E6B4E"
              strokeWidth="12"
              strokeDasharray="440"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              {totals.verifiedCredits}
            </span>
            <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
              Verified Credits
            </span>
          </div>
        </div>

        {totals.pendingCredits > 0 && (
          <p className="text-xs text-ink-3 mt-2">
            +{totals.pendingCredits} credits awaiting operator verification
          </p>
        )}

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-pill bg-moss-100 text-moss-700">
            {data?.tier?.name || 'Contributor'} Tier
          </span>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="text-xs text-ink-3 hover:text-ink underline flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            <span>How credits work</span>
          </button>
        </div>
      </div>

      {/* Stat Trio (§6.6) */}
      <div className="grid grid-cols-3 gap-2 bg-surface rounded-card border border-line p-4 shadow-sm text-center divide-x divide-line">
        <div>
          <div className="font-serif text-2xl font-bold text-ink">{totals.uniqueIncidents}</div>
          <div className="text-[11px] text-ink-3">Unique Identified</div>
        </div>
        <div>
          <div className="font-serif text-2xl font-bold text-lagoon">{totals.supportingContributions}</div>
          <div className="text-[11px] text-ink-3">Supporting Confirmations</div>
        </div>
        <div>
          <div className="font-serif text-2xl font-bold text-moss">{totals.resolvedIncidents}</div>
          <div className="text-[11px] text-ink-3">Incidents Resolved</div>
        </div>
      </div>

      {/* "What Changed" Feed (§6.6) */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-ink">What Changed Because of You</h2>

        {!data?.feed || data.feed.length === 0 ? (
          <div className="p-6 bg-surface rounded-card border border-line text-center text-xs text-ink-3">
            Your verified contributions will show up here once approved by operators.
          </div>
        ) : (
          data.feed.map((item) => (
            <div
              key={item.complaintId}
              className="bg-surface rounded-card border border-line p-3.5 shadow-sm flex items-start gap-3"
            >
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt="Waste item"
                  className="w-14 h-14 rounded object-cover border border-line shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-14 h-14 rounded bg-surface-2 border border-line flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-moss" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-ink">{item.code}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-pill ${
                      item.status === 'RESOLVED'
                        ? 'bg-moss text-surface'
                        : item.status === 'SCHEDULED'
                        ? 'bg-lagoon-100 text-lagoon'
                        : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-ink-2 font-medium">{item.sentence}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.transactions.map((tx, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        tx.status === 'VERIFIED'
                          ? 'bg-moss-100 text-moss-700'
                          : 'bg-surface-2 text-ink-3'
                      }`}
                    >
                      +{tx.credits} {tx.type === 'RESOLUTION_BONUS' ? 'Resolved' : 'Identified'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* "How Credits Work" Modal (§6.6) */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-card border border-line p-6 max-w-md w-full shadow-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-ink">How Civic Impact Credits Work</h3>
              <button onClick={() => setShowHowItWorks(false)} className="p-1 hover:bg-surface-2 rounded">
                <X className="w-4 h-4 text-ink-3" />
              </button>
            </div>

            <div className="text-xs text-ink-2 space-y-2.5">
              <p>
                <b>Outcome-verified:</b> Credits count only after an operator reviews the submitted evidence.
              </p>
              <p>
                <b>Duplicate consolidation:</b> Supporting reports earn a smaller verified reward (3 credits) without creating redundant collection stops.
              </p>
              <p>
                <b>Bonus on resolution:</b> When a waste pile you flagged is cleared, you receive a resolution bonus (5 credits for primary reporter, 2 for supporters).
              </p>
              <p>
                <b>Zero spam incentive:</b> Rejected reports or repeated submissions of the same photo earn 0 credits.
              </p>
            </div>

            <button
              onClick={() => setShowHowItWorks(false)}
              className="w-full py-2.5 bg-moss hover:bg-moss-700 text-surface font-semibold text-xs rounded-card shadow"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
