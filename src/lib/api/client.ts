import {
  User, Task, Habit, StudyNote, BrainDumpEntry,
  StudyRoom, Achievement, XPTransaction, NotificationItem,
  ThemeConfig, DashboardWidgetConfig, AdminStats, ModerationReport,
  AuditLogEntry, AIProposal, ChatMessage, FocusSession, ApiStudyPlan,
  StudyPlanInput, StudySchedulePreviewInput, StudySchedulePreviewItem,
  StudyCompletion
} from '../../types';

import {
  INITIAL_TASKS, INITIAL_HABITS,
  INITIAL_NOTES, INITIAL_BRAIN_DUMP,
  INITIAL_ROOMS, INITIAL_ACHIEVEMENTS, INITIAL_XP_TRANSACTIONS,
  INITIAL_NOTIFICATIONS, INITIAL_AI_PROPOSALS, INITIAL_THEME_CONFIG,
  INITIAL_DASHBOARD_WIDGETS, INITIAL_ADMIN_STATS,
  INITIAL_MODERATION_REPORTS, INITIAL_AUDIT_LOGS
} from '../mockData';

// Storage helper with fallback
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`taskora_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`taskora_${key}`, JSON.stringify(value));
  } catch (err) {
    console.error('Storage quota exceeded or error:', err);
  }
}

// Simulated network delay for realistic API behavior
const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'taskora_auth_token';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAuthToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json() as { error?: string } & Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `Request failed with status ${response.status}`,
      response.status
    );
  }
  return body as T;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function toAppUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: 'student',
    avatar: '',
    joinedAt: user.createdAt,
  };
}

function withCachedProfile(user: ApiUser): User {
  const appUser = toAppUser(user);
  const cachedUser = loadFromStorage<User | null>('current_user', null);
  return cachedUser?.id === appUser.id
    ? { ...appUser, ...cachedUser, id: appUser.id, role: 'student' }
    : appUser;
}

// ==========================================
// AUTH API
// ==========================================
export const authApi = {
  async getCurrentUser(): Promise<User | null> {
    if (!getAuthToken()) {
      return null;
    }

    try {
      const { user } = await requestApi<{ user: ApiUser }>('/api/auth/me');
      const currentUser = withCachedProfile(user);
      saveToStorage('current_user', currentUser);
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAuthToken();
        return null;
      }
      throw error;
    }
  },

  async login(email: string, password: string): Promise<User> {
    const { token, user } = await requestApi<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(token);
    const currentUser = withCachedProfile(user);
    saveToStorage('current_user', currentUser);
    return currentUser;
  },

  async register(name: string, email: string, password: string): Promise<string> {
    const { message } = await requestApi<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return message;
  },

  async logout(): Promise<void> {
    clearAuthToken();
    saveToStorage('current_user', null);
  },

  async updateProfile(user: User, updates: Partial<User>): Promise<User> {
    await delay(150);
    const updated = { ...user, ...updates };
    saveToStorage('current_user', updated);
    return updated;
  },
};

// ==========================================
// TASKS API (FR-04, TC02)
// ==========================================
export const tasksApi = {
  async getTasks(): Promise<Task[]> {
    await delay(80);
    return loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
  },

  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    await delay(150);
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
    const newTask: Task = {
      ...taskData,
      id: `tsk_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    saveToStorage('tasks', tasks);
    return newTask;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    await delay(100);
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Task not found');
    const updated = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = updated;
    saveToStorage('tasks', tasks);
    return updated;
  },

  async deleteTask(id: string): Promise<void> {
    await delay(100);
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
    const filtered = tasks.filter((t) => t.id !== id);
    saveToStorage('tasks', filtered);
  },

  async toggleTaskCompleted(id: string): Promise<Task> {
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
    const task = tasks.find((t) => t.id === id);
    if (!task) throw new Error('Task not found');
    const isCompleted = task.status === 'completed';
    return tasksApi.updateTask(id, {
      status: isCompleted ? 'todo' : 'completed',
      completedAt: isCompleted ? undefined : new Date().toISOString(),
    });
  },

  async bulkUpdateStatus(ids: string[], status: Task['status']): Promise<void> {
    await delay(100);
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);
    const updated = tasks.map((t) => (ids.includes(t.id) ? { ...t, status } : t));
    saveToStorage('tasks', updated);
  },
};

