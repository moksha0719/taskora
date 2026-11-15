import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CheckCircle2, Clock, Flame, TrendingUp, Calendar, Trophy } from 'lucide-react';

const WEEK_DATA = [
  { day: 'Mon', focusHours: 2.5, tasksDone: 4 },
  { day: 'Tue', focusHours: 3.2, tasksDone: 6 },
  { day: 'Wed', focusHours: 4.0, tasksDone: 7 },
  { day: 'Thu', focusHours: 2.0, tasksDone: 3 },
  { day: 'Fri', focusHours: 4.5, tasksDone: 8 },
  { day: 'Sat', focusHours: 3.0, tasksDone: 5 },
  { day: 'Sun', focusHours: 3.8, tasksDone: 6 },
];

const SUBJECT_DISTRIBUTION = [
  { name: 'Distributed Systems', hours: 14, color: '#9885E8' },
  { name: 'Interaction Design', hours: 9, color: '#C7B9F5' },
  { name: 'Discrete Math', hours: 7, color: '#FEF3D6' },
  { name: 'General Reading', hours: 4, color: '#DDF3E9' },
];

export const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'semester'>('7d');

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>Productivity Analytics</span>
            <Badge variant="mint">FR-08 Verified</Badge>
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

      {/* 4 Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Tasks Completed</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">39</div>
              <span className="text-xs font-semibold text-emerald-600">+14% vs last week</span>
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
              <div className="text-2xl font-bold text-deep-purple dark:text-white">24.2h</div>
              <span className="text-xs font-semibold text-amber-600">Avg 3.4h / day</span>
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
              <div className="text-2xl font-bold text-deep-purple dark:text-white">92%</div>
              <span className="text-xs font-semibold text-rose-500">14-day streak 🔥</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-mint-accent text-mint-accent-text flex items-center justify-center font-bold">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Scholar XP Gained</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">1,450</div>
              <span className="text-xs font-semibold text-primary">Level 5 Scholar</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Focus Hours Trend Area Chart (8 cols) */}
        <Card className="lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">
                Focus Time & Tasks Completion Trend
              </h3>
              <p className="text-xs text-muted-purple">Daily hours dedicated to deep study sessions</p>
            </div>
            <Badge variant="primary">Weekly Sync</Badge>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEK_DATA}>
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
        </Card>

        {/* Subject Allocation Pie Chart (4 cols) */}
        <Card className="lg:col-span-4 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white mb-1">
              Subject Distribution
            </h3>
            <p className="text-xs text-muted-purple mb-4">Time split by academic course</p>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SUBJECT_DISTRIBUTION}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {SUBJECT_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-subtle">
            {SUBJECT_DISTRIBUTION.map((item) => (
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
    </div>
  );
};
