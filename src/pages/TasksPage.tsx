import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, PriorityBadge, StatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { Task, TaskPriority, TaskStatus, Subtask } from '../types';
import { tasksApi } from '../lib/api/client';
import {
  Plus,
  Search,
  Filter,
  LayoutList,
  Columns3,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  Check,
  Clock,
  Tag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [category, setCategory] = useState('Computer Science');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    const data = await tasksApi.getTasks();
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setStatus('todo');
    setCategory('Computer Science');
    setSubtasks([]);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setStatus(task.status);
    setCategory(task.category);
    setSubtasks(task.subtasks || []);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTask) {
      await tasksApi.updateTask(editingTask.id, {
        title,
        description,
        dueDate,
        priority,
        status,
        category,
        subtasks,
      });
    } else {
      await tasksApi.createTask({
        title,
        description,
        dueDate,
        priority,
        status,
        category,
        tags: [category],
        subtasks,
      });
    }

    setIsModalOpen(false);
    fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Delete this task?')) {
      await tasksApi.deleteTask(id);
      fetchTasks();
    }
  };

  const handleToggleCompleted = async (id: string) => {
    const updated = await tasksApi.toggleTaskCompleted(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));

    if (updated.status === 'completed') {
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.8 },
      });
    }
  };

  const handleBulkComplete = async () => {
    await tasksApi.bulkUpdateStatus(selectedIds, 'completed');
    setSelectedIds([]);
    fetchTasks();
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await tasksApi.deleteTask(id);
    }
    setSelectedIds([]);
    fetchTasks();
  };

  // Filter and sort tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  const boardColumns: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'todo', label: 'To Do', color: 'bg-primary-subtle' },
    { status: 'in_progress', label: 'In Progress', color: 'bg-soft-peach' },
    { status: 'in_review', label: 'In Review', color: 'bg-soft-blue' },
    { status: 'completed', label: 'Completed', color: 'bg-mint-accent' },
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Task Management
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Organize assignments, prioritize deliverables, and track subtask checklists.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* List vs Board Toggle */}
          <div className="p-1 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle shadow-xs flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'list'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-purple hover:text-deep-purple'
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => {
                setViewMode('board');
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className={cn(
                'p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'board'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-purple hover:text-deep-purple'
              )}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          {viewMode === 'list' && (
            <Button
              variant="secondary"
              size="sm"
              pill
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds([]);
              }}
              aria-label={isSelectionMode ? 'Finish selecting tasks' : 'Select tasks'}
            >
              {isSelectionMode ? 'Done' : 'Select'}
            </Button>
          )}

          <Button variant="primary" size="sm" pill onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search tasks, categories, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Design">Design</option>
              <option value="Academics">Academics</option>
              <option value="Productivity">Productivity</option>
              <option value="Personal">Personal</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent 🔥</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar if items selected */}
        {selectedIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-subtle flex items-center justify-between animate-fade-in text-xs">
            <span className="font-semibold text-primary">
              {selectedIds.length} tasks selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" pill onClick={handleBulkComplete}>
                <Check className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </Button>
              <Button size="sm" variant="danger" pill onClick={handleBulkDelete}>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Main Task View */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            title="No tasks found"
            description="No tasks match your current filters. Create a new task or adjust your search keywords."
            actionLabel="Create a Task"
            onAction={openCreateModal}
          />
        </Card>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isSelected = selectedIds.includes(task.id);

            return (
              <Card
                key={task.id}
                className={cn(
                  'p-4 sm:p-5 flex items-center justify-between gap-4 transition-all',
                  isCompleted && 'opacity-70 bg-mint-accent/10 dark:bg-emerald-950/10'
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, task.id]);
                        } else {
                          setSelectedIds(selectedIds.filter((id) => id !== task.id));
                        }
                      }}
                      aria-label={`Select ${task.title}`}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-subtle cursor-pointer"
                    />
                  )}

                  {/* Toggle completion button */}
                  <button
                    onClick={() => handleToggleCompleted(task.id)}
                    className={cn(
                      'w-6 h-6 rounded-lg border flex items-center justify-center transition-all flex-shrink-0',
                      isCompleted
                        ? 'bg-mint-accent border-emerald-400 text-mint-accent-text'
                        : 'border-primary/40 bg-white dark:bg-[#1E163B] hover:border-primary'
                    )}
                    aria-label="Toggle task completion"
                  >
                    {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>

                  <div className="min-w-0">
                    <h4
                      className={cn(
                        'text-sm font-bold text-deep-purple dark:text-white truncate',
                        isCompleted && 'line-through text-muted-purple'
                      )}
                    >
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-muted-purple line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      <Badge variant="muted">
                        <Tag className="w-3 h-3" /> {task.category}
                      </Badge>
                      <span className="text-[11px] text-muted-purple flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Due {task.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-2 rounded-xl text-muted-purple hover:bg-primary-subtle hover:text-primary transition-colors"
                    aria-label="Edit task"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 rounded-xl text-muted-purple hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {boardColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="rounded-3xl bg-surface/50 dark:bg-[#181131]/60 border border-subtle p-4 flex flex-col min-h-[500px]"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-xs font-bold text-deep-purple dark:text-white uppercase tracking-wider">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-subtle text-primary">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {colTasks.map((task) => (
                    <Card
                      key={task.id}
                      className="p-4 hover:border-primary/50 cursor-pointer"
                      onClick={() => openEditModal(task)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-[10px] text-muted-purple">
                          {task.dueDate}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-deep-purple dark:text-white mb-1">
                        {task.title}
                      </h5>
                      {task.description && (
                        <p className="text-[11px] text-muted-purple line-clamp-2 mb-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-subtle text-[11px]">
                        <span className="text-muted-purple">{task.category}</span>
                        {task.subtasks.length > 0 && (
                          <span className="text-primary font-medium">
                            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
        description="Fill in assignment details, subtask checklists, and priority tags."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Write distributed systems report"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, instructions, or criteria..."
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
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
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent 🔥</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Subtasks checklist */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-2">
              Subtasks Checklist ({subtasks.length})
            </label>
            <div className="space-y-2 mb-3">
              {subtasks.map((st, i) => (
                <div key={st.id} className="flex items-center justify-between p-2 rounded-xl bg-primary-subtle/30 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={(e) => {
                        const updated = [...subtasks];
                        updated[i].completed = e.target.checked;
                        setSubtasks(updated);
                      }}
                      className="rounded text-primary"
                    />
                    <span className={st.completed ? 'line-through text-muted-purple' : ''}>
                      {st.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))}
                    className="text-muted-purple hover:text-rose-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-subtle bg-white dark:bg-[#181131]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                pill
                onClick={() => {
                  if (newSubtaskTitle.trim()) {
                    setSubtasks([
                      ...subtasks,
                      { id: `sub_${Date.now()}`, title: newSubtaskTitle.trim(), completed: false },
                    ]);
                    setNewSubtaskTitle('');
                  }
                }}
              >
                Add Subtask
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
