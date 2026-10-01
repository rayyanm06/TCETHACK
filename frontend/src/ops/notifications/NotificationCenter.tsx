import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api.ts';
import {
  OperatorNotification,
  NotificationsResponse,
  NotificationSeverity,
} from '../../types/api.ts';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Flame,
  Truck,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react';

interface NotificationCenterProps {
  onSelectEvent: (eventId: string, coordinates?: { lat: number; lng: number }) => void;
}

export type NotificationFilter = 'ALL' | 'HIGH_PRIORITY' | 'ROUTE' | 'COLLECTION' | 'SYSTEM';

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onSelectEvent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<OperatorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async (filter = activeFilter) => {
    try {
      const res = await api.get<NotificationsResponse>(`/notifications?filter=${filter}`);
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
      setCriticalCount(res.criticalCount || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 6000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (notification: OperatorNotification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification.id}/read`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        if (notification.severity === 'CRITICAL') {
          setCriticalCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.warn('Failed to mark read', err);
      }
    }

    if (notification.eventId) {
      onSelectEvent(notification.eventId, notification.coordinates);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await api.post('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setCriticalCount(0);
    } catch (err) {
      console.warn('Failed to mark all read', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHours = Math.round(diffMin / 60);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-clay text-surface';
      case 'HIGH':
        return 'bg-ochre text-surface';
      case 'NORMAL':
        return 'bg-lagoon text-surface';
      default:
        return 'bg-ink-3 text-surface';
    }
  };

  const getTypeIcon = (type: string, severity: NotificationSeverity) => {
    if (severity === 'CRITICAL') return <Flame className="w-4 h-4 text-clay" />;
    if (type === 'ROUTE_CHANGE' || type === 'CAPACITY_EXCEEDED')
      return <Truck className="w-4 h-4 text-ochre" />;
    if (type === 'RESOLUTION') return <CheckCircle className="w-4 h-4 text-moss" />;
    if (type === 'OVERDUE') return <Clock className="w-4 h-4 text-clay" />;
    return <AlertTriangle className="w-4 h-4 text-lagoon" />;
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Header Bell Trigger */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Operator Attention Center"
        className="relative p-2 rounded-full hover:bg-surface-2 border border-line text-ink-2 hover:text-ink transition flex items-center justify-center"
      >
        <Bell className="w-4 h-4" />

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-clay text-surface font-mono font-bold text-[10px] flex items-center justify-center shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Pulsing Critical Attention Indicator */}
        {criticalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-clay animate-ping opacity-75" />
        )}
      </button>

      {/* Slide-out / Dropdown Notification Center */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-card shadow-panel flex flex-col max-h-[580px] overflow-hidden">
          {/* Header */}
          <div className="p-3.5 bg-surface-2/70 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold text-ink">Operator Alert Center</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-clay/10 text-clay border border-clay/30">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-[11px] font-semibold text-moss hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All Read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-line bg-surface flex items-center gap-1 overflow-x-auto text-[11px]">
            {[
              { id: 'ALL', label: 'All Alerts' },
              { id: 'HIGH_PRIORITY', label: 'High Priority' },
              { id: 'ROUTE', label: 'Route & Capacity' },
              { id: 'COLLECTION', label: 'Collection Events' },
              { id: 'SYSTEM', label: 'System' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as NotificationFilter)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold whitespace-nowrap transition ${
                  activeFilter === f.id
                    ? 'bg-ink text-surface'
                    : 'bg-surface-2 text-ink-3 hover:text-ink border border-line'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notifications Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-line/60">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-3">
                No active notifications in this category.
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.isRead;
                const isCritical = n.severity === 'CRITICAL';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n)}
                    className={`p-3.5 hover:bg-surface-2/60 transition cursor-pointer flex items-start gap-3 relative ${
                      isUnread
                        ? isCritical
                          ? 'bg-clay-100/30'
                          : 'bg-surface-2/40'
                        : 'bg-surface'
                    }`}
                  >
                    {/* Unread Accent Dot */}
                    {isUnread && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-clay" />
                    )}

                    <div className="mt-0.5 shrink-0">{getTypeIcon(n.type, n.severity)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {n.eventCode && (
                            <span className="font-mono text-xs font-bold text-ink shrink-0">
                              {n.eventCode}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${getSeverityBadge(
                              n.severity
                            )}`}
                          >
                            {n.severity}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-3 whitespace-nowrap">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>

                      <h5 className="font-bold text-xs text-ink mb-1 leading-snug">{n.title}</h5>

                      <p className="text-[11px] text-ink-2 mb-2 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>

                      {n.locationText && (
                        <div className="flex items-center justify-between text-[10px] text-ink-3">
                          <span className="truncate max-w-[240px]">📍 {n.locationText}</span>
                          {n.eventId && (
                            <span className="text-lagoon font-bold hover:underline flex items-center gap-0.5">
                              <span>Focus Map</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
