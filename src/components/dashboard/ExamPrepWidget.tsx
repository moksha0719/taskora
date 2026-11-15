import React, { useState } from 'react';
import { Card } from '../common/Card';
import { GraduationCap, Sparkles, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface Topic {
  id: string;
  name: string;
  progress: number;
  priority: 'High' | 'Medium' | 'Low';
}

export const ExamPrepWidget: React.FC = () => {
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([
    { id: '1', name: 'Trees & Graphs', progress: 85, priority: 'High' },
    { id: '2', name: 'Dynamic Programming', progress: 65, priority: 'High' },
    { id: '3', name: 'Hash Tables', progress: 45, priority: 'Medium' },
    { id: '4', name: 'Sorting Algorithms', progress: 30, priority: 'Low' },
    { id: '5', name: 'Amortized Analysis', progress: 20, priority: 'Low' },
  ]);

  // Overall preparedness score
  const overallPrepared = Math.round(
    topics.reduce((acc, t) => acc + t.progress, 0) / topics.length
  );

  const priorityStyles = {
    High: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  };

  const handleBumpTopic = (id: string) => {
    setTopics((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, progress: Math.min(100, t.progress + 15) } : t
      )
    );
  };

  return (
    <Card className="p-6">
      {/* Header matching reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-purple uppercase tracking-wider">
                Exam Preparation
              </span>
              <span className="text-[11px] text-blue-500 font-semibold">• 27 days left</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
              Data Structures Final Exam
            </h3>
            <p className="text-xs text-muted-purple">June 10, 2026</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/study-planner')}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-primary-subtle text-primary dark:bg-primary/20 dark:text-lavender-200 text-xs font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5 border border-primary/20 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Study Plan</span>
        </button>
      </div>

      {/* Main Content: Circular Gauge + Topics List */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Circular Gauge */}
        <div className="md:col-span-4 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="8"
                className="dark:stroke-slate-800"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * overallPrepared) / 100}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold font-heading text-deep-purple dark:text-white">
                {overallPrepared}%
              </span>
              <span className="text-[11px] font-semibold text-muted-purple">
                Prepared
              </span>
            </div>
          </div>
        </div>

        {/* AI-Suggested Topics to Focus On */}
        <div className="md:col-span-8 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-purple uppercase tracking-wider mb-1">
            <span>AI-Suggested Topics to Focus On</span>
            <span className="text-[10px] text-muted-purple/70">Click to boost</span>
          </div>

          {topics.map((topic) => (
            <div
              key={topic.id}
              onClick={() => handleBumpTopic(topic.id)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-primary-subtle/30 dark:hover:bg-primary/10 transition-colors cursor-pointer group"
              title="Click to mark revision progress"
            >
              <div className="w-36 sm:w-44 truncate text-xs font-semibold text-deep-purple dark:text-lavender-100 group-hover:text-primary">
                {topic.name}
              </div>

              {/* Progress bar matching reference */}
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 group-hover:bg-primary transition-all duration-300"
                  style={{ width: `${topic.progress}%` }}
                />
              </div>

              {/* Priority badge */}
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[54px] text-center',
                  priorityStyles[topic.priority]
                )}
              >
                {topic.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
