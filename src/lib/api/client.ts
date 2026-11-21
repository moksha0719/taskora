import {
  User, Task, TaskPriority, TaskStatus, Habit, StudyNote, BrainDumpEntry,
  StudyRoom, Achievement, XPTransaction, NotificationItem,
  ThemeConfig, DashboardWidgetConfig, AdminStats, ModerationReport,
  AuditLogEntry, AIProposal, ChatMessage, FocusSession, ApiStudyPlan,
  StudyPlanInput, StudySchedulePreviewInput, StudySchedulePreviewItem,
  StudyCompletion, Flashcard, FlashcardDeck
} from '../../types';

import { DEFAULT_DASHBOARD_WIDGETS, DEFAULT_THEME_CONFIG } from '../defaults';

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const PROFILE_PHOTO_PATH_PREFIX = '/uploads/profile-photos/';
const AUTH_TOKEN_KEY = 'taskora_auth_token';
const AI_CONVERSATION_ID_KEY = 'taskora_ai_conversation_id';
export const STUDY_PLANS_UPDATED_EVENT = 'taskora:study-plans-updated';

function notifyStudyPlansUpdated(): void {
  window.dispatchEvent(new Event(STUDY_PLANS_UPDATED_EVENT));
}

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

function getAiConversationId(): string | null {
  return sessionStorage.getItem(AI_CONVERSATION_ID_KEY);
}

function setAiConversationId(conversationId: string): void {
  sessionStorage.setItem(AI_CONVERSATION_ID_KEY, conversationId);
}

function clearAiConversationId(): void {
  sessionStorage.removeItem(AI_CONVERSATION_ID_KEY);
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

  const responseText = await response.text();
  let body: { error?: string } & Record<string, unknown>;
  try {
    body = JSON.parse(responseText) as { error?: string } & Record<string, unknown>;
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    const responseType = response.ok
      ? 'The API returned a non-JSON response.'
      : `The API returned a non-JSON error response (HTTP ${response.status}).`;
    throw new ApiError(
      `${responseType} Check VITE_API_BASE_URL and verify that the backend endpoint is available.`,
      response.status
    );
  }

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
  role?: 'STUDENT' | 'ADMIN';
  avatar?: string | null;
  bio?: string | null;
  major?: string | null;
  createdAt: string;
}

interface ApiTask {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  subtasks: Task['subtasks'];
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const API_STATUS: Record<TaskStatus, 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'> = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_REVIEW',
  completed: 'COMPLETED',
};

const API_PRIORITY: Record<TaskPriority, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  urgent: 'HIGH',
};

function toAppTask(task: ApiTask): Task {
  const status =
    task.status === 'COMPLETED'
      ? 'completed'
      : task.status === 'IN_PROGRESS'
        ? 'in_progress'
        : task.status === 'IN_REVIEW'
          ? 'in_review'
        : 'todo';
  const priority =
    task.priority === 'HIGH'
      ? 'high'
      : task.priority === 'LOW'
        ? 'low'
        : 'medium';
  return {
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description || undefined,
    category: task.category,
    tags: task.tags,
    subtasks: task.subtasks,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    priority,
    status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function toApiTaskInput(taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
  const input: Record<string, unknown> = {
    title: taskData.title,
    priority: API_PRIORITY[taskData.priority],
    category: taskData.category,
    tags: taskData.tags,
    subtasks: taskData.subtasks,
  };
  if (taskData.description) input.description = taskData.description;
  if (taskData.dueDate) input.dueDate = taskData.dueDate;
  if (taskData.status) input.status = API_STATUS[taskData.status];
  return input;
}

function toAppUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'ADMIN' ? 'admin' : 'student',
    avatar: resolveAvatarUrl(user.avatar),
    bio: user.bio || undefined,
    major: user.major || undefined,
    joinedAt: user.createdAt,
  };
}

function resolveAvatarUrl(avatar?: string | null): string {
  if (!avatar) return '';
  return avatar.startsWith(PROFILE_PHOTO_PATH_PREFIX)
    ? `${API_BASE_URL}${avatar}`
    : avatar;
}

