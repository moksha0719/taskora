import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarPage } from './CalendarPage';
import { addCalendarDays, toDateKey } from '../lib/calendar';
import type { ApiStudyPlan } from '../types';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getCalendarPlans: vi.fn(),
  getCompletions: vi.fn(),
}));

vi.mock('../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/client')>();
  return {
    ...actual,
    tasksApi: { ...actual.tasksApi, getTasks: api.getTasks },
    studyPlansApi: {
      ...actual.studyPlansApi,
      getCalendarPlans: api.getCalendarPlans,
      getCompletions: api.getCompletions,
    },
  };
});

function createPlan(nextDate: Date): ApiStudyPlan {
  const nextSessionDate = toDateKey(nextDate);
  return {
    id: 'plan-1',
    userId: 'user-1',
    activeUserId: 'user-1',
    title: 'Saved calendar plan',
    status: 'ACTIVE',
    startDate: toDateKey(addCalendarDays(nextDate, -14)),
    endDate: toDateKey(addCalendarDays(nextDate, 30)),
    nextSessionDate,
    timeZone: 'Asia/Colombo',
    weeklyTargetMinutes: 300,
    studyDaysPerWeek: 1,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
    subjects: [{
      id: 'subject-1',
      planId: 'plan-1',
      name: 'Mathematics',
      code: 'MATH',
      color: '#9885E8',
      targetMinutesPerWeek: 300,
      scheduleItems: [{
        id: 'schedule-1',
        subjectId: 'subject-1',
        dayOfWeek: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][nextDate.getDay()] as
          'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
        startMinuteOfDay: 600,
        durationMinutes: 60,
        kind: 'STUDY',
        topics: [],
      }],
    }],
  };
}

describe('CalendarPage', () => {
  beforeEach(() => {
    api.getTasks.mockReset().mockResolvedValue([]);
    api.getCompletions.mockReset().mockResolvedValue([]);
    api.getCalendarPlans.mockReset();
  });

  it('loads saved plans and marks the backend nextSessionDate in the agenda', async () => {
    const nextDate = addCalendarDays(new Date(), 1);
    api.getCalendarPlans.mockResolvedValue([createPlan(nextDate)]);
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);

    const dateLabel = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(nextDate);
    fireEvent.click(await screen.findByRole('button', { name: dateLabel }));

    expect(await screen.findByText('Next study session')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(api.getCalendarPlans).toHaveBeenCalledOnce();
  });
});
