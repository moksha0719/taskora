import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { notificationsApi } from '../lib/api/client';
import { NotificationItem } from '../types';
import { Bell, Check, CheckCheck, Clock, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const fetchNotifs = async () => {
    const data = await notificationsApi.getNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    fetchNotifs();
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    fetchNotifs();
  };

  const filteredNotifs = notifications.filter(
    (n) => filter === 'all' || n.type === filter
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>Notifications Center</span>
            <Badge variant="primary">FR-13 Alerts</Badge>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Stay on top of upcoming assignment deadlines, habit reminders, and study room activity.
          </p>
        </div>

        <Button variant="outline" size="sm" pill onClick={handleMarkAllRead}>
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
        {filteredNotifs.map((item) => (
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
                  onClick={() => handleMarkRead(item.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1E163B] border border-subtle text-primary hover:bg-primary-subtle"
                >
                  Mark Read
                </button>
              )}
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
