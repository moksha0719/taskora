import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Trophy } from 'lucide-react';
import { Card } from '../common/Card';
import { analyticsApi, focusApi, gamificationApi, tasksApi } from '../../lib/api/client';
import type { Task } from '../../types';

interface DashboardStats {
  completedTasks: number;
  inProgressTasks: number;
  todayFocusMinutes: number;
  weekFocusMinutes: number;
  xpTotal: number;
  level: number;
}

interface DashboardStatsRowProps {
  refreshKey?: number;
}

const statStyles = [
  { icon: CheckCircle2, iconClass: 'bg-[#EDE8FC] text-[#8772E2] dark:bg-primary/20 dark:text-lavender-200' },
  { icon: Activity, iconClass: 'bg-[#F7DDED] text-[#C4679D] dark:bg-pink-900/30 dark:text-pink-300' },
  { icon: Clock3, iconClass: 'bg-[#DDF3E9] text-[#3E9872] dark:bg-emerald-900/30 dark:text-emerald-300' },
  { icon: Trophy, iconClass: 'bg-[#FEF3D6] text-[#D98A16] dark:bg-amber-900/30 dark:text-amber-300' },
];

export const DashboardStatsRow: React.FC<DashboardStatsRowProps> = ({ refreshKey = 0 }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasks, analytics, todaySummary, gamification] = await Promise.all([
        tasksApi.getTasks(),
        analyticsApi.getAnalytics('7d'),
        focusApi.getTodaySummary(),
        gamificationApi.getSummary(),
      ]);
      setStats({
        completedTasks: tasks.filter((task: Task) => task.status === 'completed').length,
        inProgressTasks: tasks.filter((task: Task) => task.status === 'in_progress').length,
        todayFocusMinutes: todaySummary.totalFocusMinutes,
        weekFocusMinutes: analytics.focusMinutes,
        xpTotal: gamification.xpTotal,
        level: gamification.level,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey, retryKey]);

  if (loading) {
    return (
      <section aria-label="Dashboard statistics" role="status">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statStyles.map(({ icon: Icon, iconClass }, index) => (
            <Card key={index} hover={false} className="flex items-center gap-4 rounded-3xl p-4 md:p-6 shadow-sm">
              <span className={`flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl ${iconClass}`}>
                <Icon className="h-6 w-6 opacity-40" />
              </span>
              <span className="space-y-2">
                <span className="block h-3 w-24 animate-pulse rounded bg-primary-subtle" />
                <span className="block h-7 w-16 animate-pulse rounded bg-primary-subtle" />
              </span>
            </Card>
          ))}
        </div>
        <span className="sr-only">Loading dashboard statistics...</span>
      </section>
    );
  }

  if (error || !stats) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/20">
        <span>{error || 'Dashboard statistics are unavailable.'}</span>
        <button
          type="button"
          className="shrink-0 font-bold"
          onClick={() => setRetryKey((key) => key + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  const cards = [
    { title: 'Tasks Completed', value: stats.completedTasks.toLocaleString(), detail: 'All-time total', icon: statStyles[0] },
    { title: 'Tasks In Progress', value: stats.inProgressTasks.toLocaleString(), detail: 'Active tasks', icon: statStyles[1] },
    {
      title: 'Focus Minutes',
      value: `${stats.todayFocusMinutes.toLocaleString()} min`,
      detail: `Today · ${stats.weekFocusMinutes.toLocaleString()} min this week`,
      icon: statStyles[2],
    },
    {
      title: 'XP / Level',
      value: `${stats.xpTotal.toLocaleString()} XP`,
      detail: `Level ${stats.level}`,
      icon: statStyles[3],
    },
  ];

  return (
    <section aria-label="Dashboard statistics">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, detail, icon }) => {
          const Icon = icon.icon;
          return (
            <Card key={title} hover={false} className="group flex items-center gap-4 rounded-3xl p-4 md:p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${icon.iconClass}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-purple">{title}</p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight text-deep-purple dark:text-white">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-purple">{detail}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
