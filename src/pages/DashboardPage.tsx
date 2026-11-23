import React, { useState } from 'react';
import { DashboardStatsRow } from '../components/dashboard/DashboardStatsRow';
import { ProductivityChart } from '../components/dashboard/ProductivityChart';
import { TodoWidget } from '../components/dashboard/TodoWidget';
import { RecentActivityWidget } from '../components/dashboard/RecentActivityWidget';
import { BunnyMotivationCard } from '../components/dashboard/BunnyMotivationCard';
import { WidgetCustomizeModal } from '../components/dashboard/WidgetCustomizeModal';
import { SemesterCalendarWidget } from '../components/dashboard/SemesterCalendarWidget';
import { PomodoroWidget } from '../components/dashboard/PomodoroWidget';
import { StudyPlanWidget } from '../components/dashboard/StudyPlanWidget';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import {
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { dashboardApi, tasksApi } from '../lib/api/client';
import { DashboardWidgetConfig, TaskPriority } from '../types';

export const DashboardPage: React.FC = () => {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() =>
    dashboardApi.getWidgets()
  );
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Computer Science');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  const handleLayoutUpdated = (updated: DashboardWidgetConfig[]) => {
    dashboardApi.saveWidgets(updated);
    setWidgets(updated);
  };

  const isWidgetEnabled = (id: string) => widgets.find((widget) => widget.id === id)?.enabled ?? false;

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || isCreatingTask) return;

    setIsCreatingTask(true);
    setCreateTaskError(null);
    try {
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
      setStatsRefreshKey((key) => key + 1);
    } catch (error) {
      setCreateTaskError(error instanceof Error ? error.message : 'Unable to create the task.');
    } finally {
      setIsCreatingTask(false);
    }
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

      {isWidgetEnabled('stats_overview') && (
        <DashboardStatsRow refreshKey={statsRefreshKey} />
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isWidgetEnabled('productivity_chart') && <ProductivityChart />}
        </div>
        <div>
          {isWidgetEnabled('today_tasks') && (
            <TodoWidget
              onOpenCreateModal={() => setIsCreateTaskModalOpen(true)}
              onTasksChanged={() => setStatsRefreshKey((key) => key + 1)}
              refreshKey={statsRefreshKey}
            />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isWidgetEnabled('study_calendar') && <SemesterCalendarWidget />}
        {isWidgetEnabled('focus_timer') && <PomodoroWidget />}
        {isWidgetEnabled('study_plan') && <StudyPlanWidget />}
      </section>

      {(isWidgetEnabled('recent_activity') || isWidgetEnabled('bunny_motivation')) && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {isWidgetEnabled('recent_activity') && (
            <div className="lg:col-span-2">
              <RecentActivityWidget />
            </div>
          )}
          {isWidgetEnabled('bunny_motivation') && <BunnyMotivationCard />}
        </section>
      )}

      <WidgetCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        widgets={widgets}
        onLayoutUpdated={handleLayoutUpdated}
      />

      {/* Quick Create Task Modal */}
      <Modal
        isOpen={isCreateTaskModalOpen}
        onClose={() => {
          setIsCreateTaskModalOpen(false);
          setCreateTaskError(null);
        }}
        title="Create New Task"
        description="Add a task to your daily list or assign it to a study subject."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          {createTaskError && <p role="alert" className="text-xs text-rose-600">{createTaskError}</p>}
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
              onClick={() => {
                setIsCreateTaskModalOpen(false);
                setCreateTaskError(null);
              }}
              disabled={isCreatingTask}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill disabled={isCreatingTask}>
              {isCreatingTask ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
