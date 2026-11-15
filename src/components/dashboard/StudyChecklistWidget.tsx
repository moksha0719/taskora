import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Check, Plus, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import confetti from 'canvas-confetti';

interface ChecklistItem {
  id: string;
  title: string;
  status: 'done' | 'pending';
  badge: string;
}

export const StudyChecklistWidget: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: '1',
      title: 'Review Lecture 1–10 Notes',
      status: 'done',
      badge: 'Done',
    },
    {
      id: '2',
      title: 'Complete Trees & Graphs Problems',
      status: 'done',
      badge: 'Done',
    },
    {
      id: '3',
      title: 'Practice DP Problem Set',
      status: 'pending',
      badge: '0 / 15',
    },
    {
      id: '4',
      title: 'Take Mock Exam 1',
      status: 'pending',
      badge: '0 / 1',
    },
    {
      id: '5',
      title: 'Review Mistakes',
      status: 'pending',
      badge: '0 / 1',
    },
  ]);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isNowDone = item.status !== 'done';
          if (isNowDone) {
            confetti({
              particleCount: 20,
              spread: 40,
              origin: { y: 0.7 },
              colors: ['#DDF3E9', '#9885E8', '#F7DDED'],
            });
          }
          return {
            ...item,
            status: isNowDone ? 'done' : 'pending',
            badge: isNowDone ? 'Done' : '0 / 1',
          };
        }
        return item;
      })
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: newItemTitle.trim(),
        status: 'pending',
        badge: '0 / 1',
      },
    ]);
    setNewItemTitle('');
    setIsAdding(false);
  };

  const handleGenerateQuestions = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setItems((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          title: 'Solve AI-Generated Dijkstra & Bellman-Ford quiz',
          status: 'pending',
          badge: '0 / 5',
        },
      ]);
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.8 },
      });
    }, 700);
  };

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        {/* Header matching Pinterest visual */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
            Study Checklist
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="w-7 h-7 rounded-lg bg-primary-subtle text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
            aria-label="Add checklist item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add field */}
        {isAdding && (
          <form onSubmit={handleAddItem} className="mb-3 animate-fade-in">
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="e.g. Solve recursion practice problems"
                autoFocus
                className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-primary/30 bg-white dark:bg-[#1E163B] text-deep-purple dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-xl bg-primary text-white font-semibold"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {/* Checklist items list */}
        <div className="space-y-2.5">
          {items.map((item) => {
            const isDone = item.status === 'done';
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-primary-subtle/30 dark:hover:bg-primary/10 transition-colors cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Rounded square checkbox */}
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0',
                      isDone
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1E163B]'
                    )}
                  >
                    {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <span
                    className={cn(
                      'text-xs font-semibold truncate transition-colors',
                      isDone
                        ? 'text-muted-purple line-through'
                        : 'text-deep-purple dark:text-lavender-100 group-hover:text-primary'
                    )}
                  >
                    {item.title}
                  </span>
                </div>

                {/* Badge matching reference */}
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2',
                    isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-primary-subtle text-primary dark:bg-primary/20 dark:text-lavender-300'
                  )}
                >
                  {item.badge}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Button: + Generate Practice Questions */}
      <button
        onClick={handleGenerateQuestions}
        disabled={isGenerating}
        className="w-full mt-4 py-2 px-3 rounded-2xl bg-primary-subtle/80 hover:bg-primary hover:text-white dark:bg-primary/20 dark:hover:bg-primary text-primary dark:text-lavender-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-primary/20 shadow-xs active:scale-98"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>
          {isGenerating ? 'Generating Questions...' : '+ Generate Practice Questions'}
        </span>
      </button>
    </Card>
  );
};
