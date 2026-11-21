import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyPlannerPage } from './StudyPlannerPage';
import type { ApiStudyPlan } from '../types';

const api = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getActivePlan: vi.fn(),
  getCompletions: vi.fn(),
}));

const auth = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/client')>();
  return {
    ...actual,
    studyPlansApi: {
      ...actual.studyPlansApi,
      getPlans: api.getPlans,
      getActivePlan: api.getActivePlan,
      getCompletions: api.getCompletions,
    },
  };
});

const plan: ApiStudyPlan = {
  id: 'plan-1',
  userId: 'user-1',
  activeUserId: 'user-1',
  title: 'Saved study plan',
  status: 'ACTIVE',
  startDate: '2026-11-17',
  endDate: '2026-12-17',
  nextSessionDate: '2026-11-24',
  timeZone: 'Asia/Colombo',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 4,
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
  subjects: [],
};

describe('StudyPlannerPage', () => {
  beforeEach(() => {
    api.getPlans.mockReset().mockResolvedValue([plan]);
    api.getActivePlan.mockReset().mockResolvedValue(plan);
    api.getCompletions.mockReset().mockResolvedValue([]);
    auth.logout.mockReset();
  });

  it('loads the saved plans and displays the backend nextSessionDate', async () => {
    render(<MemoryRouter><StudyPlannerPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Saved study plan' })).toBeInTheDocument();
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(2026, 10, 24));
    expect(screen.getByText(`Next session: ${formattedDate}`)).toBeInTheDocument();
    expect(api.getPlans).toHaveBeenCalledOnce();
    expect(api.getActivePlan).toHaveBeenCalledOnce();
  });
});
