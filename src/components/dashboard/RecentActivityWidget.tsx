import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, Clock3, ListTodo } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../common/Card';
import { focusApi, notesApi, tasksApi } from '../../lib/api/client';

interface ActivityItem {
  id: string;
  title: string;
  occurredAt: string;
  icon: LucideIcon;
  color: string;
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Recently';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load recent activity.';
}

export const RecentActivityWidget: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasks, notes, sessions] = await Promise.all([
        tasksApi.getTasks(),
        notesApi.getNotes(),
        focusApi.getSessions(),
      ]);
      const recent: ActivityItem[] = [
        ...tasks.map((task) => ({
          id: `task-${task.id}`,
          title: `${task.status === 'completed' ? 'Completed' : 'Updated'} task: ${task.title}`,
          occurredAt: task.updatedAt,
          icon: task.status === 'completed' ? Check : ListTodo,
          color: task.status === 'completed'
            ? 'bg-mint-accent text-mint-accent-text dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-primary-subtle text-primary dark:bg-primary/20 dark:text-lavender-300',
        })),
        ...notes.map((note) => ({
          id: `note-${note.id}`,
          title: `Updated note: ${note.title}`,
          occurredAt: note.updatedAt,
          icon: BookOpen,
          color: 'bg-soft-peach text-soft-peach-text dark:bg-amber-950/40 dark:text-amber-300',
        })),
        ...sessions.map((session) => ({
          id: `focus-${session.id}`,
          title: `Completed ${session.durationMinutes}-minute focus session${session.subject ? `: ${session.subject}` : ''}`,
          occurredAt: session.completedAt,
          icon: Clock3,
          color: 'bg-soft-blue text-soft-blue-text dark:bg-sky-950/40 dark:text-sky-300',
        })),
      ];
      setActivities(
        recent
          .filter((activity) => Number.isFinite(Date.parse(activity.occurredAt)))
          .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
          .slice(0, 5)
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities, reloadKey]);

  return (
    <Card className="p-6">
      <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white mb-4">
        Recent Activity
      </h3>

      {loading && <p role="status" className="text-xs text-muted-purple">Loading recent activity...</p>}
      {error && (
        <div className="flex items-center justify-between gap-3 text-xs text-rose-600" role="alert">
          <span>{error}</span>
          <button type="button" className="font-bold" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && activities.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-purple">
          No recent activity yet. Updates to your tasks, notes, and focus sessions will appear here.
        </p>
      )}
      {!loading && !error && activities.length > 0 && (
        <div className="space-y-3.5">
          {activities.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-center justify-between py-1 px-2 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="text-xs font-semibold text-deep-purple dark:text-lavender-100 truncate">
                    {item.title}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-muted-purple flex-shrink-0 ml-3">
                  {formatRelativeTime(item.occurredAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
