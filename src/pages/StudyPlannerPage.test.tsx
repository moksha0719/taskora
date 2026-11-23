import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyPlannerPage } from './StudyPlannerPage';
import type { ApiStudyPlan } from '../types';

const api = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getActivePlan: vi.fn(),
  getCompletions: vi.fn(),
  createPlan: vi.fn(),
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
      createPlan: api.createPlan,
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
    api.createPlan.mockReset().mockResolvedValue(plan);
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

  it('omits empty optional subject fields and filters completely blank subject rows', async () => {
    render(<MemoryRouter><StudyPlannerPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Saved study plan' });

    fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
    fireEvent.change(screen.getByLabelText('Plan title'), { target: { value: 'Exam preparation' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Distributed Systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add subject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => expect(api.createPlan).toHaveBeenCalledOnce());
    const submitted = api.createPlan.mock.calls[0][0];
    expect(submitted.weeklyTargetMinutes).toBe(600);
    expect(submitted.studyDaysPerWeek).toBe(4);
    expect(submitted.subjects).toHaveLength(1);
    expect(submitted.subjects[0]).toMatchObject({
      name: 'Distributed Systems',
      targetMinutesPerWeek: 600,
    });
    expect(submitted.subjects[0]).not.toHaveProperty('code');
  });

  it('accepts the backend weekly-target maximum with a supported study-day count', async () => {
    render(<MemoryRouter><StudyPlannerPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Saved study plan' });
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
    fireEvent.change(screen.getByLabelText('Plan title'), { target: { value: 'Exam preparation' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Distributed Systems' } });
    fireEvent.change(screen.getByLabelText('Weekly target (minutes)'), { target: { value: '2400' } });
    fireEvent.change(screen.getByLabelText('Study days per week'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Minutes / week'), { target: { value: '2400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => expect(api.createPlan).toHaveBeenCalledOnce());
    expect(api.createPlan.mock.calls[0][0]).toMatchObject({
      weeklyTargetMinutes: 2400,
      studyDaysPerWeek: 6,
      subjects: [{ targetMinutesPerWeek: 2400 }],
    });
  });
});
