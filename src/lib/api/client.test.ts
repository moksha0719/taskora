import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUDY_PLANS_UPDATED_EVENT, studyPlansApi } from './client';
import type { ApiStudyPlan, StudyCompletion, StudyPlanInput } from '../../types';

const planInput: StudyPlanInput = {
  title: 'Calendar refresh test',
  startDate: '2026-11-17',
  endDate: '2026-12-17',
  timeZone: 'Asia/Colombo',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 4,
  subjects: [{ name: 'Mathematics', targetMinutesPerWeek: 600 }],
};

const plan: ApiStudyPlan = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  activeUserId: null,
  title: 'Calendar refresh test',
  status: 'DRAFT',
  startDate: '2026-11-17',
  endDate: '2026-12-17',
  timeZone: 'Asia/Colombo',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 4,
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
  subjects: [],
};

describe('study plan calendar refresh notifications', () => {
  const onUpdated = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.setItem('taskora_auth_token', 'test-token');
    window.addEventListener(STUDY_PLANS_UPDATED_EVENT, onUpdated);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.removeEventListener(STUDY_PLANS_UPDATED_EVENT, onUpdated);
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('notifies mounted calendar views after successful create, update, and delete requests', async () => {
    const successResponse = () => new Response(JSON.stringify({ studyPlan: plan }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ studyPlan: plan }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await studyPlansApi.createPlan(planInput);
    await studyPlansApi.updatePlan(plan.id, planInput);
    await studyPlansApi.deletePlan(plan.id);

    expect(onUpdated).toHaveBeenCalledTimes(3);
  });

  it('does not notify calendar views when a plan mutation fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(studyPlansApi.createPlan(planInput)).rejects.toThrow('Request failed');
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('loads completion history for the requested civil-date range', async () => {
    const completion: StudyCompletion = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      scheduleItemId: '550e8400-e29b-41d4-a716-446655440003',
      occurrenceDate: '2026-11-17',
      completedAt: '2026-11-17T12:00:00.000Z',
      actualDurationMinutes: 45,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ completions: [completion] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(studyPlansApi.getCompletions(plan.id, '2026-11-17', '2026-11-18'))
      .resolves.toEqual([completion]);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/api/study-plans/${plan.id}/completions?from=2026-11-17&to=2026-11-18`
    );
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });
});