function withCachedProfile(user: ApiUser): User {
  const appUser = toAppUser(user);
  const cachedUser = loadFromStorage<User | null>('current_user', null);
  return cachedUser?.id === appUser.id
    ? { ...appUser, ...cachedUser, id: appUser.id, avatar: appUser.avatar }
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
        clearAiConversationId();
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
    clearAiConversationId();
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
    clearAiConversationId();
    saveToStorage('current_user', null);
  },

  async updateProfile(user: User, updates: Partial<User>): Promise<User> {
    const { user: apiUser } = await requestApi<{ user: ApiUser }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        avatar: updates.avatar,
        bio: updates.bio,
        major: updates.major,
      }),
    });
    const updated = withCachedProfile(apiUser);
    saveToStorage('current_user', updated);
    return updated;
  },

  async uploadProfilePhoto(file: File): Promise<User> {
    const { user } = await requestApi<{ user: ApiUser }>('/api/auth/profile/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const currentUser = withCachedProfile(user);
    saveToStorage('current_user', currentUser);
    return currentUser;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await requestApi<{ message: string }>('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async deleteAccount(): Promise<void> {
    await requestApi<void>('/api/auth/account', { method: 'DELETE' });
    clearAuthToken();
    clearAiConversationId();
    saveToStorage('current_user', null);
  },

  async forgotPassword(email: string): Promise<string> {
    const { message } = await requestApi<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return message;
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const { message } = await requestApi<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    return message;
  },
};

// ==========================================
// TASKS API (TC02)
// ==========================================
export const tasksApi = {
  async getTasks(): Promise<Task[]> {
    const { tasks } = await requestApi<{ tasks: ApiTask[] }>('/api/tasks');
    return tasks.map(toAppTask);
  },

  async createTask(taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const { task } = await requestApi<{ task: ApiTask }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(toApiTaskInput(taskData)),
    });
    return toAppTask(task);
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.description !== undefined) body.description = updates.description.trim() || null;
    if (updates.dueDate !== undefined) body.dueDate = updates.dueDate || null;
    if (updates.priority !== undefined) body.priority = API_PRIORITY[updates.priority];
    if (updates.status !== undefined) body.status = API_STATUS[updates.status];
    const { task } = await requestApi<{ task: ApiTask }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return toAppTask(task);
  },

  async deleteTask(id: string): Promise<void> {
    await requestApi<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async toggleTaskCompleted(id: string): Promise<Task> {
    const existing = await tasksApi.getTasks();
    const task = existing.find((item) => item.id === id);
    if (!task) throw new Error('Task not found');
    return tasksApi.updateTask(id, { status: task.status === 'completed' ? 'todo' : 'completed' });
  },

  async bulkUpdateStatus(ids: string[], status: Task['status']): Promise<void> {
    await Promise.all(ids.map((id) => tasksApi.updateTask(id, { status })));
  },
};

