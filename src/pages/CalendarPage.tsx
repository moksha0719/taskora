import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { tasksApi, studyPlansApi } from '../lib/api/client';
import { Task, StudySession } from '../types';
import { cn } from '../lib/utils';

export const CalendarPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState(15);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // New Event State
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('14:00');
  const [eventType, setEventType] = useState<'task' | 'study'>('study');

  useEffect(() => {
    tasksApi.getTasks().then(setTasks);
    studyPlansApi.getPlan().then((plan) => setSessions(plan.sessions));
  }, []);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const monthGrid = Array.from({ length: 35 }, (_, i) => {
    const dayNum = i - 3; // offset
    return {
      day: dayNum > 0 && dayNum <= 31 ? dayNum : dayNum <= 0 ? 30 + dayNum : dayNum - 31,
      isCurrentMonth: dayNum > 0 && dayNum <= 31,
      hasTask: [10, 15, 17, 19, 20, 24].includes(dayNum),
      hasSession: [2, 7, 12, 14, 15, 21].includes(dayNum),
    };
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Schedule & Calendar
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Coordinate upcoming exam deadlines, study sessions, and milestone deliverables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode buttons */}
          <div className="p-1 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle shadow-xs flex items-center">
            {(['month', 'week', 'day'] as const).map((view) => (
              <button
                key={view}
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
        {/* Main Calendar Grid (2 Cols) */}
        <Card className="p-6 lg:col-span-2">
          {/* Navigation Month Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
                May 2026
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-xl border border-subtle hover:bg-primary-subtle text-muted-purple">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="px-3 py-1 rounded-xl text-xs font-bold text-primary bg-primary-subtle">
                Today
              </button>
              <button className="p-2 rounded-xl border border-subtle hover:bg-primary-subtle text-muted-purple">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-subtle">
            {daysOfWeek.map((d) => (
              <span key={d} className="text-xs font-bold text-muted-purple uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Month Cells Grid */}
          <div className="grid grid-cols-7 gap-2 mt-3">
            {monthGrid.map((cell, idx) => {
              const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (cell.isCurrentMonth) setSelectedDay(cell.day);
                  }}
                  className={cn(
                    'h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between',
                    !cell.isCurrentMonth && 'opacity-30 bg-primary-subtle/10 border-transparent',
                    cell.isCurrentMonth && !isSelected && 'bg-white/80 dark:bg-[#1E163B]/60 border-subtle hover:border-primary/40',
                    isSelected && 'border-primary ring-2 ring-primary/30 bg-primary-subtle/20 dark:bg-primary/20'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-bold block',
                      isSelected ? 'text-primary' : 'text-deep-purple dark:text-white'
                    )}
                  >
                    {cell.day}
                  </span>

                  <div className="space-y-1">
                    {cell.hasTask && (
                      <div className="px-1.5 py-0.5 rounded-md bg-soft-pink text-soft-pink-text dark:bg-pink-950/60 dark:text-pink-300 text-[10px] font-semibold truncate">
                        • Task Due
                      </div>
                    )}
                    {cell.hasSession && (
                      <div className="px-1.5 py-0.5 rounded-md bg-mint-accent text-mint-accent-text dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold truncate">
                        • Study Block
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Selected Day Agenda Sidebar */}
        <Card className="p-6 space-y-4">
          <div className="pb-3 border-b border-subtle">
            <span className="text-xs font-bold text-primary uppercase tracking-wider block">
              Agenda For
            </span>
            <h3 className="text-xl font-bold font-heading text-deep-purple dark:text-white">
              Friday, May {selectedDay}, 2026
            </h3>
            <p className="text-xs text-muted-purple mt-0.5">3 items scheduled for today</p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-primary-subtle/30 dark:bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 10:00 - 12:00
                </span>
                <Badge variant="primary">Study Block</Badge>
              </div>
              <h5 className="text-xs font-bold text-deep-purple dark:text-white">
                Distributed Systems (CS 301)
              </h5>
              <p className="text-[11px] text-muted-purple mt-0.5">
                Topic: Raft Consensus & Leader Election
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-soft-pink/30 dark:bg-pink-950/20 border border-pink-200/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-soft-pink-text dark:text-pink-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 17:00 Deadline
                </span>
                <Badge variant="pink">Deliverable</Badge>
              </div>
              <h5 className="text-xs font-bold text-deep-purple dark:text-white">
                Design landing page 🎨
              </h5>
              <p className="text-[11px] text-muted-purple mt-0.5">
                Finalize soft pastel color tokens & bunny hero
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-mint-accent/30 dark:bg-emerald-950/20 border border-mint-accent">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-mint-accent-text dark:text-emerald-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 20:00 - 21:00
                </span>
                <Badge variant="mint">Virtual Room</Badge>
              </div>
              <h5 className="text-xs font-bold text-deep-purple dark:text-white">
                Late Night CS Grind ☕
              </h5>
              <p className="text-[11px] text-muted-purple mt-0.5">
                Synchronized Pomodoro with Alex and Sophia
              </p>
            </div>
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
              <span>Schedule Session for May {selectedDay}</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Add Event Modal */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title="Schedule Study Event or Deadline"
        description="Add a commitment directly to your calendar."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert(`Scheduled: ${eventTitle} at ${eventTime}`);
            setIsEventModalOpen(false);
          }}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Event Title
            </label>
            <input
              type="text"
              required
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
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
                onChange={(e) => setEventType(e.target.value as 'task' | 'study')}
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
                onChange={(e) => setEventTime(e.target.value)}
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
