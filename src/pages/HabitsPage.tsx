import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { habitsApi } from '../lib/api/client';
import { Habit } from '../types';
import { Flame, Plus, Check, Calendar, Trophy, Sparkles, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const HabitsPage: React.FC = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Study');
  const [reminderTime, setReminderTime] = useState('09:00');

  const todayStr = formatLocalDate(new Date());

  const fetchHabits = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setHabits(await habitsApi.getHabits());
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load your habits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHabits();
  }, []);

  const handleToggleHabit = async (habitId: string, checked: boolean) => {
    const updated = await habitsApi.toggleHabit(habitId, todayStr, checked);
    setHabits((prev) => prev.map((h) => (h.id === habitId ? updated : h)));

    if (updated.logs[todayStr]) {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#FEF3D6', '#9885E8', '#F7DDED'],
      });
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await habitsApi.createHabit({
      title: title.trim(),
      description,
      category,
      color: '#9885E8',
      iconName: 'Flame',
      reminderTime,
      frequency: 'daily',
    });

    setTitle('');
    setDescription('');
    setIsAddModalOpen(false);
    fetchHabits();
  };

  const handleDeleteHabit = async (id: string) => {
    if (confirm('Delete this habit?')) {
      await habitsApi.deleteHabit(id);
      fetchHabits();
    }
  };

  // Generate 28 trailing days for the heatmap
  const heatmapDays = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return formatLocalDate(d);
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Daily Habit Tracker</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Build unshakeable study and wellness habits. Every consecutive day increases your multiplier!
          </p>
        </div>

        <Button variant="primary" size="sm" pill onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>New Habit</span>
        </Button>
      </div>

      {/* Habits List */}
      <div className="space-y-4">
        {loading && <Card role="status" className="p-5 text-sm text-muted-purple">Loading your habits...</Card>}
        {loadError && (
          <Card role="alert" className="p-5 flex items-center justify-between gap-3 text-sm text-rose-600">
            <span>{loadError}</span>
            <button type="button" className="font-bold text-primary" onClick={() => void fetchHabits()}>
              Retry
            </button>
          </Card>
        )}
        {!loading && !loadError && habits.length === 0 && (
          <Card className="p-6 text-sm text-muted-purple">
            No habits yet. Create a habit to start tracking your routine.
          </Card>
        )}
        {!loading && !loadError && habits.map((habit) => {
          const isDoneToday = !!habit.logs[todayStr];

          return (
            <Card key={habit.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Habit Info & Today Check-in */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Big Check-in Circle */}
                  <button
                    onClick={() => handleToggleHabit(habit.id, !isDoneToday)}
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-95 shadow-sm',
                      isDoneToday
                        ? 'bg-gradient-to-tr from-primary to-soft-lilac border-primary text-white scale-105'
                        : 'bg-white dark:bg-[#1E163B] border-primary/40 text-muted-purple hover:border-primary'
                    )}
                    aria-label={`Toggle habit ${habit.title}`}
                  >
                    {isDoneToday ? (
                      <Check className="w-6 h-6 stroke-[3]" />
                    ) : (
                      <Plus className="w-5 h-5 text-primary" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-deep-purple dark:text-white truncate">
                        {habit.title}
                      </h4>
                      <Badge variant="muted">{habit.category}</Badge>
                    </div>
                    {habit.description && (
                      <p className="text-xs text-muted-purple line-clamp-1 mt-0.5">
                        {habit.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Streak Counters */}
                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-soft-peach dark:bg-amber-950/40 text-soft-peach-text dark:text-amber-300 font-bold text-xs">
                    <Flame className="w-4 h-4 fill-current animate-bounce-subtle" />
                    <span>{habit.streakCount} Day Streak</span>
                  </div>

                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-muted-purple block">Best Streak</span>
                    <span className="text-xs font-bold text-deep-purple dark:text-white">
                      {habit.bestStreak} days 🏆
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="p-2 rounded-xl text-muted-purple hover:bg-rose-50 hover:text-rose-500"
                    aria-label="Delete habit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 28-Day Heatmap Grid */}
              <div className="mt-5 pt-4 border-t border-subtle">
                <div className="flex items-center justify-between mb-2 text-[10px] text-muted-purple">
                  <span>Past 4 Weeks Heatmap:</span>
                  <span className="font-semibold text-primary">
                    {Object.values(habit.logs).filter(Boolean).length} total completions recorded
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {heatmapDays.map((dateStr) => {
                    const completed = !!habit.logs[dateStr];
                    const isToday = dateStr === todayStr;

                    return (
                      <div
                        key={dateStr}
                        title={`${dateStr}: ${completed ? 'Completed ✓' : 'Missed'}`}
                        className={cn(
                          'w-6 h-6 rounded-lg transition-all flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                          completed
                            ? 'bg-primary text-white shadow-2xs'
                            : 'bg-primary-subtle/30 dark:bg-primary/10 text-muted-purple/40',
                          isToday && 'ring-2 ring-primary ring-offset-1'
                        )}
                      >
                        {completed ? '✓' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Habit Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Daily Habit"
        description="Establish positive rituals with streak tracking and gentle reminders."
      >
        <form onSubmit={handleCreateHabit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Habit Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read 20 pages of academic literature 📖"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Description / Intention
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. In morning with green tea"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
              >
                <option value="Study">Study & Focus</option>
                <option value="Coding">Coding & Practice</option>
                <option value="Wellness">Health & Wellness</option>
                <option value="Memory">Memory & Flashcards</option>
                <option value="Mindset">Mindset & Journaling</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Daily Reminder
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
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
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              Create Habit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
