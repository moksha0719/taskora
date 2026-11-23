import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardStatsRow } from './DashboardStatsRow';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getAnalytics: vi.fn(),
  getTodaySummary: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  tasksApi: { getTasks: api.getTasks },
  analyticsApi: { getAnalytics: api.getAnalytics },
  focusApi: { getTodaySummary: api.getTodaySummary },
  gamificationApi: { getSummary: api.getSummary },
}));

describe('DashboardStatsRow', () => {
  beforeEach(() => {
    api.getTasks.mockReset().mockResolvedValue([
      { id: 'task-1', status: 'completed' },
      { id: 'task-2', status: 'in_progress' },
      { id: 'task-3', status: 'completed' },
      { id: 'task-4', status: 'todo' },
    ]);
    api.getAnalytics.mockReset().mockResolvedValue({
      taskCounts: { COMPLETED: 18, IN_PROGRESS: 4 },
      focusMinutes: 260,
    });
    api.getTodaySummary.mockReset().mockResolvedValue({ totalFocusMinutes: 42 });
    api.getSummary.mockReset().mockResolvedValue({ xpTotal: 1250, level: 7 });
  });

  it('loads real task, focus, XP, and level totals', async () => {
    render(<DashboardStatsRow />);

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('42 min')).toBeInTheDocument();
    expect(screen.getByText('Today · 260 min this week')).toBeInTheDocument();
    expect(screen.getByText('1,250 XP')).toBeInTheDocument();
    expect(screen.getByText('Level 7')).toBeInTheDocument();
    expect(api.getAnalytics).toHaveBeenCalledWith('7d');
    expect(api.getTasks).toHaveBeenCalledTimes(1);
    expect(api.getTodaySummary).toHaveBeenCalledTimes(1);
    expect(api.getSummary).toHaveBeenCalledTimes(1);
  });

  it('shows an error and retries failed requests', async () => {
    api.getAnalytics
      .mockRejectedValueOnce(new Error('Analytics unavailable'))
      .mockResolvedValueOnce({ taskCounts: { COMPLETED: 2, IN_PROGRESS: 1 }, focusMinutes: 60 });
    render(<DashboardStatsRow />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(api.getAnalytics).toHaveBeenCalledTimes(2);
  });
});
