import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudyPlanWidget } from './StudyPlanWidget';

const api = vi.hoisted(() => ({
  getActivePlan: vi.fn(),
  getCompletions: vi.fn(),
}));
vi.mock('../../lib/api/client', () => ({
  STUDY_PLANS_UPDATED_EVENT: 'taskora:study-plans-updated',
  studyPlansApi: api,
}));

describe('StudyPlanWidget', () => {
  beforeEach(() => {
    api.getActivePlan.mockReset();
    api.getCompletions.mockReset();
  });

  it('shows subjects from the active account study plan', async () => {
    api.getActivePlan.mockResolvedValue({
      id: 'plan-1',
      title: 'My current plan',
      startDate: '2026-11-20',
      endDate: '2026-12-20',
      nextSessionDate: '2026-11-25',
      subjects: [{ id: 'subject-1', name: 'Discrete Mathematics', targetMinutesPerWeek: 600 }],
    });
    render(<MemoryRouter><StudyPlanWidget /></MemoryRouter>);

    expect(await screen.findByText('My current plan')).toBeInTheDocument();
    expect(screen.getByText('Discrete Mathematics')).toBeInTheDocument();
    expect(screen.getByText('10 h/week')).toBeInTheDocument();
    expect(screen.getByText(/Next session:/)).toHaveTextContent(
      new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        .format(new Date(2026, 10, 25)),
    );
  });

  it('shows completed session progress from the active plan schedule', async () => {
    api.getActivePlan.mockResolvedValue({
      id: 'plan-1',
      title: 'Weekly plan',
      startDate: '2026-11-23',
      endDate: '2026-11-29',
      nextSessionDate: '2026-11-25',
      subjects: [{
        id: 'subject-1',
        name: 'Mathematics',
        targetMinutesPerWeek: 600,
        scheduleItems: [
          {
            id: 'session-1',
            subjectId: 'subject-1',
            dayOfWeek: 'MON',
            startMinuteOfDay: 600,
            durationMinutes: 60,
            kind: 'STUDY',
            topics: [],
          },
          {
            id: 'session-2',
            subjectId: 'subject-1',
            dayOfWeek: 'WED',
            startMinuteOfDay: 600,
            durationMinutes: 60,
            kind: 'STUDY',
            topics: [],
          },
        ],
      }],
    });
    api.getCompletions.mockResolvedValue([{
      id: 'completion-1',
      scheduleItemId: 'session-1',
      occurrenceDate: '2026-11-23',
      completed: true,
      completedAt: '2026-11-23T12:00:00.000Z',
      actualDurationMinutes: 60,
    }]);

    render(<MemoryRouter><StudyPlanWidget /></MemoryRouter>);

    expect(await screen.findByText('1 of 2 sessions completed')).toBeInTheDocument();
    expect(api.getCompletions).toHaveBeenCalledWith(
      'plan-1',
      '2026-11-23',
      '2026-11-30',
      { page: 1, limit: 100 },
    );
  });

  it('shows an empty state when there is no active plan', async () => {
    api.getActivePlan.mockResolvedValue(null);
    render(<MemoryRouter><StudyPlanWidget /></MemoryRouter>);

    expect(await screen.findByText('No active study plan. Create one to track your progress!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Plan' })).toHaveAttribute('href', '/study-planner');
  });

  it('shows an error and allows retrying when the active plan cannot be loaded', async () => {
    api.getActivePlan
      .mockRejectedValueOnce(new Error('Study plan service unavailable'))
      .mockResolvedValueOnce(null);
    render(<MemoryRouter><StudyPlanWidget /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Study plan service unavailable');
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByText('No active study plan. Create one to track your progress!')).toBeInTheDocument();
  });

  it('refreshes when a study plan update event is dispatched', async () => {
    api.getActivePlan
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'plan-1',
        title: 'Updated plan',
        startDate: '2026-11-20',
        endDate: '2026-12-20',
        subjects: [],
      });
    render(<MemoryRouter><StudyPlanWidget /></MemoryRouter>);

    expect(await screen.findByText('No active study plan. Create one to track your progress!')).toBeInTheDocument();
    window.dispatchEvent(new Event('taskora:study-plans-updated'));

    expect(await screen.findByText('Updated plan')).toBeInTheDocument();
    expect(api.getActivePlan).toHaveBeenCalledTimes(2);
  });
});
