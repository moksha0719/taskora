import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { Card } from '../common/Card';
import { Task } from '../../types';
import { tasksApi } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

export const StudyChecklistWidget: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await tasksApi.getTasks());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const toggleTask = async (task: Task) => {
    setError(null);
    try {
      const updated = await tasksApi.updateTask(task.id, {
        status: task.status === 'completed' ? 'todo' : 'completed',
      });
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (updated.status === 'completed') {
        confetti({ particleCount: 20, spread: 40, origin: { y: 0.7 } });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this task.');
    }
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newItemTitle.trim();
    if (!title) return;

    setSaving(true);
    setError(null);
    try {
      const task = await tasksApi.createTask({
        title,
        dueDate: '',
        priority: 'medium',
        status: 'todo',
        category: 'General',
        tags: [],
        subtasks: [],
      });
      setTasks((current) => [task, ...current]);
      setNewItemTitle('');
      setIsAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create this task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
          Study Checklist
        </h3>
        <button
          type="button"
          onClick={() => setIsAdding((current) => !current)}
          className="w-7 h-7 rounded-lg bg-primary-subtle text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
          aria-label="Add checklist task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddItem} className="mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemTitle}
              onChange={(event) => setNewItemTitle(event.target.value)}
              placeholder="Task title"
              autoFocus
              className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-primary/30 bg-white dark:bg-[#1E163B] text-deep-purple dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {loading && <p role="status" className="py-4 text-center text-xs text-muted-purple">Loading tasks...</p>}
      {error && (
        <div className="flex items-center justify-between gap-3 py-2 text-xs text-rose-600" role="alert">
          <span>{error}</span>
          <button type="button" className="font-bold" onClick={() => void loadTasks()}>Retry</button>
        </div>
      )}
      {!loading && !error && tasks.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-deep-purple dark:text-white">No tasks yet</p>
          <p className="mt-1 text-xs text-muted-purple">Add a task to start your checklist.</p>
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <div className="space-y-2.5">
          {tasks.slice(0, 5).map((task) => {
            const isDone = task.status === 'completed';
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => void toggleTask(task)}
                aria-pressed={isDone}
                className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-primary-subtle/30 dark:hover:bg-primary/10 transition-colors group"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0',
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1E163B]'
                    )}
                  >
                    {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold truncate transition-colors',
                    isDone ? 'text-muted-purple line-through' : 'text-deep-purple dark:text-lavender-100'
                  )}>
                    {task.title}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-muted-purple flex-shrink-0 ml-2">
                  {isDone ? 'Done' : task.status.replace('_', ' ')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Link to="/tasks" className="block mt-4 text-center text-xs font-bold text-primary hover:underline">
        View all tasks
      </Link>
    </Card>
  );
};