// ==========================================
// HABITS API (TC06)
// ==========================================
export const habitsApi = {
  async getHabits(): Promise<Habit[]> {
    const { habits } = await requestApi<{ habits: Array<{
      id: string; userId: string; title: string; description: string | null; category: string; color: string;
      iconName: string; frequency: string; reminderTime: string | null; createdAt: string; checkIns: Array<{ date: string }>;
    }> }>('/api/habits');
    return habits.map((habit) => ({
      id: habit.id,
      userId: habit.userId,
      title: habit.title,
      description: habit.description || undefined,
      category: habit.category,
      color: habit.color,
      iconName: habit.iconName,
      streakCount: habit.checkIns.length,
      bestStreak: habit.checkIns.length,
      logs: Object.fromEntries(habit.checkIns.map((checkIn) => [checkIn.date.slice(0, 10), true])),
      reminderTime: habit.reminderTime || undefined,
      frequency: habit.frequency as Habit['frequency'],
      createdAt: habit.createdAt,
    }));
  },

  async toggleHabit(id: string, dateStr: string, checked: boolean): Promise<Habit> {
    await requestApi<{ checked: boolean }>(`/api/habits/${encodeURIComponent(id)}/check-ins`, {
      method: 'PUT',
      body: JSON.stringify({ date: dateStr, checked }),
    });
    const habits = await habitsApi.getHabits();
    const updated = habits.find((habit) => habit.id === id);
    if (!updated) throw new Error('Habit not found');
    return updated;
  },

  async createHabit(habitData: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'streakCount' | 'bestStreak' | 'logs'>): Promise<Habit> {
    await requestApi<{ habit: unknown }>('/api/habits', {
      method: 'POST',
      body: JSON.stringify(habitData),
    });
    const habits = await habitsApi.getHabits();
    return habits[0];
  },

  async deleteHabit(id: string): Promise<void> {
    await requestApi<void>(`/api/habits/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

// ==========================================
// STUDY PLANNER API (TC07)
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

  async getCompletions(planId: string, from: string, to: string): Promise<StudyCompletion[]> {
    const query = new URLSearchParams({ from, to });
    const { completions } = await requestApi<{ completions: StudyCompletion[] }>(
      `/api/study-plans/${encodeURIComponent(planId)}/completions?${query}`
    );
    return completions;
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
    notifyStudyPlansUpdated();
    return studyPlan;
  },

  async updatePlan(id: string, input: StudyPlanInput): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(input) }
    );
    notifyStudyPlansUpdated();
    return studyPlan;
  },

  async deletePlan(id: string): Promise<void> {
    await requestApi<void>(`/api/study-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    notifyStudyPlansUpdated();
  },

  async activatePlan(id: string): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(id)}/activate`,
      { method: 'POST' }
    );
    notifyStudyPlansUpdated();
    return studyPlan;
  },

  async deactivatePlan(id: string): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(id)}/deactivate`,
      { method: 'POST' }
    );
    notifyStudyPlansUpdated();
    return studyPlan;
  },

  async generateSchedule(input: StudySchedulePreviewInput): Promise<StudySchedulePreviewItem[]> {
    const { schedule } = await requestApi<{ schedule: StudySchedulePreviewItem[] }>(
      '/api/study-plans/generate',
      { method: 'POST', body: JSON.stringify(input) }
    );
    return schedule;
  },

  async saveSchedule(planId: string, schedule: StudySchedulePreviewItem[]): Promise<ApiStudyPlan> {
    const { studyPlan } = await requestApi<{ studyPlan: ApiStudyPlan }>(
      `/api/study-plans/${encodeURIComponent(planId)}/schedule`,
      { method: 'PUT', body: JSON.stringify({ schedule }) }
    );
    notifyStudyPlansUpdated();
    return studyPlan;
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
// AI ASSISTANT API (TC03, TC04)
// ==========================================
export interface AIConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

async function fetchAIConversations(): Promise<AIConversationSummary[]> {
  const { conversations } = await requestApi<{ conversations: AIConversationSummary[] }>(
    '/api/ai/conversations'
  );
  return conversations;
}

function mapBackendProposal(
  proposal: { id: string; payload?: { title?: string; description?: string; priority?: string; dueDate?: string }; title?: string; description?: string | null; priority?: string; dueDate?: string | null; status: string; createdAt: string },
  source: 'assistant' | 'brain_dump' = 'assistant'
): AIProposal {
  const payload = proposal.payload || {};
  const title = payload.title || proposal.title || 'AI proposed task';
  const priority = (payload.priority || proposal.priority || 'MEDIUM').toLowerCase();
  const normalizedPriority: TaskPriority =
    priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium';
  const status =
    proposal.status === 'APPROVED'
      ? 'approved'
      : proposal.status === 'REJECTED'
        ? 'rejected'
        : proposal.status === 'EXPIRED'
          ? 'expired'
          : 'pending';
  return {
    id: proposal.id,
    type: source === 'brain_dump' ? 'brain_dump_conversion' : 'task_breakdown',
    title: source === 'brain_dump' ? 'Organized Brain Dump tasks' : 'AI task breakdown',
    description: payload.description || proposal.description || 'Review this proposed task before applying it.',
    status,
    items: [{
      id: `${proposal.id}:task`,
      type: 'task',
      title,
      description: payload.description || proposal.description || undefined,
      date: payload.dueDate || proposal.dueDate || undefined,
      priority: normalizedPriority,
    }],
    suggestedAt: proposal.createdAt,
  };
}

export const aiApi = {
  getActiveConversationId(): string | null {
    return getAiConversationId();
  },

  async getConversations(): Promise<AIConversationSummary[]> {
    return fetchAIConversations();
  },

  async createConversation(title = 'Taskora study assistant'): Promise<AIConversationSummary> {
    const { conversation } = await requestApi<{ conversation: AIConversationSummary }>(
      '/api/ai/conversations',
      { method: 'POST', body: JSON.stringify({ title }) }
    );
    setAiConversationId(conversation.id);
    return conversation;
  },

  async loadConversation(requestedConversationId?: string): Promise<ChatMessage[]> {
    let conversationId = requestedConversationId || getAiConversationId();
    if (!conversationId) {
      const conversations = await fetchAIConversations();
      conversationId = conversations[0]?.id || null;
      if (!conversationId) return [];
    }

    type ConversationResponse = { conversation: {
      messages: Array<{ id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: string }>;
      proposals: Array<{
        id: string;
        payload: { title?: string; description?: string; priority?: string; dueDate?: string };
        status: string;
        createdAt: string;
      }>;
    } };
    let response: ConversationResponse;
    try {
      response = await requestApi<ConversationResponse>(
        `/api/ai/conversations/${encodeURIComponent(conversationId)}`
      );
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
      if (!requestedConversationId || getAiConversationId() === conversationId) {
        clearAiConversationId();
      }
      const conversations = await fetchAIConversations();
      conversationId = conversations[0]?.id || null;
      if (!conversationId) return [];
      response = await requestApi<ConversationResponse>(
        `/api/ai/conversations/${encodeURIComponent(conversationId)}`
      );
    }

    setAiConversationId(conversationId);
    const { conversation } = response;
    const messages: ChatMessage[] = conversation.messages.map((message) => ({
      id: message.id,
      sender: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
      timestamp: new Date(message.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
    const proposalMessages: ChatMessage[] = conversation.proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      sender: 'assistant',
      content: 'Saved task proposal',
      timestamp: new Date(proposal.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      proposal: mapBackendProposal(proposal),
    }));
    return [...messages, ...proposalMessages];
  },

  async getProposals(): Promise<AIProposal[]> {
    const conversationId = getAiConversationId();
    if (!conversationId) return [];
    const { conversation } = await requestApi<{ conversation: {
      proposals: Array<{ id: string; payload: { title?: string; description?: string; priority?: string; dueDate?: string }; status: string; createdAt: string }>;
    } }>(`/api/ai/conversations/${encodeURIComponent(conversationId)}`);
    return conversation.proposals.map((proposal) => mapBackendProposal(proposal));
  },

  async approveProposal(proposalId: string): Promise<{ proposal: AIProposal; createdTasks: Task[] }> {
    const result = await requestApi<{ proposal: { id: string; payload: Record<string, unknown>; status: string; createdAt: string }; task: ApiTask }>(
      `/api/ai/proposals/${encodeURIComponent(proposalId)}/approve`,
      { method: 'POST' }
    );
    return {
      proposal: mapBackendProposal(result.proposal as { id: string; payload: { title?: string; description?: string; priority?: string; dueDate?: string }; status: string; createdAt: string }),
      createdTasks: [toAppTask(result.task)],
    };
  },

  async rejectProposal(proposalId: string): Promise<AIProposal> {
    const { proposal } = await requestApi<{ proposal: { id: string; payload: { title?: string; description?: string; priority?: string; dueDate?: string }; status: string; createdAt: string } }>(
      `/api/ai/proposals/${encodeURIComponent(proposalId)}/reject`,
      { method: 'POST' }
    );
    return mapBackendProposal(proposal);
  },

  async generateProposal(prompt: string): Promise<{
    response: string;
    assistantMessageId: string;
    timestamp: string;
    proposals: AIProposal[];
  }> {
    let conversationId = getAiConversationId();
    if (!conversationId) {
      const conversation = await this.createConversation();
      conversationId = conversation.id;
    }
    const result = await requestApi<{
      assistantMessage: { id: string; content: string; createdAt: string };
      proposals: Array<{ id: string; payload: { title?: string; description?: string; priority?: string; dueDate?: string }; status: string; createdAt: string }>;
    }>(
      `/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body: JSON.stringify({ message: prompt }) }
    );
    return {
      response: result.assistantMessage.content,
      assistantMessageId: result.assistantMessage.id,
      timestamp: new Date(result.assistantMessage.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      proposals: result.proposals.map((proposal) => mapBackendProposal(proposal)),
    };
  },
};

// ==========================================
// BRAIN DUMP API (TC08)
// ==========================================
export const brainDumpApi = {
  async getEntries(): Promise<BrainDumpEntry[]> {
    const { brainDumps } = await requestApi<{ brainDumps: Array<{
      id: string;
      userId: string;
      inputText: string;
      summary: string;
      proposals: Array<unknown>;
      createdAt: string;
    }> }>('/api/brain-dumps');
    return brainDumps.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      rawText: entry.inputText,
      status: entry.proposals.length > 0 ? 'organized' : 'raw',
      extractedTaskCount: entry.proposals.length,
      createdAt: entry.createdAt,
    }));
  },

  async addEntry(rawText: string): Promise<BrainDumpEntry> {
    const { brainDump } = await requestApi<{ brainDump: {
      id: string;
      userId: string;
      inputText: string;
      proposals: Array<unknown>;
      createdAt: string;
    } }>('/api/brain-dumps', {
      method: 'POST',
      body: JSON.stringify({ text: rawText }),
    });
    return {
      id: brainDump.id,
      userId: brainDump.userId,
      rawText: brainDump.inputText,
      status: 'organized',
      extractedTaskCount: brainDump.proposals.length,
      createdAt: brainDump.createdAt,
    };
  },

  async convertToProposal(entryId: string): Promise<AIProposal> {
    const { brainDump } = await requestApi<{ brainDump: {
      proposals: Array<{ id: string; title: string; description: string | null; priority: string; dueDate: string | null; status: string; createdAt: string }>;
    } }>(`/api/brain-dumps/${encodeURIComponent(entryId)}`);
    if (brainDump.proposals.length === 0) {
      throw new ApiError('This Brain Dump has no pending proposals.', 404);
    }
    return mapBackendProposal(brainDump.proposals[0], 'brain_dump');
  },

  async approveProposal(brainDumpId: string, proposalId: string): Promise<{ proposal: AIProposal; createdTasks: Task[] }> {
    const result = await requestApi<{ proposal: { id: string; title: string; description: string | null; priority: string; dueDate: string | null; status: string; createdAt: string }; task: ApiTask }>(
      `/api/brain-dumps/${encodeURIComponent(brainDumpId)}/proposals/${encodeURIComponent(proposalId)}/approve`,
      { method: 'POST' }
    );
    return {
      proposal: mapBackendProposal(result.proposal, 'brain_dump'),
      createdTasks: [toAppTask(result.task)],
    };
  },

  async rejectProposal(brainDumpId: string, proposalId: string): Promise<AIProposal> {
    const { proposal } = await requestApi<{ proposal: { id: string; title: string; description: string | null; priority: string; dueDate: string | null; status: string; createdAt: string } }>(
      `/api/brain-dumps/${encodeURIComponent(brainDumpId)}/proposals/${encodeURIComponent(proposalId)}/reject`,
      { method: 'POST' }
    );
    return mapBackendProposal(proposal, 'brain_dump');
  },
};

// ==========================================
// STUDY WORKSPACE & NOTES API
// ==========================================
export const notesApi = {
  async getNotes(): Promise<StudyNote[]> {
    const { notes } = await requestApi<{ notes: Array<{
      id: string; userId: string; subjectId: string | null; subjectName: string | null; title: string;
      content: string; tags: string[]; isPrivate: boolean; shareCode: string | null; updatedAt: string; createdAt: string;
    }> }>('/api/notes');
    return notes.map((note) => ({
      id: note.id,
      userId: note.userId,
      subjectId: note.subjectId || 'sub_general',
      subjectName: note.subjectName || 'General',
      title: note.title,
      content: note.content,
      tags: note.tags,
      isPrivate: note.isPrivate,
      shareCode: note.shareCode || undefined,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    }));
  },

  async saveNote(note: Partial<StudyNote> & { title: string }): Promise<StudyNote> {
    const method = note.id ? 'PUT' : 'POST';
    const path = note.id ? `/api/notes/${encodeURIComponent(note.id)}` : '/api/notes';
    const { note: saved } = await requestApi<{ note: {
      id: string; userId: string; subjectId: string | null; subjectName: string | null; title: string;
      content: string; tags: string[]; isPrivate: boolean; shareCode: string | null; updatedAt: string; createdAt: string;
    } }>(path, {
      method,
      body: JSON.stringify({
        title: note.title,
        content: note.content || '',
        subjectId: note.subjectId,
        subjectName: note.subjectName,
        tags: note.tags || [],
        isPrivate: note.isPrivate ?? true,
      }),
    });
    return {
      id: saved.id,
      userId: saved.userId,
      subjectId: saved.subjectId || 'sub_general',
      subjectName: saved.subjectName || 'General',
      title: saved.title,
      content: saved.content,
      tags: saved.tags,
      isPrivate: saved.isPrivate,
      shareCode: saved.shareCode || undefined,
      updatedAt: saved.updatedAt,
      createdAt: saved.createdAt,
    };
  },

  async deleteNote(id: string): Promise<void> {
    await requestApi<void>(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getSharedNote(shareCode: string): Promise<{
    id: string;
    title: string;
    content: string;
    subjectName: string | null;
    tags: string[];
    updatedAt: string;
  }> {
    const { note } = await requestApi<{ note: {
      id: string;
      title: string;
      content: string;
      subjectName: string | null;
      tags: string[];
      updatedAt: string;
    } }>(`/api/notes/shared/${encodeURIComponent(shareCode)}`);
    return note;
  },
};

// ==========================================
// FOCUS MODE API (TC05)
// ==========================================
export const focusApi = {
  async startSession(subject: string, durationMinutes: number): Promise<string> {
    const { sessionToken } = await requestApi<{ sessionToken: string }>('/api/focus/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ subject, durationMinutes }),
    });
    return sessionToken;
  },

  async completeSession(sessionToken: string): Promise<FocusSession> {
    const { session } = await requestApi<{ session: {
      id: string; userId: string; subject: string; durationMinutes: number; notes: string | null;
      xpEarned: number; completedAt: string;
    } }>('/api/focus/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    });
    return {
      id: session.id,
      userId: session.userId,
      subject: session.subject,
      durationMinutes: session.durationMinutes,
      completedAt: session.completedAt,
      notes: session.notes || undefined,
      xpEarned: session.xpEarned,
    };
  },

  async getSessions(): Promise<FocusSession[]> {
    const { sessions } = await requestApi<{ sessions: Array<{
      id: string; userId: string; subject: string; durationMinutes: number; notes: string | null;
      xpEarned: number; completedAt: string;
    }> }>('/api/focus/sessions');
    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      subject: session.subject,
      durationMinutes: session.durationMinutes,
      completedAt: session.completedAt,
      notes: session.notes || undefined,
      xpEarned: session.xpEarned,
    }));
  },
};

export const flashcardsApi = {
  async getDecks(): Promise<FlashcardDeck[]> {
    const { decks } = await requestApi<{ decks: Array<Omit<FlashcardDeck, 'cardCount'> & { _count: { cards: number } }> }>(
      '/api/flashcards/decks'
    );
    return decks.map(({ _count, ...deck }) => ({ ...deck, cardCount: _count.cards }));
  },

  async getDeck(id: string): Promise<FlashcardDeck> {
    const { deck } = await requestApi<{ deck: Omit<FlashcardDeck, 'cardCount'> & { _count: { cards: number } } }>(
      `/api/flashcards/decks/${encodeURIComponent(id)}`
    );
    const { _count, ...result } = deck;
    return { ...result, cardCount: _count.cards };
  },

  async createDeck(input: { title: string; description?: string | null }): Promise<FlashcardDeck> {
    const { deck } = await requestApi<{ deck: Omit<FlashcardDeck, 'cardCount'> }>('/api/flashcards/decks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ...deck, cardCount: 0 };
  },

  async updateDeck(id: string, input: { title?: string; description?: string | null }): Promise<FlashcardDeck> {
    const { deck } = await requestApi<{ deck: Omit<FlashcardDeck, 'cardCount'> & { _count: { cards: number } } }>(
      `/api/flashcards/decks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) }
    );
    const { _count, ...result } = deck;
    return { ...result, cardCount: _count.cards };
  },

  async deleteDeck(id: string): Promise<void> {
    await requestApi<void>(`/api/flashcards/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async createCard(deckId: string, input: { front: string; back: string }): Promise<Flashcard> {
    const { card } = await requestApi<{ card: Flashcard }>(
      `/api/flashcards/decks/${encodeURIComponent(deckId)}/cards`,
      { method: 'POST', body: JSON.stringify(input) }
    );
    return card;
  },

  async updateCard(id: string, input: { front?: string; back?: string; position?: number }): Promise<Flashcard> {
    const { card } = await requestApi<{ card: Flashcard }>(
      `/api/flashcards/cards/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) }
    );
    return card;
  },

  async deleteCard(id: string): Promise<void> {
    await requestApi<void>(`/api/flashcards/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async reviewCard(id: string, quality: number): Promise<Flashcard> {
    const { card } = await requestApi<{ card: Flashcard }>(
      `/api/flashcards/cards/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ quality }) }
    );
    return card;
  },
};

