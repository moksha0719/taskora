import React, { useCallback, useEffect, useState } from 'react';
import { StatCard } from '../components/common/StatCard';
import { ProductivityChart } from '../components/dashboard/ProductivityChart';
import { TodoWidget } from '../components/dashboard/TodoWidget';
import { RecentActivityWidget } from '../components/dashboard/RecentActivityWidget';
import { BunnyMotivationCard } from '../components/dashboard/BunnyMotivationCard';
import { WidgetCustomizeModal } from '../components/dashboard/WidgetCustomizeModal';
import { SemesterCalendarWidget } from '../components/dashboard/SemesterCalendarWidget';
import { PomodoroWidget } from '../components/dashboard/PomodoroWidget';
import { FlashcardWidget } from '../components/dashboard/FlashcardWidget';
import { ExamPrepWidget } from '../components/dashboard/ExamPrepWidget';
import { StudyChecklistWidget } from '../components/dashboard/StudyChecklistWidget';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import {
  CheckSquare,
  Calendar,
  Flag,
  Star,
  SlidersHorizontal,
  Plus,
  Sparkles,
  Layers,
  GraduationCap
} from 'lucide-react';
import { analyticsApi, dashboardApi, tasksApi } from '../lib/api/client';
import { DashboardWidgetConfig, Task, TaskPriority } from '../types';

interface DashboardMetrics {
  completedTasks: number;
  openTasks: number;
  totalTasks: number;
  focusMinutes: number;
}

function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export const DashboardPage: React.FC = () => {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() =>
    dashboardApi.getWidgets()
  );
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadDashboardMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const [tasks, analytics] = await Promise.all([
        tasksApi.getTasks(),
        analyticsApi.getAnalytics('7d'),
      ]);
      const completedTasks = tasks.filter((task: Task) => task.status === 'completed').length;
      setMetrics({
        completedTasks,
        openTasks: tasks.length - completedTasks,
        totalTasks: tasks.length,
        focusMinutes: analytics.focusMinutes,
      });
    } catch (cause) {
      setMetricsError(cause instanceof Error ? cause.message : 'Unable to load dashboard metrics.');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardMetrics();
  }, [loadDashboardMetrics]);

  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Computer Science');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  const isWidgetEnabled = (id: string) => {
    const found = widgets.find((w) => w.id === id);
    return found ? found.enabled : true;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    await tasksApi.createTask({
      title: taskTitle.trim(),
      category: taskCategory,
      priority: taskPriority,
      status: 'todo',
      dueDate: taskDueDate,
      tags: [taskCategory],
      subtasks: [],
    });

    setTaskTitle('');
    setIsCreateTaskModalOpen(false);
    await loadDashboardMetrics();
  };

  return (
    <div className="space-y-7 pb-10 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-bold text-muted-purple tracking-wider uppercase">
          Personal Productivity & Study Hub
        </span>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={() => setIsCustomizeModalOpen(true)}
            className="text-xs bg-white/70 dark:bg-[#1E163B]/70"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>Customize Widgets</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            pill
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="text-xs font-semibold shadow-lavender-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* ========================================================
          SECTION 1: PINTEREST REFERENCE STUDY DASHBOARD BOARD
          Matches the reference layout:
          Row 1: Semester Calendar | Pomodoro Timer | AI Flashcards
          Row 2: Exam Preparation | Study Checklist
          ======================================================== */}
      {isWidgetEnabled('study_reference_grid') && (
        <section className="space-y-6">
          {/* Section banner */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Active Study & Focus Stream</span>
            </h2>
            <span className="text-xs text-muted-purple font-medium">
              Your tasks and study plans
            </span>
          </div>

          {/* Row 1: Calendar (35%) | Pomodoro (30%) | Flashcards (35%) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 md:col-span-1">
              <SemesterCalendarWidget />
            </div>
            <div className="lg:col-span-3 md:col-span-1">
              <PomodoroWidget />
            </div>
            <div className="lg:col-span-4 md:col-span-2">
              <FlashcardWidget />
            </div>
          </div>

          {/* Row 2: Exam Preparation (60%) | Study Checklist (40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <ExamPrepWidget />
            </div>
            <div className="lg:col-span-5">
              <StudyChecklistWidget />
            </div>
          </div>
        </section>
      )}

      {/* Personal productivity metrics */}
      {isWidgetEnabled('stats_overview') && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Performance & Daily Milestones</span>
            </h2>
          </div>

          {metricsError && (
            <div className="flex items-center justify-between gap-3 text-xs text-rose-600" role="alert">
              <span>{metricsError}</span>
              <button type="button" className="font-bold" onClick={() => void loadDashboardMetrics()}>
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard
              title="Completed Tasks"
              value={metricsLoading ? '…' : metrics?.completedTasks ?? '—'}
              subtitle="All-time total"
              icon={CheckSquare}
              variant="purple"
            />
            <StatCard
              title="Open Tasks"
              value={metricsLoading ? '…' : metrics?.openTasks ?? '—'}
              subtitle="Current workload"
              icon={Calendar}
              variant="pink"
            />
            <StatCard
              title="Total Tasks"
              value={metricsLoading ? '…' : metrics?.totalTasks ?? '—'}
              subtitle="In your account"
              icon={Flag}
              variant="mint"
            />
            <StatCard
              title="Focus Time (7d)"
              value={metricsLoading ? '…' : metrics ? formatFocusMinutes(metrics.focusMinutes) : '—'}
              subtitle="Recorded sessions"
              icon={Star}
              variant="peach"
            />
          </div>
        </section>
      )}

      {/* ========================================================
          SECTION 3: PRODUCTIVITY OVERVIEW, ACTIVITY & MASCOT
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Left 2 Cols: Productivity Chart & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {isWidgetEnabled('productivity_chart') && <ProductivityChart />}
          {isWidgetEnabled('recent_activity') && <RecentActivityWidget />}
        </div>

        {/* Right 1 Col: To-Do Widget & Bunny Motivation Card */}
        <div className="space-y-6">
          {isWidgetEnabled('today_tasks') && (
            <TodoWidget onOpenCreateModal={() => setIsCreateTaskModalOpen(true)} />
          )}
          {isWidgetEnabled('bunny_motivation') && <BunnyMotivationCard />}
        </div>
      </div>

      <WidgetCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        onLayoutUpdated={(updated) => setWidgets(updated)}
      />

      {/* Quick Create Task Modal */}
      <Modal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        title="Create New Task"
        description="Add a task to your daily list or assign it to a study subject."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Task Title
            </label>
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Implement Raft heartbeat interval ⏱️"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Category
              </label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="Computer Science">Computer Science</option>
                <option value="Design">Design</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Academics">Academics</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent 🔥</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsCreateTaskModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
