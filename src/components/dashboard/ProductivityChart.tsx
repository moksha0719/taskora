import React, { useEffect, useState } from 'react';
import { Card } from '../common/Card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi } from '../../lib/api/client';

export const ProductivityChart: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [chartData, setChartData] = useState<Array<{ day: string; focusMinutes: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    analyticsApi.getAnalytics(period === 'week' ? '7d' : '30d')
      .then((summary) => {
        if (!active) return;
        setChartData(Object.entries(summary.focusByDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, focusMinutes]) => ({ day: day.slice(5), focusMinutes })));
      })
      .catch((cause: unknown) => {
        if (active) {
          setChartData([]);
          setError(cause instanceof Error ? cause.message : 'Unable to load productivity data.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period, reloadKey]);

  return (
    <Card className="relative min-w-0 rounded-3xl p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
          Productivity Overview
        </h3>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'week' | 'month')}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-subtle text-deep-purple dark:bg-[#1E163B] dark:text-lavender-200 border border-primary/20 appearance-none pr-7 cursor-pointer focus:outline-none"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <span className="absolute right-2.5 top-2 pointer-events-none text-xs text-muted-purple">
            ⌄
          </span>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full relative overflow-x-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-purple" role="status">
            Loading productivity data...
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-xs text-rose-600" role="alert">
            <p>{error}</p>
            <button type="button" className="font-bold text-primary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-muted-purple">
            No focus sessions recorded for this period.
          </div>
        ) : (
          <>
            <div className="absolute right-12 sm:right-24 top-6 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold shadow-sm backdrop-blur-xs animate-bounce-subtle border border-primary/20">
              <span>Focus minutes</span>
            </div>
            <div className="h-full min-w-[420px] sm:min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9885E8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C7B9F5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="#A99CCB"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E0FA' }}
                  dy={8}
                />
                <YAxis
                  stroke="#A99CCB"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E0FA' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-[#1E163B] p-2.5 rounded-2xl shadow-lavender border border-subtle text-xs">
                          <p className="font-bold text-deep-purple dark:text-white">
                            {payload[0].payload.day}
                          </p>
                          <p className="text-primary font-semibold">
                            Focus time: {payload[0].value} min
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="focusMinutes"
                  stroke="#9885E8"
                  strokeWidth={3.5}
                  fillOpacity={1}
                  fill="url(#productivityGradient)"
                  dot={{ r: 4.5, fill: '#FFFFFF', stroke: '#9885E8', strokeWidth: 2.5 }}
                  activeDot={{ r: 6.5, fill: '#9885E8', stroke: '#FFFFFF', strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
