import React, { useState } from 'react';
import { Card } from '../common/Card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { INITIAL_PRODUCTIVITY_SERIES } from '../../lib/mockData';

const MONTH_DATA = [
  { day: 'Week 1', completion: 45 },
  { day: 'Week 2', completion: 60 },
  { day: 'Week 3', completion: 74 },
  { day: 'Week 4', completion: 82 },
];

export const ProductivityChart: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const chartData = period === 'week' ? INITIAL_PRODUCTIVITY_SERIES : MONTH_DATA;

  return (
    <Card className="p-6 relative">
      {/* Header with selector matching reference design */}
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

      {/* Line / Area Chart with Soft Fill */}
      <div className="h-64 sm:h-72 w-full relative">
        {/* "Great job! 🎉" pill marker anchored like in reference image */}
        <div className="absolute right-12 sm:right-24 top-6 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold shadow-sm backdrop-blur-xs animate-bounce-subtle border border-primary/20">
          <span>Great job! 🎉</span>
        </div>

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
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
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
                        Completion: {payload[0].value}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="completion"
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
    </Card>
  );
};
