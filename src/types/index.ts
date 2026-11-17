export type Role = 'student' | 'admin' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  bio?: string;
  major?: string;
  joinedAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: string; // e.g., 'Computer Science', 'Personal', 'Mathematics'
  tags: string[];
  subtasks: Subtask[];
  estimatedMinutes?: number;
  actualMinutes?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudySubject {
  id: string;
  name: string;
  code: string;
  color: string;
  targetHoursWeekly: number;
  completedHoursWeekly: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  topics: string[];
  isCompleted: boolean;
}

export interface StudyPlan {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  subjects: StudySubject[];
  sessions: StudySession[];
  weeklyTargetHours: number;
  createdAt: string;
}

export type StudyPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type StudyDayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface StudyScheduleItem {
  id: string;
  subjectId: string;
  dayOfWeek: StudyDayCode;
  startMinuteOfDay: number;
  durationMinutes: number;
  kind: 'STUDY' | 'REVIEW';
  topics: string[];
}

export interface StudyPlanSubject {
  id: string;
  planId: string;
  name: string;
  code: string;
  color: string;
  targetMinutesPerWeek: number;
  scheduleItems?: StudyScheduleItem[];
}

export interface ApiStudyPlan {
  id: string;
  userId: string;
  activeUserId: string | null;
  title: string;
  status: StudyPlanStatus;
  startDate: string;
  endDate: string;
  timeZone: string;
  weeklyTargetMinutes: number;
  studyDaysPerWeek: number;
  createdAt: string;
  updatedAt: string;
  subjects: StudyPlanSubject[];
}

export interface StudyPlanSubjectInput {
  name: string;
  code?: string;
  color?: string;
  targetMinutesPerWeek: number;
}

export interface StudyPlanInput {
  title: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  weeklyTargetMinutes: number;
  studyDaysPerWeek: number;
  subjects: StudyPlanSubjectInput[];
}

export interface StudyAvailabilityWindow {
  dayOfWeek: StudyDayCode;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
}

export interface StudySchedulePreviewItem {
  subjectId: string;
  subjectName: string;
  dayOfWeek: StudyDayCode;
  startMinuteOfDay: number;
  durationMinutes: number;
  kind: 'STUDY';
}

export interface StudySchedulePreviewInput {
  plan: Pick<ApiStudyPlan, 'weeklyTargetMinutes' | 'studyDaysPerWeek'>;
  subjects: Array<Pick<StudyPlanSubject, 'id' | 'name' | 'targetMinutesPerWeek'>>;
  studyDays: StudyDayCode[];
  scheduleSettings: {
    availabilityWindows: StudyAvailabilityWindow[];
  };
}

export interface StudyCompletion {
  id: string;
  scheduleItemId: string;
  occurrenceDate: string;
  completedAt: string;
  actualDurationMinutes: number | null;
}

export type ProposalType = 
  | 'task_breakdown' 
  | 'study_schedule' 
  | 'habit_suggestion' 
  | 'brain_dump_conversion';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface AIProposalItem {
  id: string;
  type: 'task' | 'study_session' | 'habit' | 'note';
  title: string;
  description?: string;
  date?: string;
  priority?: TaskPriority;
  category?: string;
  estimatedMinutes?: number;
}

export interface AIProposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  status: ProposalStatus;
  items: AIProposalItem[];
  suggestedAt: string;
  appliedAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  proposal?: AIProposal;
}

export interface HabitLog {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  color: string;
  iconName: string;
  streakCount: number;
  bestStreak: number;
  logs: Record<string, boolean>; // key: YYYY-MM-DD
  reminderTime?: string;
  frequency: 'daily' | 'weekdays' | 'custom';
  createdAt: string;
}

export interface FocusSession {
  id: string;
  userId: string;
  subject: string;
  durationMinutes: number;
  completedAt: string;
  notes?: string;
  xpEarned: number;
}

export interface StudyNote {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  content: string;
  tags: string[];
  isPrivate: boolean; // default true (FR-10)
  shareCode?: string;
  updatedAt: string;
  createdAt: string;
}

export interface BrainDumpEntry {
  id: string;
  userId: string;
  rawText: string;
  status: 'raw' | 'organized' | 'archived';
  categoryHint?: string;
  extractedTaskCount?: number;
  createdAt: string;
}

export interface RoomParticipant {
  id: string;
  name: string;
  avatar: string;
  status: 'focusing' | 'break' | 'idle';
  currentTask?: string;
  joinedAt: string;
}

export interface RoomMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
  isModerator?: boolean;
}

export interface StudyRoom {
  id: string;
  name: string;
  topic: string;
  isPrivate: boolean;
  passcode?: string;
  maxParticipants: number;
  participants: RoomParticipant[];
  messages: RoomMessage[];
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  currentMode: 'focus' | 'break';
  timerRemainingSeconds: number;
  createdAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'focus' | 'tasks' | 'habits' | 'social';
  icon: string;
  xpReward: number;
  unlockedAt?: string;
  progress: number; // 0 to 100
  targetRequirement: string;
}

export interface XPTransaction {
  id: string;
  amount: number;
  reason: string;
  source: 'task_completion' | 'focus_session' | 'habit_streak' | 'achievement';
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'deadline' | 'habit' | 'room' | 'system' | 'achievement';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type ThemePresetId = 'lavender' | 'mint' | 'peach' | 'midnight' | 'bubblegum';
export type MascotType = 'bunny' | 'kitten' | 'bear' | 'none';

export interface ThemeConfig {
  preset: ThemePresetId;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
  cardStyle: 'rounded-24' | 'rounded-32' | 'squircle' | 'minimal';
  mascot: MascotType;
  decorationsEnabled: boolean;
  darkMode: 'light' | 'dark' | 'system';
}

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  totalStudyHours: number;
  totalTasksCompleted: number;
  reportedContentCount: number;
  serverUptimePercent: number;
}

export interface ModerationReport {
  id: string;
  targetType: 'note' | 'room_message' | 'user';
  targetId: string;
  reportedBy: string;
  reason: string;
  contentSnippet: string;
  status: 'pending' | 'resolved' | 'dismissed';
  reportedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  ipAddress: string;
  timestamp: string;
  details?: string;
}