// ==========================================
// HABITS API (FR-07, TC06)
// ==========================================
export const habitsApi = {
  async getHabits(): Promise<Habit[]> {
    await delay(80);
    return loadFromStorage<Habit[]>('habits', INITIAL_HABITS);
  },

  async toggleHabit(id: string, dateStr: string): Promise<Habit> {
    await delay(80);
    const habits = loadFromStorage<Habit[]>('habits', INITIAL_HABITS);
    const habit = habits.find((h) => h.id === id);
    if (!habit) throw new Error('Habit not found');

    const currentVal = !!habit.logs[dateStr];
    const newVal = !currentVal;
    habit.logs[dateStr] = newVal;

    if (newVal) {
      habit.streakCount += 1;
      if (habit.streakCount > habit.bestStreak) {
        habit.bestStreak = habit.streakCount;
      }
    } else {
      habit.streakCount = Math.max(0, habit.streakCount - 1);
    }

    saveToStorage('habits', habits);
    return habit;
  },

  async createHabit(habitData: Omit<Habit, 'id' | 'createdAt' | 'streakCount' | 'bestStreak' | 'logs'>): Promise<Habit> {
    await delay(150);
    const habits = loadFromStorage<Habit[]>('habits', INITIAL_HABITS);
    const newHabit: Habit = {
      ...habitData,
      id: `hbt_${Date.now()}`,
      streakCount: 0,
      bestStreak: 0,
      logs: {},
      createdAt: new Date().toISOString().split('T')[0],
    };
    habits.push(newHabit);
    saveToStorage('habits', habits);
    return newHabit;
  },

  async deleteHabit(id: string): Promise<void> {
    await delay(100);
    const habits = loadFromStorage<Habit[]>('habits', INITIAL_HABITS);
    saveToStorage('habits', habits.filter((h) => h.id !== id));
  },
};

