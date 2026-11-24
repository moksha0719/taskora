import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../lib/api/client';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BookOpen, CheckCircle2, Clock, FileText, Flame } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'semester'>('7d');
  const [summary, setSummary] = useState({
    taskCounts: {} as Record<string, number>,
    focusMinutes: 0,
    xpEarned: 0,
    habitCheckIns: 0,
    noteCount: 0,
    focusByDay: {} as Record<string, number>,
    subjectDistribution: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    analyticsApi.getAnalytics(period).then((data) => {
      if (active) setSummary(data);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load analytics.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [period]);

  const hasAnalyticsData =
    Object.values(summary.taskCounts).some((count) => count > 0) ||
    summary.focusMinutes > 0 ||
    summary.habitCheckIns > 0 ||
    summary.noteCount > 0 ||
    summary.xpEarned > 0 ||
    Object.keys(summary.focusByDay).length > 0 ||
    Object.keys(summary.subjectDistribution).length > 0;

  const weekData = Object.entries(summary.focusByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, minutes]) => ({
      day: day.slice(5),
      focusHours: Number((minutes / 60).toFixed(1)),
      tasksDone: summary.taskCounts.COMPLETED || 0,
    }));
  const subjectDistribution = Object.entries(summary.subjectDistribution).map(
    ([name, minutes], index) => ({
      name,
      hours: Number((minutes / 60).toFixed(1)),
      color: ['#9885E8', '#C7B9F5', '#FEF3D6', '#DDF3E9', '#F7DDED'][index % 5],
    })
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Productivity Analytics</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Understand your focus rhythms, task completion rates, and subject distribution across semesters.
          </p>
        </div>

        {/* Period Pills */}
        <div className="p-1 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle shadow-xs flex items-center">
          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'semester', label: 'Semester' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as '7d' | '30d' | 'semester')}
              aria-pressed={period === tab.id}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                period === tab.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-purple hover:text-deep-purple'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <Card role="status" className="p-5 text-sm text-muted-purple">Loading analytics...</Card>}
      {error && <Card role="alert" className="p-5 text-sm text-rose-600">{error}</Card>}
      {!loading && !error && !hasAnalyticsData && (
        <Card className="p-5 text-sm text-muted-purple">No analytics data is available for this period.</Card>
      )}

      {!loading && !error && hasAnalyticsData && (
        <>
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Tasks Completed</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">{summary.taskCounts.COMPLETED || 0}</div>
              <span className="text-xs text-muted-purple">For selected period</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-soft-peach text-soft-peach-text flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Total Focus Hours</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">{(summary.focusMinutes / 60).toFixed(1)}h</div>
              <span className="text-xs text-muted-purple">For selected period</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-soft-pink text-soft-pink-text flex items-center justify-center font-bold">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Habit Consistency</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">{summary.habitCheckIns}</div>
              <span className="text-xs text-muted-purple">Check-ins in selected period</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-soft-blue text-soft-blue-text flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Notes Created</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">{summary.noteCount}</div>
              <span className="text-xs text-muted-purple">For selected period</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-mint-accent text-mint-accent-text flex items-center justify-center font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">XP Earned</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">{summary.xpEarned}</div>
              <span className="text-xs font-semibold text-primary">For selected period</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Focus Hours Trend Area Chart (8 cols) */}
        <Card className="min-w-0 lg:col-span-8 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">
                Daily Focus Time Trend
              </h3>
              <p className="text-xs text-muted-purple">Daily hours dedicated to deep study sessions</p>
            </div>
            <Badge variant="primary">{period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'Semester'}</Badge>
          </div>

          <div className="h-72 w-full overflow-x-auto">
            <div className="h-full min-w-[420px] sm:min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="focusHoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9885E8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C7B9F5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#A99CCB" fontSize={12} tickLine={false} />
                <YAxis stroke="#A99CCB" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="focusHours"
                  stroke="#9885E8"
                  strokeWidth={3}
                  fill="url(#focusHoursGrad)"
                  name="Focus Hours"
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Subject Allocation Pie Chart (4 cols) */}
        <Card className="min-w-0 lg:col-span-4 p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white mb-1">
              Subject Distribution
            </h3>
            <p className="text-xs text-muted-purple mb-4">Time split by academic course</p>

            <div className="h-48 w-full overflow-x-auto">
              <div className="h-full min-w-[320px] sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectDistribution}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {subjectDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-subtle">
            {subjectDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-deep-purple dark:text-white">{item.name}</span>
                </div>
                <span className="text-muted-purple font-semibold">{item.hours}h</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
        </>
      )}
    </div>
  );
};
