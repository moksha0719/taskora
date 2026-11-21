import { describe, expect, it } from 'vitest';
import type { ApiStudyPlan } from '../types';
import { addCalendarDays, getCalendarEvents, getStudyTimeZoneSummary } from './calendar';

function planInTimeZone(timeZone: string): ApiStudyPlan {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    activeUserId: null,
    title: 'Calendar plan',
    status: 'DRAFT',
    startDate: '2026-11-17',
    endDate: '2026-12-17',
    nextSessionDate: '2026-11-24',
    timeZone,
    weeklyTargetMinutes: 600,
    studyDaysPerWeek: 4,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
    subjects: [{
      id: '550e8400-e29b-41d4-a716-446655440002',
      planId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Mathematics',
      code: 'MATH',
      color: '#9885E8',
      targetMinutesPerWeek: 600,
      scheduleItems: [{
        id: '550e8400-e29b-41d4-a716-446655440003',
        subjectId: '550e8400-e29b-41d4-a716-446655440002',
        dayOfWeek: 'TUE',
        startMinuteOfDay: 600,
        durationMinutes: 60,
        kind: 'STUDY',
        topics: [],
      }],
    }],
  };
}

describe('calendar study time zones', () => {
  it('defaults the calendar label to Asia/Colombo when there are no plans', () => {
    expect(getStudyTimeZoneSummary([])).toBe('Asia/Colombo');
  });

  it('uses a plan time zone without converting its wall-clock schedule time', () => {
    const plan = planInTimeZone('Asia/Colombo');
    const start = new Date(2026, 10, 17);
    const events = getCalendarEvents([], [plan], start, addCalendarDays(start, 1));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      time: '10:00',
      timeZone: 'Asia/Colombo',
    });
    expect(getStudyTimeZoneSummary([plan])).toBe('Asia/Colombo');
  });

  it('marks only completed schedule occurrences on the calendar', () => {
    const plan = planInTimeZone('Asia/Colombo');
    const start = new Date(2026, 10, 17);
    const events = getCalendarEvents([], [plan], start, addCalendarDays(start, 8), [{
      id: 'completion-1',
      scheduleItemId: '550e8400-e29b-41d4-a716-446655440003',
      occurrenceDate: '2026-11-17',
      completed: true,
      completedAt: '2026-11-17T12:00:00.000Z',
      actualDurationMinutes: 45,
    }]);

    expect(events).toHaveLength(2);
    expect(events.find((event) => event.date === '2026-11-17')?.completed).toBe(true);
    expect(events.find((event) => event.date === '2026-11-24')?.completed).toBe(false);
  });

  it('marks the saved backend nextSessionDate on the calendar', () => {
    const plan = planInTimeZone('Asia/Colombo');
    const start = new Date(2026, 10, 17);
    const events = getCalendarEvents([], [plan], start, addCalendarDays(start, 8));

    expect(events.filter((event) => event.isNextSession).map((event) => event.date))
      .toEqual(['2026-11-24']);
  });

  it('identifies when plans use different configured time zones', () => {
    expect(getStudyTimeZoneSummary([
      planInTimeZone('Asia/Colombo'),
      planInTimeZone('America/New_York'),
    ])).toBe("each plan's configured time zone");
  });
});
