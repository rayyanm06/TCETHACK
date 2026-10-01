import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.ts';
import {
  Bell,
  CheckCircle2,
  Truck,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check,
  X,
  Navigation,
} from 'lucide-react';

interface CitizenNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  eventId: string | null;
  eventCode: string | null;
  reportId: string | null;
  locationText: string | null;
  isRead: boolean;
  createdAt: string;
}

export const CitizenNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<CitizenNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await api.get<{ items: CitizenNotification[]; unreadCount: number }>(
        '/notifications'
      );
      setNotifications(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to fetch citizen notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 6000);

    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notif: CitizenNotification) => {
    if (!notif.isRead) {
      try {
        await api.patch(`/notifications/${notif.id}/read`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.warn('Could not mark read', err);
      }
    }

    setIsOpen(false);

    if (notif.reportId) {
      navigate(`/citizen/reports/${notif.reportId}`);
    } else {
      navigate('/citizen/reports');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Could not mark all read', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'COLLECTED':
      case 'RESOLUTION':
        return <CheckCircle2 className="w-4 h-4 text-moss shrink-0" />;
      case 'ARRIVED':
        return <Navigation className="w-4 h-4 text-ochre shrink-0" />;
      case 'ASSIGNED':
      case 'ROUTE_CHANGE':
        return <Truck className="w-4 h-4 text-lagoon shrink-0" />;
      case 'VERIFIED':
        return <ShieldCheck className="w-4 h-4 text-moss shrink-0" />;
      case 'REOPENED':
      case 'REJECTED':
        return <AlertCircle className="w-4 h-4 text-clay shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-ink-3 shrink-0" />;
    }
  };

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-1.5 rounded-full hover:bg-surface-2 text-ink-2 hover:text-ink transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-clay text-[10px] font-bold text-surface flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-line rounded-card shadow-panel z-50 overflow-hidden text-xs">
          <div className="p-3 bg-surface-2/70 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-ink">Updates & Progress</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-clay-100 text-clay text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-moss-700 hover:underline font-semibold flex items-center gap-0.5"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-ink-3 space-y-1">
                <Bell className="w-6 h-6 mx-auto opacity-30" />
                <p className="text-xs">No notifications yet.</p>
                <p className="text-[10px]">Updates about your waste reports will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 cursor-pointer hover:bg-surface-2 transition flex items-start gap-2.5 ${
                    !n.isRead ? 'bg-moss-100/25' : ''
                  }`}
                >
                  <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs truncate block ${
                          !n.isRead ? 'font-bold text-ink' : 'font-semibold text-ink-2'
                        }`}
                      >
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-moss shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-ink-3 mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[9px] text-ink-3 mt-1 block">
                      {new Date(n.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
