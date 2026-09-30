import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { EvidenceImage } from '../../components/shared/EvidenceImage.tsx';
import { Plus, ChevronRight, Inbox } from 'lucide-react';

interface ReportItem {
  id: string;
  role: 'PRIMARY' | 'SUPPORTING';
  imageUrl: string;
  category: string;
  addressText: string;
  createdAt: string;
  complaint: {
    id: string;
    code: string;
    status: string;
    supportCount: number;
    updatedAt: string;
  };
  impact: {
    credits: number;
    state: string;
  };
}

export const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        const res = await api.get<{ items: ReportItem[] }>(`/reports/mine?status=${filter}`);
        setReports(res.items || []);
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">My Reports</h1>
          <p className="text-xs text-ink-3">Track what happened to everything you flagged.</p>
        </div>

        <button
          onClick={() => navigate('/report')}
          className="px-3 py-1.5 bg-moss hover:bg-moss-700 text-surface text-xs font-semibold rounded-card flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Report</span>
        </button>
      </div>

      {/* Segmented Filter (§6.4) */}
      <div className="flex bg-surface-2 p-1 rounded-card border border-line">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
            filter === 'all' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
            filter === 'active' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
            filter === 'resolved' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-card border border-line animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-surface rounded-card border border-line p-8 text-center survey-corner space-y-3">
          <Inbox className="w-10 h-10 text-ink-3 mx-auto stroke-[1.5]" />
          <div>
            <h3 className="text-sm font-bold text-ink">No reports found</h3>
            <p className="text-xs text-ink-3 mt-0.5">
              {filter !== 'all' ? 'No reports matching this filter.' : 'Your first report takes under a minute.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/report')}
            className="px-4 py-2 bg-moss hover:bg-moss-700 text-surface text-xs font-semibold rounded-card"
          >
            Report Waste
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="bg-surface rounded-card border border-line p-3.5 shadow-sm hover:border-moss/40 transition cursor-pointer flex items-center gap-3.5"
            >
              <EvidenceImage
                src={report.imageUrl}
                alt={`Report ${report.complaint?.code || 'evidence'}`}
                roleBadge={report.role}
                className="w-[72px] h-[72px] rounded shrink-0"
                allowLightbox={false}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink">
                      {report.complaint?.code || 'WE-????'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-ink-3 px-1.5 py-0.2 rounded bg-surface-2">
                      {report.category}
                    </span>
                  </div>
                  <StatusChip status={report.complaint?.status || 'SUBMITTED'} size="sm" />
                </div>

                <p className="text-xs text-ink-2 truncate">
                  {report.addressText || 'Local Street'}
                </p>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-line/50 text-[11px] text-ink-3">
                  <span className="font-medium text-moss">
                    {report.role === 'PRIMARY' ? '★ You reported' : '👥 You supported'}
                  </span>
                  <span>
                    {new Date(report.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-ink-3 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
