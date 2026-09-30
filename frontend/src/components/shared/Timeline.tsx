interface Props {
  currentStatus: string;
  history?: Array<{ to: string; createdAt: string; note?: string }>;
}
export function Timeline({ currentStatus, history = [] }: Props) {
  const labels: Record<string, string> = {
    SUBMITTED: 'Received for review',
    VERIFIED: 'Reviewed by operator',
    SCHEDULED: 'Collection assigned',
    RESOLVED: 'Completion recorded',
    REJECTED: 'Request rejected',
  };
  return (
    <div className="space-y-4">
      {history.map((h, i) => (
        <div key={`${h.createdAt}-${i}`} className="border-l-2 border-moss pl-3">
          <div className="flex justify-between gap-2">
            <b className="text-sm">{labels[h.to] || h.to}</b>
            <time className="text-xs text-ink-3">
              {new Date(h.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
          {h.note && <p className="text-xs text-ink-2 mt-1">{h.note}</p>}
        </div>
      ))}
      <p className="text-xs bg-surface-2 p-3 rounded">
        Current status: {labels[currentStatus] || currentStatus}
      </p>
    </div>
  );
}
