import { ApiStudyPlan, Task } from '../types';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'task' | 'study';
  timeZone?: string;
  time?: string;
  endTime?: string;
  details?: string;
}

const WEEKDAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const DEFAULT_STUDY_TIME_ZONE = 'Asia/Colombo';

export function getStudyTimeZoneSummary(plans: ApiStudyPlan[]): string {
  const timeZones = Array.from(new Set(plans.map((plan) => plan.timeZone)));
  if (timeZones.length === 0) return DEFAULT_STUDY_TIME_ZONE;
  if (timeZones.length === 1) return timeZones[0];
  return "each plan's configured time zone";
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addCalendarDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function getCalendarGridDates(month: Date, weekStartsOn = 0): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addCalendarDays(firstOfMonth, -offset);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(gridStart, index));
}

export function getCalendarEvents(
  tasks: Task[],
  plans: ApiStudyPlan[],
  start: Date,
  endExclusive: Date
): CalendarEvent[] {
  const startKey = toDateKey(start);
  const endKey = toDateKey(endExclusive);
  const taskEvents: CalendarEvent[] = tasks
    .filter((task) => task.dueDate >= startKey && task.dueDate < endKey)
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.dueDate,
      type: 'task',
      time: task.dueTime,
      details: task.description,
    }));

  const studyEvents: CalendarEvent[] = [];

  for (let date = start; toDateKey(date) < endKey; date = addCalendarDays(date, 1)) {
    const dateKey = toDateKey(date);
    const dayOfWeek = WEEKDAY_CODES[date.getDay()];

    for (const plan of plans) {
      if (dateKey < plan.startDate.slice(0, 10) || dateKey > plan.endDate.slice(0, 10)) continue;

      for (const subject of plan.subjects) {
        for (const item of subject.scheduleItems || []) {
          if (item.dayOfWeek !== dayOfWeek) continue;
          studyEvents.push({
            id: `study-${plan.id}-${item.id}-${dateKey}`,
            title: subject.name,
            date: dateKey,
            type: 'study',
            timeZone: plan.timeZone,
            time: formatCalendarTime(item.startMinuteOfDay),
            endTime: formatCalendarTime(item.startMinuteOfDay + item.durationMinutes),
            details: [plan.title, ...item.topics].join(' · '),
          });
        }
      }
    }
  }

  return [...taskEvents, ...studyEvents];
}

function formatCalendarTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function groupCalendarEvents(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const current = grouped.get(event.date) || [];
    current.push(event);
    grouped.set(event.date, current);
  }
  return grouped;
}