// ==========================================
// STUDY PLANNER API (FR-05, TC07)
// ==========================================
export const studyPlansApi = {
  async getPlans(): Promise<ApiStudyPlan[]> {
    const { studyPlans } = await requestApi<{ studyPlans: ApiStudyPlan[] }>('/api/study-plans');
    return studyPlans;
  },

  async getActivePlan(): Promise<ApiStudyPlan | null> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan | null }>('/api/study-plans/active');
    return studyPlan;
  },

  async getPlan(id: string): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(id)}`
    );
    return studyPlan;
  },

  async getCalendarPlans(): Promise<ApiStudyPlan[]> {
    const plans = await this.getPlans();
    return Promise.all(plans.map(({ id }) => this.getPlan(id)));
  },

  async createPlan(input: StudyPlanInput): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>('/api/study-plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return studyPlan;
  },

  async updatePlan(id: string, input: StudyPlanInput): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(input) }
    );
    return studyPlan;
  },

  async deletePlan(id: string): Promise<void> {
    await requestApi<void>(`/api/study-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async generateSchedule(input: StudySchedulePreviewInput): Promise<StudySchedulePreviewItem[]> {
    const { schedule } = await requestApi<{ schedule: StudySchedulePreviewItem[] }>(
      '/api/study-plans/generate',
      { method: 'POST', body: JSON.stringify(input) }
    );
    return schedule;
  },

  async upsertCompletion(
    planId: string,
    itemId: string,
    date: string,
    actualDurationMinutes?: number | null
  ): Promise<StudyCompletion> {
    const { completion } = await requestApi<{ completion: StudyCompletion }>(
      `/api/study-plans/${encodeURIComponent(planId)}/schedule-items/${encodeURIComponent(itemId)}/completions/${encodeURIComponent(date)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ actualDurationMinutes }),
      }
    );
    return completion;
  },

  async deleteCompletion(planId: string, itemId: string, date: string): Promise<void> {
    await requestApi(
      `/api/study-plans/${encodeURIComponent(planId)}/schedule-items/${encodeURIComponent(itemId)}/completions/${encodeURIComponent(date)}`,
      { method: 'DELETE' }
    );
  },
};

// ==========================================
// AI ASSISTANT API (FR-03, TC03, TC04)
// ==========================================
export const aiApi = {
  async getProposals(): Promise<AIProposal[]> {
    await delay(80);
    return loadFromStorage<AIProposal[]>('ai_proposals', INITIAL_AI_PROPOSALS);
  },

  async approveProposal(proposalId: string): Promise<{ proposal: AIProposal; createdTasks: Task[] }> {
    await delay(200);
    const proposals = loadFromStorage<AIProposal[]>('ai_proposals', INITIAL_AI_PROPOSALS);
    const prop = proposals.find((p) => p.id === proposalId);
    if (!prop) throw new Error('Proposal not found');

    prop.status = 'approved';
    prop.appliedAt = new Date().toISOString();
    saveToStorage('ai_proposals', proposals);

    // Commit structured tasks into database
    const createdTasks: Task[] = [];
    const tasks = loadFromStorage<Task[]>('tasks', INITIAL_TASKS);

    for (const item of prop.items) {
      if (item.type === 'task' || item.type === 'study_session') {
        const newTask: Task = {
          id: `tsk_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: 'usr_emily_01',
          title: item.title,
          description: item.description || `Generated by Taskora AI: ${prop.title}`,
          dueDate: item.date || new Date().toISOString().split('T')[0],
          priority: item.priority || 'medium',
          status: 'todo',
          category: item.category || 'Academics',
          tags: ['AI-Plan'],
          subtasks: [],
          estimatedMinutes: item.estimatedMinutes || 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tasks.push(newTask);
        createdTasks.push(newTask);
      }
    }
    saveToStorage('tasks', tasks);
    return { proposal: prop, createdTasks };
  },

  async rejectProposal(proposalId: string): Promise<AIProposal> {
    await delay(100);
    const proposals = loadFromStorage<AIProposal[]>('ai_proposals', INITIAL_AI_PROPOSALS);
    const prop = proposals.find((p) => p.id === proposalId);
    if (!prop) throw new Error('Proposal not found');
    prop.status = 'rejected';
    saveToStorage('ai_proposals', proposals);
    return prop;
  },

  async generateProposal(prompt: string): Promise<AIProposal> {
    await delay(400);
    const proposals = loadFromStorage<AIProposal[]>('ai_proposals', INITIAL_AI_PROPOSALS);
    const newProp: AIProposal = {
      id: `prop_${Date.now()}`,
      type: 'task_breakdown',
      title: `Plan for: "${prompt.slice(0, 35)}..."`,
      description: 'Taskora AI formulated structured action items based on your prompt.',
      status: 'pending',
      suggestedAt: new Date().toISOString(),
      items: [
        {
          id: `item_gen_1`,
          type: 'task',
          title: `Step 1: Outline core objectives for ${prompt.slice(0, 20)}`,
          priority: 'high',
          category: 'Academics',
          date: new Date().toISOString().split('T')[0],
          estimatedMinutes: 45,
        },
        {
          id: `item_gen_2`,
          type: 'task',
          title: 'Step 2: Collect reference materials & verify citations',
          priority: 'medium',
          category: 'Academics',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          estimatedMinutes: 60,
        },
        {
          id: `item_gen_3`,
          type: 'study_session',
          title: 'Step 3: Concentrated 90-min implementation sprint',
          priority: 'urgent',
          category: 'Study',
          date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
          estimatedMinutes: 90,
        },
      ],
    };
    proposals.unshift(newProp);
    saveToStorage('ai_proposals', proposals);
    return newProp;
  },
};

// ==========================================
// BRAIN DUMP API (FR-11, TC08)
// ==========================================
export const brainDumpApi = {
  async getEntries(): Promise<BrainDumpEntry[]> {
    await delay(80);
    return loadFromStorage<BrainDumpEntry[]>('brain_dump', INITIAL_BRAIN_DUMP);
  },

  async addEntry(rawText: string): Promise<BrainDumpEntry> {
    await delay(120);
    const entries = loadFromStorage<BrainDumpEntry[]>('brain_dump', INITIAL_BRAIN_DUMP);
    const newEntry: BrainDumpEntry = {
      id: `bd_${Date.now()}`,
      userId: 'usr_emily_01',
      rawText,
      status: 'raw',
      createdAt: new Date().toISOString(),
    };
    entries.unshift(newEntry);
    saveToStorage('brain_dump', entries);
    return newEntry;
  },

  async convertToProposal(entryId: string): Promise<AIProposal> {
    await delay(350);
    const entries = loadFromStorage<BrainDumpEntry[]>('brain_dump', INITIAL_BRAIN_DUMP);
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Entry not found');

    entry.status = 'organized';
    saveToStorage('brain_dump', entries);

    return aiApi.generateProposal(entry.rawText);
  },
};

