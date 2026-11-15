import { StudyPlan, Task } from '../types';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'task' | 'study';
  time?: string;
  endTime?: string;
  details?: string;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  plan: StudyPlan | null,
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

  if (!plan) return taskEvents;

  const planStart = parseDateKey(plan.startDate);
  const planEnd = parseDateKey(plan.endDate);
  if (!planStart || !planEnd) return taskEvents;

  const planStartKey = toDateKey(planStart);
  const planEndKey = toDateKey(planEnd);
  const studyEvents: CalendarEvent[] = [];

  for (let date = start; toDateKey(date) < endKey; date = addCalendarDays(date, 1)) {
    const dateKey = toDateKey(date);
    if (dateKey < planStartKey || dateKey > planEndKey) continue;

    for (const session of plan.sessions) {
      if (session.day !== WEEKDAY_NAMES[date.getDay()]) continue;
      studyEvents.push({
        id: `study-${session.id}-${dateKey}`,
        title: session.subjectName,
        date: dateKey,
        type: 'study',
        time: session.startTime,
        endTime: session.endTime,
        details: session.topics.join(', '),
      });
    }
  }

  return [...taskEvents, ...studyEvents];
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
