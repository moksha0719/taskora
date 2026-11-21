import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { notificationsApi } from '../lib/api/client';
import { NotificationItem } from '../types';
import { CheckCheck, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const dispatchNotificationsUpdated = (unreadCountDelta: number) => {
  window.dispatchEvent(new CustomEvent('taskora:notifications-updated', {
    detail: { unreadCountDelta },
  }));
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setNotifications(await notificationsApi.getNotifications());
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    const unreadCountDelta = notifications.some((item) => item.id === id && !item.read) ? -1 : 0;
    setActionBusy(true);
    setActionError(null);
    try {
      await notificationsApi.markRead(id);
      dispatchNotificationsUpdated(unreadCountDelta);
      await fetchNotifs();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to mark the notification as read.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadCountDelta = -notifications.filter((item) => !item.read).length;
    setActionBusy(true);
    setActionError(null);
    try {
      await notificationsApi.markAllRead();
      dispatchNotificationsUpdated(unreadCountDelta);
      await fetchNotifs();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to mark all notifications as read.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const unreadCountDelta = notifications.some((item) => item.id === id && !item.read) ? -1 : 0;
    setActionBusy(true);
    setActionError(null);
    try {
      await notificationsApi.deleteNotification(id);
      dispatchNotificationsUpdated(unreadCountDelta);
      await fetchNotifs();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to delete the notification.');
    } finally {
      setActionBusy(false);
    }
  };

  const filteredNotifs = notifications.filter(
    (n) => filter === 'all' || n.type === filter
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Notifications Center</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Stay on top of upcoming assignment deadlines, habit reminders, and study room activity.
          </p>
        </div>

        <Button variant="outline" size="sm" pill disabled={actionBusy || !notifications.some((item) => !item.read)} onClick={() => void handleMarkAllRead()}>
          <CheckCheck className="w-4 h-4 text-primary" />
          <span>Mark All Read</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'deadline', 'habit', 'room', 'achievement'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
              filter === tab
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white dark:bg-[#1E163B] border border-subtle text-muted-purple hover:text-deep-purple'
            }`}
          >
            {tab === 'all' ? 'All Notifications' : `${tab}s`}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {actionError && <Card role="alert" className="p-4 text-sm text-rose-600">{actionError}</Card>}
        {loading && <Card role="status" className="p-5 text-sm text-muted-purple">Loading notifications...</Card>}
        {loadError && (
          <Card role="alert" className="p-5 flex items-center justify-between gap-3 text-sm text-rose-600">
            <span>{loadError}</span>
            <button type="button" className="font-bold text-primary" onClick={() => void fetchNotifs()}>
              Retry
            </button>
          </Card>
        )}
        {!loading && !loadError && filteredNotifs.length === 0 && (
          <Card className="p-6 text-sm text-muted-purple">
            {notifications.length === 0
              ? 'You have no notifications yet.'
              : 'No notifications match this filter.'}
          </Card>
        )}
        {!loading && !loadError && filteredNotifs.map((item) => (
          <Card
            key={item.id}
            className={`p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
              !item.read
                ? 'bg-primary-subtle/30 dark:bg-primary/10 border-primary/30'
                : 'opacity-80'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                  !item.read ? 'bg-primary animate-pulse' : 'bg-muted-purple/30'
                }`}
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-deep-purple dark:text-white">
                    {item.title}
                  </h4>
                  <Badge variant="muted">{item.type}</Badge>
                </div>
                <p className="text-xs text-muted-purple">{item.message}</p>
                <span className="text-[10px] text-muted-purple/70 block pt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
              {!item.read && (
                <button
                  disabled={actionBusy}
                  onClick={() => void handleMarkRead(item.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1E163B] border border-subtle text-primary hover:bg-primary-subtle"
                >
                  Mark Read
                </button>
              )}
              <button
                type="button"
                aria-label={`Delete notification: ${item.title}`}
                disabled={actionBusy}
                onClick={() => void handleDelete(item.id)}
                className="rounded-xl border border-subtle p-2 text-muted-purple hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {item.actionUrl && (
                <Button
                  size="sm"
                  pill
                  variant="primary"
                  onClick={() => navigate(item.actionUrl!)}
                >
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
