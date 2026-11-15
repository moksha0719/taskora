import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Plus, Check } from 'lucide-react';
import { Task } from '../../types';
import { tasksApi } from '../../lib/api/client';
import { cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

interface TodoWidgetProps {
  onOpenCreateModal?: () => void;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({ onOpenCreateModal }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quickTitle, setQuickTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    tasksApi.getTasks().then((allTasks) => {
      // Prioritize today's tasks
      setTasks(allTasks.slice(0, 5));
    });
  }, []);

  const handleToggle = async (taskId: string) => {
    const updated = await tasksApi.toggleTaskCompleted(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? updated : t))
    );

    if (updated.status === 'completed') {
      confetti({
        particleCount: 25,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#9885E8', '#C7B9F5', '#F7DDED', '#DDF3E9'],
      });
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    const newTask = await tasksApi.createTask({
      userId: 'usr_emily_01',
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
  };

  return (
    <Card className="p-6">
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
              className="text-xs px-3 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Tasks List */}
      <div className="space-y-2.5">
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
