import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Plus, Check } from 'lucide-react';
import { Task } from '../../types';
import { tasksApi } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

interface TodoWidgetProps {
  onOpenCreateModal?: () => void;
  onTasksChanged?: () => void;
  refreshKey?: number;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({
  onOpenCreateModal,
  onTasksChanged,
  refreshKey = 0,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quickTitle, setQuickTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    tasksApi.getTasks()
      .then((allTasks) => {
        if (active) setTasks(allTasks.slice(0, 5));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your tasks.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleToggle = async (taskId: string) => {
    setError(null);
    try {
      const updated = await tasksApi.toggleTaskCompleted(taskId);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updated : t))
      );
      onTasksChanged?.();

      if (updated.status === 'completed') {
        confetti({
          particleCount: 25,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#9885E8', '#C7B9F5', '#F7DDED', '#DDF3E9'],
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this task.');
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || saving) return;

    setError(null);
    setSaving(true);
    try {
      const newTask = await tasksApi.createTask({
        title: quickTitle.trim(),
        dueDate: new Date().toISOString().split('T')[0],
        priority: 'medium',
        status: 'todo',
        category: 'General',
        tags: ['QuickAdd'],
        subtasks: [],
      });

      setTasks((prev) => [newTask, ...prev.slice(0, 4)]);
      setQuickTitle('');
      setIsAdding(false);
      onTasksChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create this task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-3xl p-6 shadow-sm transition-shadow hover:shadow-md">
      {/* Header matching reference with pink '+' button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
          To-Do List
        </h3>
        <button
          onClick={() => {
            if (onOpenCreateModal) {
              onOpenCreateModal();
            } else {
              setIsAdding(!isAdding);
            }
          }}
          className="w-8 h-8 rounded-xl bg-soft-pink dark:bg-pink-900/40 text-soft-pink-text dark:text-pink-300 flex items-center justify-center hover:scale-105 transition-transform shadow-xs"
          aria-label="Add new task"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Quick Add inline input */}
      {isAdding && (
        <form onSubmit={handleQuickAdd} className="mb-3 animate-fade-in">
          <div className="flex gap-2">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="e.g. Finish reading paper 📚"
              autoFocus
              className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-primary/40 bg-white dark:bg-[#1E163B] text-deep-purple dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={saving}
              className="text-xs px-3 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-3 text-xs text-rose-600" role="alert">{error}</p>}

      {/* Tasks List */}
      <div className="space-y-2.5">
        {loading && <p className="py-4 text-center text-xs text-muted-purple" role="status">Loading tasks...</p>}
        {!loading && !error && tasks.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-purple">No tasks yet. Add a task to get started.</p>
        )}
        {tasks.map((task) => {
          const isDone = task.status === 'completed';
          return (
            <div
              key={task.id}
              onClick={() => handleToggle(task.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border border-transparent select-none',
                isDone
                  ? 'bg-mint-accent/20 dark:bg-emerald-950/20 text-muted-purple line-through'
                  : 'bg-primary-subtle/30 dark:bg-primary/10 hover:bg-primary-subtle/70 text-deep-purple dark:text-lavender-100'
              )}
            >
              {/* Rounded checkbox like reference image */}
              <div
                className={cn(
                  'w-5 h-5 rounded-lg border flex items-center justify-center transition-all',
                  isDone
                    ? 'bg-mint-accent border-emerald-400 text-mint-accent-text'
                    : 'border-primary/40 bg-white dark:bg-[#1E163B]'
                )}
              >
                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>

              <span className="text-xs font-semibold flex-1 truncate">
                {task.title}
              </span>

              {task.priority === 'urgent' && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-subtle" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
