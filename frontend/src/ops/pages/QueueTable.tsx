import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.ts';
import { WasteEventSummary } from '../../types/api.ts';
import { StatusChip } from '../../components/shared/StatusChip.tsx';
import { PriorityChip } from '../../components/shared/PriorityChip.tsx';
import { ArrowLeft, RefreshCw, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EventDrawer } from '../drawer/EventDrawer.tsx';

export const QueueTable: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<WasteEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: WasteEventSummary[] }>('/complaints?includeResolved=true');
      setEvents(res.items || []);
    } catch (err) {
      console.error('Failed to load queue table', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-surface border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ops')}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Map View</span>
          </button>
          <span className="text-line">|</span>
          <span className="font-serif text-base font-bold text-ink">Municipal Operational Queue</span>
        </div>

        <button
          onClick={fetchEvents}
          className="p-1.5 rounded hover:bg-surface-2 text-ink-3 hover:text-ink"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <div className="bg-surface rounded-card border border-line shadow-sm overflow-x-auto survey-corner">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 border-b border-line text-[11px] uppercase font-bold text-ink-3">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority Tier</th>
                <th className="py-3 px-4">Weight (kg)</th>
                <th className="py-3 px-4">Reports</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className="hover:bg-surface-2/40 cursor-pointer transition"
                >
                  <td className="py-3 px-4 font-mono font-bold text-ink">{ev.code}</td>
                  <td className="py-3 px-4 font-medium text-ink">{ev.category}</td>
                  <td className="py-3 px-4">
                    <StatusChip status={ev.status} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <PriorityChip
                      tier={ev.priority?.tier || (ev.status === 'SUBMITTED' ? 'Low' : 'Normal')}
                      score={ev.status === 'SUBMITTED' ? undefined : ev.priority?.score}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {ev.estimatedWeightKg ? `${ev.estimatedWeightKg} kg` : '—'}
                  </td>
                  <td className="py-3 px-4 font-semibold">{ev.reportCount}</td>
                  <td className="py-3 px-4 text-ink-3 truncate max-w-xs">{ev.addressText}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventId(ev.id);
                      }}
                      className="text-moss font-semibold hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {selectedEventId && (
        <EventDrawer
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onEventUpdated={fetchEvents}
        />
      )}
    </div>
  );
};