// ==========================================
// STUDY ROOMS API (TC10)
// ==========================================
export const roomsApi = {
  async getRooms(): Promise<StudyRoom[]> {
    const { rooms } = await requestApi<{ rooms: Array<{
      id: string; ownerId: string; name: string; topic: string; isPrivate: boolean; maxParticipants: number;
      participants: Array<{ userId: string; user?: { id: string; name: string; avatar: string | null }; status: string; joinedAt: string }>;
      messages: Array<{ id: string; userId: string; user?: { id: string; name: string; avatar: string | null }; content: string; createdAt: string }>;
      focusDurationMinutes: number; breakDurationMinutes: number; currentMode: 'FOCUS' | 'BREAK';
      timerRemainingSeconds: number; timerStartedAt: string | null; createdAt: string;
    }> }>('/api/study-rooms');
    return rooms.map((room) => ({
      id: room.id,
      ownerId: room.ownerId,
      name: room.name,
      topic: room.topic,
      isPrivate: room.isPrivate,
      maxParticipants: room.maxParticipants,
      participants: room.participants.map((participant) => ({
        id: participant.userId,
        name: participant.user?.name || 'Unknown user',
        avatar: resolveAvatarUrl(participant.user?.avatar),
        status: participant.status === 'break' ? 'break' : participant.status === 'idle' ? 'idle' : 'focusing',
        joinedAt: participant.joinedAt,
      })),
      messages: room.messages.map((message) => ({
        id: message.id,
        userId: message.userId,
        userName: message.user?.name || 'Unknown user',
        userAvatar: resolveAvatarUrl(message.user?.avatar),
        content: message.content,
        timestamp: message.createdAt,
      })),
      focusDurationMinutes: room.focusDurationMinutes,
      breakDurationMinutes: room.breakDurationMinutes,
      currentMode: room.currentMode === 'BREAK' ? 'break' : 'focus',
      timerRemainingSeconds: room.timerRemainingSeconds,
      timerStartedAt: room.timerStartedAt,
      createdAt: room.createdAt,
    }));
  },

  async createRoom(data: Partial<StudyRoom>): Promise<StudyRoom> {
    const { room } = await requestApi<{ room: {
      id: string; ownerId: string; name: string; topic: string; isPrivate: boolean; maxParticipants: number;
      participants: Array<{ userId: string; user?: { id: string; name: string; avatar: string | null }; status: string; joinedAt: string }>; messages: Array<unknown>;
      focusDurationMinutes: number; breakDurationMinutes: number; currentMode: 'FOCUS' | 'BREAK';
      timerRemainingSeconds: number; timerStartedAt: string | null; createdAt: string;
    } }>('/api/study-rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      id: room.id,
      ownerId: room.ownerId,
      name: room.name,
      topic: room.topic,
      isPrivate: room.isPrivate,
      maxParticipants: room.maxParticipants,
      participants: room.participants.map((participant) => ({
        id: participant.userId,
        name: participant.user?.name || 'Unknown user',
        avatar: resolveAvatarUrl(participant.user?.avatar),
        status: 'focusing',
        joinedAt: participant.joinedAt,
      })),
      messages: [],
      focusDurationMinutes: room.focusDurationMinutes,
      breakDurationMinutes: room.breakDurationMinutes,
      currentMode: room.currentMode === 'BREAK' ? 'break' : 'focus',
      timerRemainingSeconds: room.timerRemainingSeconds,
      timerStartedAt: room.timerStartedAt,
      createdAt: room.createdAt,
    };
  },

  async updateRoom(roomId: string, updates: {
    name?: string; topic?: string; maxParticipants?: number;
    focusDurationMinutes?: number; breakDurationMinutes?: number;
  }): Promise<void> {
    await requestApi<{ updated: boolean }>(`/api/study-rooms/${encodeURIComponent(roomId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteRoom(roomId: string): Promise<void> {
    await requestApi<void>(`/api/study-rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
  },

  async leaveRoom(roomId: string): Promise<void> {
    await requestApi<void>(`/api/study-rooms/${encodeURIComponent(roomId)}/participants/me`, {
      method: 'DELETE',
    });
  },

  async updateTimer(roomId: string, action: 'start' | 'pause' | 'reset' | 'next'): Promise<void> {
    await requestApi<{ timer: unknown }>(`/api/study-rooms/${encodeURIComponent(roomId)}/timer`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  },

  async postMessage(roomId: string, content: string): Promise<void> {
    await requestApi<{ message: unknown }>(`/api/study-rooms/${encodeURIComponent(roomId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async joinRoom(roomId: string, passcode?: string): Promise<void> {
    await requestApi<{ joined: boolean }>(`/api/study-rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    });
  },

  subscribeRoom(roomId: string, onEvent: (event: unknown) => void): () => void {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomId)}/events`, {
          headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const block of blocks) {
            const line = block.split('\n').find((item) => item.startsWith('data:'));
            if (!line) continue;
            try { onEvent(JSON.parse(line.slice(5).trim())); } catch { /* Ignore malformed stream events. */ }
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) return;
      }
    })();
    return () => controller.abort();
  },
};

// ==========================================
// GAMIFICATION API (TC09)
// ==========================================
export const gamificationApi = {
  async getAchievements(): Promise<Achievement[]> {
    const { achievements } = await requestApi<{ achievements: Array<{
      progress: number; unlockedAt: string | null; achievement: {
        id: string; title: string; description: string; category: string; icon: string; xpReward: number; requirement: number;
      };
    }> }>('/api/gamification');
    return achievements.map((item) => ({
      id: item.achievement.id,
      title: item.achievement.title,
      description: item.achievement.description,
      category: item.achievement.category as Achievement['category'],
      icon: item.achievement.icon,
      xpReward: item.achievement.xpReward,
      unlockedAt: item.unlockedAt || undefined,
      progress: item.progress,
      targetRequirement: String(item.achievement.requirement),
    }));
  },

  async getXPTransactions(): Promise<XPTransaction[]> {
    const { transactions } = await requestApi<{ transactions: Array<{
      id: string; amount: number; reason: string; source: XPTransaction['source'] | string; createdAt: string;
    }> }>('/api/gamification');
    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      reason: transaction.reason,
      source: ['task_completion', 'focus_session', 'habit_streak', 'achievement'].includes(transaction.source)
        ? transaction.source as XPTransaction['source']
        : 'achievement',
      timestamp: transaction.createdAt,
    }));
  },

  async getSummary(): Promise<{ xpTotal: number; level: number }> {
    const { xpTotal, level } = await requestApi<{ xpTotal: number; level: number }>('/api/gamification');
    return { xpTotal, level };
  },
};

// ==========================================
// THEME & DASHBOARD PERSONALIZATION
// ==========================================
export const themeApi = {
  getThemeConfig(): ThemeConfig {
    return loadFromStorage<ThemeConfig>('theme_config', DEFAULT_THEME_CONFIG);
  },

  saveThemeConfig(config: ThemeConfig): void {
    saveToStorage('theme_config', config);
  },

  resetTheme(): ThemeConfig {
    saveToStorage('theme_config', DEFAULT_THEME_CONFIG);
    return DEFAULT_THEME_CONFIG;
  },
};

export const dashboardApi = {
  getWidgets(): DashboardWidgetConfig[] {
    return loadFromStorage<DashboardWidgetConfig[]>('dashboard_widgets', DEFAULT_DASHBOARD_WIDGETS);
  },

  saveWidgets(widgets: DashboardWidgetConfig[]): void {
    saveToStorage('dashboard_widgets', widgets);
  },
};

export const analyticsApi = {
  async getAnalytics(period: '7d' | '30d' | 'semester' = '7d'): Promise<{
    taskCounts: Record<string, number>;
    focusMinutes: number;
    xpEarned: number;
    habitCheckIns: number;
    noteCount: number;
    focusByDay: Record<string, number>;
    subjectDistribution: Record<string, number>;
  }> {
    const { analytics } = await requestApi<{ analytics: {
      taskCounts: Record<string, number>;
      focusMinutes: number;
      xpEarned: number;
      habitCheckIns: number;
      noteCount: number;
      focusByDay: Record<string, number>;
      subjectDistribution: Record<string, number>;
    } }>(`/api/analytics?period=${encodeURIComponent(period)}`);
    return analytics;
  },
};

export const searchApi = {
  async search(query: string): Promise<{ tasks: Task[]; notes: StudyNote[]; habits: Habit[] }> {
    const result = await requestApi<{
      tasks: Array<ApiTask>;
      notes: Array<{ id: string; userId: string; subjectId: string | null; subjectName: string | null; title: string; content: string; tags: string[]; isPrivate: boolean; shareCode: string | null; updatedAt: string; createdAt: string }>;
      habits: Array<{ id: string; userId: string; title: string; description: string | null; category: string; color: string; iconName: string; frequency: string; reminderTime: string | null; createdAt: string }>;
    }>(`/api/search?q=${encodeURIComponent(query)}`);
    return {
      tasks: result.tasks.map(toAppTask),
      notes: result.notes.map((note) => ({
        id: note.id,
        userId: note.userId,
        subjectId: note.subjectId || 'sub_general',
        subjectName: note.subjectName || 'General',
        title: note.title,
        content: note.content,
        tags: note.tags,
        isPrivate: note.isPrivate,
        shareCode: note.shareCode || undefined,
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
      })),
      habits: result.habits.map((habit) => ({
        id: habit.id,
        userId: habit.userId,
        title: habit.title,
        description: habit.description || undefined,
        category: habit.category,
        color: habit.color,
        iconName: habit.iconName,
        streakCount: 0,
        bestStreak: 0,
        logs: {},
        reminderTime: habit.reminderTime || undefined,
        frequency: habit.frequency as Habit['frequency'],
        createdAt: habit.createdAt,
      })),
    };
  },
};

// ==========================================
// NOTIFICATIONS API
// ==========================================
interface ApiNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_due' | 'task_completed' | 'study_reminder' | 'study_plan_updated' | 'system';
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

function toAppNotification(notification: ApiNotification): NotificationItem {
  const type =
    notification.type === 'task_due'
      ? 'deadline'
      : notification.type === 'study_reminder'
        ? 'room'
        : notification.type === 'task_completed'
          ? 'achievement'
          : 'system';
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type,
    read: notification.read,
    actionUrl: notification.actionUrl || undefined,
    createdAt: notification.createdAt,
  };
}

export const notificationsApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const { notifications } = await requestApi<{ notifications: ApiNotification[] }>('/api/notifications');
    return notifications.map(toAppNotification);
  },

  async getUnreadCount(): Promise<number> {
    const { unreadCount } = await requestApi<{ unreadCount: number }>('/api/notifications/unread-count');
    return unreadCount;
  },

  async markRead(id: string): Promise<void> {
    await requestApi<{ notification: ApiNotification }>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' }
    );
  },

  async markAllRead(): Promise<void> {
    await requestApi<{ updatedCount: number }>('/api/notifications/read-all', { method: 'PATCH' });
  },

  async deleteNotification(id: string): Promise<void> {
    await requestApi<void>(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

// ==========================================
// ADMIN API
// ==========================================
export const adminApi = {
  async getStats(): Promise<AdminStats> {
    const { stats } = await requestApi<{ stats: AdminStats }>('/api/admin/stats');
    return stats;
  },

  async getReports(): Promise<ModerationReport[]> {
    const { reports } = await requestApi<{ reports: Array<{
      id: string; targetType: 'NOTE' | 'ROOM_MESSAGE' | 'USER'; targetId: string; reason: string; reporter?: { name: string; email: string };
      contentSnippet: string; status: 'PENDING' | 'RESOLVED' | 'DISMISSED'; createdAt: string;
    }> }>('/api/admin/reports');
    return reports.map((report) => ({
      id: report.id,
      targetType: report.targetType.toLowerCase() as ModerationReport['targetType'],
      targetId: report.targetId,
      reportedBy: report.reporter?.email || '',
      reason: report.reason,
      contentSnippet: report.contentSnippet,
      status: report.status.toLowerCase() as ModerationReport['status'],
      reportedAt: report.createdAt,
    }));
  },

  async resolveReport(id: string, action: 'resolved' | 'dismissed'): Promise<void> {
    await requestApi<{ report: unknown }>(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: action.toUpperCase() }),
    });
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const { logs } = await requestApi<{ logs: Array<{
      id: string; actor: { name: string; email: string } | null; action: string; target: string;
      ipAddress: string | null; createdAt: string; details: unknown;
    }> }>('/api/admin/audit-logs');
    return logs.map((log) => ({
      id: log.id,
      actorEmail: log.actor?.email || 'System',
      action: log.action,
      target: log.target,
      ipAddress: log.ipAddress || '',
      timestamp: log.createdAt,
      details: log.details ? JSON.stringify(log.details) : undefined,
    }));
  },
};