// ==========================================
// STUDY WORKSPACE & NOTES API (FR-10)
// ==========================================
export const notesApi = {
  async getNotes(): Promise<StudyNote[]> {
    await delay(80);
    return loadFromStorage<StudyNote[]>('notes', INITIAL_NOTES);
  },

  async saveNote(note: Partial<StudyNote> & { title: string }): Promise<StudyNote> {
    await delay(120);
    const notes = loadFromStorage<StudyNote[]>('notes', INITIAL_NOTES);
    if (note.id) {
      const idx = notes.findIndex((n) => n.id === note.id);
      if (idx !== -1) {
        notes[idx] = { ...notes[idx], ...note, updatedAt: new Date().toISOString() };
        saveToStorage('notes', notes);
        return notes[idx];
      }
    }
    const newNote: StudyNote = {
      id: `note_${Date.now()}`,
      userId: 'usr_emily_01',
      subjectId: note.subjectId || 'sub_general',
      subjectName: note.subjectName || 'General',
      title: note.title,
      content: note.content || '',
      tags: note.tags || ['Study'],
      isPrivate: note.isPrivate ?? true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    saveToStorage('notes', notes);
    return newNote;
  },

  async deleteNote(id: string): Promise<void> {
    await delay(80);
    const notes = loadFromStorage<StudyNote[]>('notes', INITIAL_NOTES);
    saveToStorage('notes', notes.filter((n) => n.id !== id));
  },
};

// ==========================================
// FOCUS MODE API (FR-06, TC05)
// ==========================================
export const focusApi = {
  async logSession(subject: string, durationMinutes: number, notes?: string): Promise<FocusSession> {
    await delay(100);
    const xpEarned = Math.round(durationMinutes * 2.5);
    const session: FocusSession = {
      id: `fcs_${Date.now()}`,
      userId: 'usr_emily_01',
      subject,
      durationMinutes,
      completedAt: new Date().toISOString(),
      notes,
      xpEarned,
    };
    const sessions = loadFromStorage<FocusSession[]>('focus_sessions', []);
    sessions.unshift(session);
    saveToStorage('focus_sessions', sessions);

    // Award XP
    gamificationApi.addXP(xpEarned, `Focus Session: ${durationMinutes} min in ${subject}`, 'focus_session');
    return session;
  },

  async getSessions(): Promise<FocusSession[]> {
    await delay(50);
    return loadFromStorage<FocusSession[]>('focus_sessions', [
      {
        id: 'fcs_yesterday',
        userId: 'usr_emily_01',
        subject: 'Distributed Systems',
        durationMinutes: 45,
        completedAt: new Date(Date.now() - 86400000).toISOString(),
        xpEarned: 110,
      },
    ]);
  },
};

// ==========================================
// STUDY ROOMS API (FR-12, TC10)
// ==========================================
export const roomsApi = {
  async getRooms(): Promise<StudyRoom[]> {
    await delay(80);
    return loadFromStorage<StudyRoom[]>('study_rooms', INITIAL_ROOMS);
  },

  async createRoom(data: Partial<StudyRoom>): Promise<StudyRoom> {
    await delay(150);
    const rooms = loadFromStorage<StudyRoom[]>('study_rooms', INITIAL_ROOMS);
    const newRoom: StudyRoom = {
      id: `room_${Date.now()}`,
      name: data.name || 'New Study Lounge',
      topic: data.topic || 'General Productivity',
      isPrivate: data.isPrivate || false,
      passcode: data.passcode,
      maxParticipants: data.maxParticipants || 8,
      participants: [
        {
          id: 'usr_emily_01',
          name: 'Emily Watson',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80',
          status: 'focusing',
          joinedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      messages: [],
      focusDurationMinutes: 25,
      breakDurationMinutes: 5,
      currentMode: 'focus',
      timerRemainingSeconds: 1500,
      createdAt: new Date().toISOString(),
    };
    rooms.unshift(newRoom);
    saveToStorage('study_rooms', rooms);
    return newRoom;
  },

  async postMessage(roomId: string, content: string): Promise<void> {
    await delay(80);
    const rooms = loadFromStorage<StudyRoom[]>('study_rooms', INITIAL_ROOMS);
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      room.messages.push({
        id: `msg_${Date.now()}`,
        userId: 'usr_emily_01',
        userName: 'Emily Watson',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80',
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      saveToStorage('study_rooms', rooms);
    }
  },
};

// ==========================================
// GAMIFICATION API (FR-09, TC09)
// ==========================================
export const gamificationApi = {
  async getAchievements(): Promise<Achievement[]> {
    await delay(50);
    return loadFromStorage<Achievement[]>('achievements', INITIAL_ACHIEVEMENTS);
  },

  async getXPTransactions(): Promise<XPTransaction[]> {
    await delay(50);
    return loadFromStorage<XPTransaction[]>('xp_txs', INITIAL_XP_TRANSACTIONS);
  },

  async addXP(amount: number, reason: string, source: XPTransaction['source']): Promise<void> {
    const txs = loadFromStorage<XPTransaction[]>('xp_txs', INITIAL_XP_TRANSACTIONS);
    txs.unshift({
      id: `xp_${Date.now()}`,
      amount,
      reason,
      source,
      timestamp: new Date().toISOString(),
    });
    saveToStorage('xp_txs', txs);
  },
};

// ==========================================
// THEME & DASHBOARD PERSONALIZATION (FR-17, 18, 19, 20)
// ==========================================
export const themeApi = {
  getThemeConfig(): ThemeConfig {
    return loadFromStorage<ThemeConfig>('theme_config', INITIAL_THEME_CONFIG);
  },

  saveThemeConfig(config: ThemeConfig): void {
    saveToStorage('theme_config', config);
  },

  resetTheme(): ThemeConfig {
    saveToStorage('theme_config', INITIAL_THEME_CONFIG);
    return INITIAL_THEME_CONFIG;
  },
};

export const dashboardApi = {
  getWidgets(): DashboardWidgetConfig[] {
    return loadFromStorage<DashboardWidgetConfig[]>('dashboard_widgets', INITIAL_DASHBOARD_WIDGETS);
  },

  saveWidgets(widgets: DashboardWidgetConfig[]): void {
    saveToStorage('dashboard_widgets', widgets);
  },
};

// ==========================================
// NOTIFICATIONS API (FR-13)
// ==========================================
export const notificationsApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    await delay(50);
    return loadFromStorage<NotificationItem[]>('notifications', INITIAL_NOTIFICATIONS);
  },

  async markRead(id: string): Promise<void> {
    const notifs = loadFromStorage<NotificationItem[]>('notifications', INITIAL_NOTIFICATIONS);
    const n = notifs.find((item) => item.id === id);
    if (n) n.read = true;
    saveToStorage('notifications', notifs);
  },

  async markAllRead(): Promise<void> {
    const notifs = loadFromStorage<NotificationItem[]>('notifications', INITIAL_NOTIFICATIONS);
    notifs.forEach((n) => (n.read = true));
    saveToStorage('notifications', notifs);
  },
};

// ==========================================
// ADMIN API (FR-16)
// ==========================================
export const adminApi = {
  async getStats(): Promise<AdminStats> {
    await delay(100);
    return loadFromStorage<AdminStats>('admin_stats', INITIAL_ADMIN_STATS);
  },

  async getReports(): Promise<ModerationReport[]> {
    await delay(100);
    return loadFromStorage<ModerationReport[]>('moderation_reports', INITIAL_MODERATION_REPORTS);
  },

  async resolveReport(id: string, action: 'resolved' | 'dismissed'): Promise<void> {
    await delay(100);
    const reports = loadFromStorage<ModerationReport[]>('moderation_reports', INITIAL_MODERATION_REPORTS);
    const rep = reports.find((r) => r.id === id);
    if (rep) rep.status = action;
    saveToStorage('moderation_reports', reports);
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    await delay(100);
    return loadFromStorage<AuditLogEntry[]>('audit_logs', INITIAL_AUDIT_LOGS);
  },
};
