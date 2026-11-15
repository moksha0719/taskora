import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { studyPlansApi, tasksApi } from '../../lib/api/client';
import {
  addCalendarDays,
  getCalendarEvents,
  getCalendarGridDates,
  groupCalendarEvents,
  toDateKey,
} from '../../lib/calendar';
import { StudyPlan, Task } from '../../types';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load calendar events.';
}

export const SemesterCalendarWidget: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([tasksApi.getTasks(), studyPlansApi.getPlan()])
      .then(([loadedTasks, loadedPlan]) => {
        if (!active) return;
        setTasks(loadedTasks);
        setStudyPlan(loadedPlan);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cells = useMemo(
    () => getCalendarGridDates(currentMonth),
    [currentMonth]
  );
  const gridStart = cells[0];
  const gridEnd = addCalendarDays(gridStart, cells.length);
  const events = useMemo(
    () => getCalendarEvents(tasks, studyPlan, gridStart, gridEnd),
    [tasks, studyPlan, gridStart, gridEnd]
  );
  const eventsByDate = useMemo(() => groupCalendarEvents(events), [events]);

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const todayKey = toDateKey(new Date());

  const changeMonth = (amount: number) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setCurrentMonth(nextMonth);
    setSelectedDate(new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(selectedDate.getDate(), lastDay)
    ));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-subtle dark:bg-primary/20 flex items-center justify-center text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold font-heading text-deep-purple dark:text-white whitespace-nowrap">
              Calendar
            </h3>
          </div>

          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[11px] font-bold text-deep-purple dark:text-white mr-1" aria-live="polite">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-1 rounded-lg text-muted-purple hover:bg-primary-subtle transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="p-1 rounded-lg text-muted-purple hover:bg-primary-subtle transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary-subtle text-primary hover:bg-primary hover:text-white transition-all ml-1"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {WEEKDAYS.map((day) => (
            <span key={day} className="text-[10px] font-bold text-muted-purple tracking-wider">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {cells.map((date) => {
            const dateKey = toDateKey(date);
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isSelected = dateKey === selectedDateKey;
            const dayEvents = eventsByDate.get(dateKey) || [];

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => {
                  setSelectedDate(date);
                  if (!isCurrentMonth) {
                    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  }
                }}
                aria-label={new Intl.DateTimeFormat(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }).format(date)}
                aria-pressed={isSelected}
                className={cn(
                  'h-6 w-6 mx-auto flex flex-col items-center justify-center rounded-full text-[11px] font-semibold relative transition-all duration-150',
                  !isCurrentMonth && 'text-muted-purple/30',
                  isCurrentMonth && !isSelected && 'hover:bg-primary-subtle/60 text-deep-purple dark:text-lavender-100',
                  dateKey === todayKey && !isSelected && 'ring-1 ring-primary/60',
                  isSelected && 'bg-primary text-white font-bold shadow-lavender-sm scale-105'
                )}
              >
                <span>{date.getDate()}</span>
                {dayEvents.length > 0 && !isSelected && (
                  <div className="flex gap-0.5 absolute -bottom-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          event.type === 'study' ? 'bg-[#F97316]' : 'bg-[#8B5CF6]'
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

      <div className="mt-2 pt-2 border-t border-subtle">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-deep-purple dark:text-white">
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }).format(selectedDate)}
          </span>
          <Link
            to="/calendar"
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-purple font-medium">
          <span>
            {isLoading
              ? 'Loading events...'
              : loadError
                ? loadError
                : `${selectedDayEvents.length} ${selectedDayEvents.length === 1 ? 'event' : 'events'}`}
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
              Tasks
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
              Study
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
