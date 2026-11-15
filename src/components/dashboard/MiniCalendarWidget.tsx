import React, { useState } from 'react';
import { Card } from '../common/Card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export const MiniCalendarWidget: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [currentMonth, setCurrentMonth] = useState<string>('May 2026');

  // Days of week header
  const daysOfWeek = [
    { label: 'M', weekend: false },
    { label: 'T', weekend: false },
    { label: 'W', weekend: false },
    { label: 'T', weekend: false },
    { label: 'F', weekend: false },
    { label: 'S', weekend: true },
    { label: 'S', weekend: true },
  ];

  // Calendar dates matching reference visual
  // Previous month trailing: 29, 30
  // Current month: 1..31
  // Next month leading: 1, 2
  const calendarCells = [
    { day: 29, currentMonth: false },
    { day: 30, currentMonth: false },
    { day: 1, currentMonth: true },
    { day: 2, currentMonth: true },
    { day: 3, currentMonth: true },
    { day: 4, currentMonth: true, weekend: true },
    { day: 5, currentMonth: true, weekend: true },
    { day: 6, currentMonth: true },
    { day: 7, currentMonth: true },
    { day: 8, currentMonth: true },
    { day: 9, currentMonth: true },
    { day: 10, currentMonth: true },
    { day: 11, currentMonth: true, weekend: true },
    { day: 12, currentMonth: true, weekend: true },
    { day: 13, currentMonth: true },
    { day: 14, currentMonth: true },
    { day: 15, currentMonth: true, hasEvent: true }, // Highlighted in reference
    { day: 16, currentMonth: true },
    { day: 17, currentMonth: true },
    { day: 18, currentMonth: true, weekend: true },
    { day: 19, currentMonth: true, weekend: true },
    { day: 20, currentMonth: true },
    { day: 21, currentMonth: true },
    { day: 22, currentMonth: true },
    { day: 23, currentMonth: true },
    { day: 24, currentMonth: true },
    { day: 25, currentMonth: true, weekend: true },
    { day: 26, currentMonth: true, weekend: true },
    { day: 27, currentMonth: true },
    { day: 28, currentMonth: true },
    { day: 29, currentMonth: true },
    { day: 30, currentMonth: true },
    { day: 31, currentMonth: true },
    { day: 1, currentMonth: false, weekend: true },
    { day: 2, currentMonth: false, weekend: true },
  ];

  return (
    <Card className="p-6">
      {/* Header matching reference with 'View all' link */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
          Calendar
        </h3>
        <Link
          to="/calendar"
          className="text-xs font-semibold px-3 py-1 rounded-full bg-soft-blue text-soft-blue-text dark:bg-sky-950/40 dark:text-sky-300 hover:scale-105 transition-transform"
        >
          View all
        </Link>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          onClick={() => setCurrentMonth('Apr 2026')}
          className="p-1 rounded-full text-muted-purple hover:bg-primary-subtle"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-deep-purple dark:text-white">
          {currentMonth}
        </span>
        <button
          onClick={() => setCurrentMonth('Jun 2026')}
          className="p-1 rounded-full text-muted-purple hover:bg-primary-subtle"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {daysOfWeek.map((d, i) => (
          <span
            key={i}
            className={cn(
              'text-[11px] font-bold',
              d.weekend ? 'text-rose-400' : 'text-muted-purple'
            )}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarCells.map((cell, idx) => {
          const isSelected = cell.currentMonth && cell.day === selectedDay;
          return (
            <button
              key={idx}
              onClick={() => {
                if (cell.currentMonth) setSelectedDay(cell.day);
              }}
              className={cn(
                'h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-all relative',
                !cell.currentMonth && 'text-muted-purple/40 pointer-events-none',
                cell.currentMonth && !isSelected && 'hover:bg-primary-subtle/50',
                cell.currentMonth && cell.weekend && !isSelected && 'text-rose-400',
                cell.currentMonth && !cell.weekend && !isSelected && 'text-deep-purple dark:text-lavender-100',
                isSelected && 'bg-primary text-white font-bold shadow-lavender-sm scale-105'
              )}
            >
              {cell.day}
              {cell.hasEvent && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
};
