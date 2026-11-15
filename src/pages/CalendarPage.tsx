import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { tasksApi, studyPlansApi } from '../lib/api/client';
import { StudyPlan, Task } from '../types';
import {
  addCalendarDays,
  getCalendarEvents,
  getCalendarGridDates,
  groupCalendarEvents,
  toDateKey,
} from '../lib/calendar';
import { cn } from '../lib/utils';

export const CalendarPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('14:00');
  const [eventType, setEventType] = useState<'task' | 'study'>('study');

  useEffect(() => {
    let active = true;

    Promise.all([tasksApi.getTasks(), studyPlansApi.getPlan()])
      .then(([loadedTasks, loadedPlan]) => {
        if (!active) return;
        setTasks(loadedTasks);
        setStudyPlan(loadedPlan);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load calendar events.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const monthDates = useMemo(() => getCalendarGridDates(currentMonth), [currentMonth]);
  const visibleDates = useMemo(() => {
    if (currentView === 'month') return monthDates;
    if (currentView === 'day') return [selectedDate];
    const weekStart = addCalendarDays(selectedDate, -selectedDate.getDay());
    return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
  }, [currentView, monthDates, selectedDate]);
  const firstVisibleDate = visibleDates[0];
  const lastVisibleDate = visibleDates[visibleDates.length - 1];
  const events = useMemo(
    () => getCalendarEvents(tasks, studyPlan, firstVisibleDate, addCalendarDays(lastVisibleDate, 1)),
    [tasks, studyPlan, firstVisibleDate, lastVisibleDate]
  );
  const eventsByDate = useMemo(() => groupCalendarEvents(events), [events]);
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || [];
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  const navigate = (amount: number) => {
    if (currentView === 'month') {
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1);
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      setCurrentMonth(nextMonth);
      setSelectedDate(new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        Math.min(selectedDate.getDate(), lastDay)
      ));
      return;
    }

    const nextDate = addCalendarDays(selectedDate, amount * (currentView === 'week' ? 7 : 1));
    setSelectedDate(nextDate);
    setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleCreateEvent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventTitle.trim()) return;
    alert(`Scheduled: ${eventTitle} on ${selectedDateKey} at ${eventTime}`);
    setIsEventModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Schedule & Calendar
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Coordinate tasks and study sessions from your Taskora data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-1 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle shadow-xs flex items-center">
            {(['month', 'week', 'day'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setCurrentView(view)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all',
                  currentView === view
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-purple hover:text-deep-purple'
                )}
              >
                {view}
              </button>
            ))}
          </div>

          <Button variant="primary" size="sm" pill onClick={() => setIsEventModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
                {currentView === 'month'
                  ? monthLabel
                  : currentView === 'week'
                    ? `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(firstVisibleDate)} – ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(lastVisibleDate)}`
                    : new Intl.DateTimeFormat(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(selectedDate)}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl border border-subtle hover:bg-primary-subtle text-muted-purple"
                aria-label={`Previous ${currentView}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="px-3 py-1 rounded-xl text-xs font-bold text-primary bg-primary-subtle"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                className="p-2 rounded-xl border border-subtle hover:bg-primary-subtle text-muted-purple"
                aria-label={`Next ${currentView}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentView !== 'day' && (
            <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-subtle">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day} className="text-xs font-bold text-muted-purple uppercase">
                  {day}
                </span>
              ))}
            </div>
          )}

          <div className={cn(
            'grid gap-2 mt-3',
            currentView === 'day' ? 'grid-cols-1' : 'grid-cols-7'
          )}>
            {visibleDates.map((date) => {
              const dateKey = toDateKey(date);
              const isSelected = dateKey === selectedDateKey;
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
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
                    'p-2 rounded-2xl border transition-all cursor-pointer flex flex-col text-left',
                    currentView === 'month' ? 'h-20 sm:h-24 justify-between' : 'min-h-24 justify-start',
                    currentView === 'month' && !isCurrentMonth && 'opacity-40 bg-primary-subtle/10 border-transparent',
                    (currentView !== 'month' || isCurrentMonth) && !isSelected && 'bg-white/80 dark:bg-[#1E163B]/60 border-subtle hover:border-primary/40',
                    isSelected && 'border-primary ring-2 ring-primary/30 bg-primary-subtle/20 dark:bg-primary/20'
                  )}
                >
                  <span className={cn(
                    'text-xs font-bold block',
                    isSelected ? 'text-primary' : 'text-deep-purple dark:text-white'
                  )}>
                    {currentView !== 'month' && (
                      <span className="mr-1">
                        {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)}
                      </span>
                    )}
                    {date.getDate()}
                  </span>

                  <div className="space-y-1 w-full">
                    {dayEvents.slice(0, currentView === 'month' ? 2 : 6).map((calendarEvent) => (
                      <div
                        key={calendarEvent.id}
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate',
                          calendarEvent.type === 'study'
                            ? 'bg-mint-accent text-mint-accent-text dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-soft-pink text-soft-pink-text dark:bg-pink-950/60 dark:text-pink-300'
                        )}
                      >
                        {calendarEvent.time ? `${calendarEvent.time} ` : ''}{calendarEvent.title}
                      </div>
                    ))}
                    {dayEvents.length > (currentView === 'month' ? 2 : 6) && (
                      <span className="text-[10px] text-muted-purple">
                        +{dayEvents.length - (currentView === 'month' ? 2 : 6)} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {isLoading && <p className="text-xs text-muted-purple mt-4">Loading Taskora events...</p>}
          {loadError && <p className="text-xs text-rose-500 mt-4" role="status">{loadError}</p>}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="pb-3 border-b border-subtle">
            <span className="text-xs font-bold text-primary uppercase tracking-wider block">
              Agenda For
            </span>
            <h3 className="text-xl font-bold font-heading text-deep-purple dark:text-white">
              {new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }).format(selectedDate)}
            </h3>
            <p className="text-xs text-muted-purple mt-0.5">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'item' : 'items'} scheduled
            </p>
          </div>

          <div className="space-y-3">
            {selectedDayEvents.map((calendarEvent) => (
              <div
                key={calendarEvent.id}
                className={cn(
                  'p-3.5 rounded-2xl border',
                  calendarEvent.type === 'study'
                    ? 'bg-mint-accent/30 dark:bg-emerald-950/20 border-mint-accent'
                    : 'bg-soft-pink/30 dark:bg-pink-950/20 border-pink-200/60'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {calendarEvent.time
                      ? `${calendarEvent.time}${calendarEvent.endTime ? ` – ${calendarEvent.endTime}` : ''}`
                      : 'Due today'}
                  </span>
                  <Badge variant={calendarEvent.type === 'study' ? 'mint' : 'pink'}>
                    {calendarEvent.type === 'study' ? 'Study session' : 'Task'}
                  </Badge>
                </div>
                <h5 className="text-xs font-bold text-deep-purple dark:text-white">
                  {calendarEvent.title}
                </h5>
                {calendarEvent.details && (
                  <p className="text-[11px] text-muted-purple mt-0.5">{calendarEvent.details}</p>
                )}
              </div>
            ))}
            {!isLoading && !loadError && selectedDayEvents.length === 0 && (
              <p className="text-xs text-muted-purple">Nothing scheduled for this day.</p>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              pill
              className="w-full text-xs"
              onClick={() => setIsEventModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Session for {selectedDate.getDate()}</span>
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title="Schedule Study Event or Deadline"
        description="Add a commitment directly to your calendar."
      >
        <form onSubmit={handleCreateEvent} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Event Title
            </label>
            <input
              type="text"
              required
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="e.g. Discrete Math Homework Sprint"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Type
              </label>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value as 'task' | 'study')}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
              >
                <option value="study">Study Session</option>
                <option value="task">Assignment Deadline</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Time
              </label>
              <input
                type="time"
                value={eventTime}
                onChange={(event) => setEventTime(event.target.value)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsEventModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              Save Event
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
