import React, { useState } from 'react';
import { Card } from '../common/Card';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface CalendarEvent {
  day: number;
  type: 'exam' | 'assignment' | 'quiz' | 'project' | 'other';
  title: string;
}

export const SemesterCalendarWidget: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(14);
  const [currentMonth, setCurrentMonth] = useState<string>('May 2026');

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Events mapped across days of May 2026
  const events: CalendarEvent[] = [
    { day: 3, type: 'quiz', title: 'Calculus Quiz 2' },
    { day: 6, type: 'other', title: 'Faculty Office Hours' },
    { day: 8, type: 'assignment', title: 'Data Structures HW 4' },
    { day: 12, type: 'project', title: 'HCI Prototype Checkpoint' },
    { day: 14, type: 'assignment', title: 'Distributed Systems Raft Lab' },
    { day: 17, type: 'quiz', title: 'Discrete Math Pop Quiz' },
    { day: 19, type: 'exam', title: 'Midterm 2 - Computer Architecture' },
    { day: 22, type: 'assignment', title: 'Algorithms Problem Set 5' },
    { day: 24, type: 'other', title: 'Hackathon Info Session' },
    { day: 26, type: 'exam', title: 'Final Project Demo' },
    { day: 28, type: 'project', title: 'Final Report Submission' },
    { day: 31, type: 'other', title: 'End of Semester Mixer' },
  ];

  // Calendar cells: 3 trailing April, 31 May, 1 June
  const cells = [
    { day: 28, current: false },
    { day: 29, current: false },
    { day: 30, current: false },
    ...Array.from({ length: 31 }, (_, i) => ({ day: i + 1, current: true })),
    { day: 1, current: false },
  ];

  const getDayEvents = (day: number) => events.filter((e) => e.day === day);

  const selectedDayEvents = getDayEvents(selectedDay);

  const eventDotColors: Record<string, string> = {
    exam: 'bg-[#EF4444]',         // red
    assignment: 'bg-[#8B5CF6]',   // purple
    quiz: 'bg-[#3B82F6]',         // blue
    project: 'bg-[#F97316]',      // orange
    other: 'bg-[#10B981]',        // green
  };

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        {/* Header matching Pinterest reference */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-subtle dark:bg-primary/20 flex items-center justify-center text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
              Semester Calendar
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-deep-purple dark:text-white mr-1">
              {currentMonth}
            </span>
            <button
              onClick={() => setCurrentMonth(currentMonth === 'May 2026' ? 'Apr 2026' : 'May 2026')}
              className="p-1 rounded-lg text-muted-purple hover:bg-primary-subtle transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(currentMonth === 'May 2026' ? 'Jun 2026' : 'May 2026')}
              className="p-1 rounded-lg text-muted-purple hover:bg-primary-subtle transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedDay(14);
                setCurrentMonth('May 2026');
              }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-subtle text-primary hover:bg-primary hover:text-white transition-all ml-1"
            >
              Today
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {daysOfWeek.map((day, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold text-muted-purple tracking-wider"
            >
              {day}
            </span>
          ))}
        </div>

        {/* Date cells grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {cells.map((cell, idx) => {
            const isSelected = cell.current && cell.day === selectedDay;
            const dayEvts = cell.current ? getDayEvents(cell.day) : [];

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (cell.current) setSelectedDay(cell.day);
                }}
                className={cn(
                  'h-8 w-8 sm:h-9 sm:w-9 mx-auto flex flex-col items-center justify-center rounded-full text-xs font-semibold relative transition-all duration-150',
                  !cell.current && 'text-muted-purple/30 pointer-events-none',
                  cell.current && !isSelected && 'hover:bg-primary-subtle/60 text-deep-purple dark:text-lavender-100',
                  isSelected && 'bg-primary text-white font-bold shadow-lavender-sm scale-105'
                )}
              >
                <span>{cell.day}</span>
                {/* Event dots under date */}
                {dayEvts.length > 0 && !isSelected && (
                  <div className="flex gap-0.5 absolute -bottom-0.5">
                    {dayEvts.slice(0, 3).map((evt, eIdx) => (
                      <span
                        key={eIdx}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          eventDotColors[evt.type] || 'bg-primary'
                        )}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day summary preview if has event */}
      {selectedDayEvents.length > 0 && (
        <div className="mt-3 p-2.5 rounded-2xl bg-primary-subtle/40 dark:bg-[#1E163B] border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                eventDotColors[selectedDayEvents[0].type]
              )}
            />
            <span className="text-xs font-semibold text-deep-purple dark:text-white truncate">
              {selectedDayEvents[0].title}
            </span>
          </div>
          <Link
            to="/calendar"
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 flex-shrink-0"
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Legend below matching reference exactly */}
      <div className="mt-4 pt-3 border-t border-subtle flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-purple font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span>Exams</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
          <span>Assignments</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
          <span>Quizzes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#F97316]" />
          <span>Projects</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Other</span>
        </div>
      </div>
    </Card>
  );
};
