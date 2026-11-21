import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getAnalytics: vi.fn(),
  getWidgets: vi.fn(),
  saveWidgets: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  tasksApi: { getTasks: api.getTasks },
  analyticsApi: { getAnalytics: api.getAnalytics },
  dashboardApi: { getWidgets: api.getWidgets, saveWidgets: api.saveWidgets },
}));

vi.mock('../components/dashboard/ProductivityChart', () => ({ ProductivityChart: () => null }));
vi.mock('../components/dashboard/TodoWidget', () => ({ TodoWidget: () => null }));
vi.mock('../components/dashboard/RecentActivityWidget', () => ({ RecentActivityWidget: () => null }));
vi.mock('../components/dashboard/BunnyMotivationCard', () => ({ BunnyMotivationCard: () => null }));
vi.mock('../components/dashboard/WidgetCustomizeModal', () => ({ WidgetCustomizeModal: () => null }));
vi.mock('../components/dashboard/SemesterCalendarWidget', () => ({ SemesterCalendarWidget: () => null }));
vi.mock('../components/dashboard/PomodoroWidget', () => ({ PomodoroWidget: () => null }));
vi.mock('../components/dashboard/FlashcardWidget', () => ({ FlashcardWidget: () => null }));
vi.mock('../components/dashboard/ExamPrepWidget', () => ({ ExamPrepWidget: () => null }));
vi.mock('../components/dashboard/StudyChecklistWidget', () => ({ StudyChecklistWidget: () => null }));

describe('DashboardPage', () => {
  beforeEach(() => {
    api.getTasks.mockReset();
    api.getAnalytics.mockReset();
    api.getWidgets.mockReset().mockReturnValue([]);
    api.saveWidgets.mockReset();
  });

  it('shows task and focus totals returned by the authenticated APIs', async () => {
    api.getTasks.mockResolvedValue([
      { id: 'task-1', status: 'completed' },
      { id: 'task-2', status: 'in_progress' },
      { id: 'task-3', status: 'todo' },
    ]);
    api.getAnalytics.mockResolvedValue({ focusMinutes: 95 });

    render(<DashboardPage />);

    await waitFor(() => expect(
      screen.getByText('Completed Tasks').parentElement?.querySelector('.text-2xl')?.textContent
    ).toBe('1'));
    expect(screen.getByText('Open Tasks').parentElement?.querySelector('.text-2xl')?.textContent).toBe('2');
    expect(screen.getByText('Total Tasks').parentElement?.querySelector('.text-2xl')?.textContent).toBe('3');
    expect(screen.getByText('Focus Time (7d)').parentElement?.querySelector('.text-2xl')?.textContent).toBe('1h 35m');
    expect(api.getAnalytics).toHaveBeenCalledWith('7d');
  });

  it('shows zero values when the authenticated account has no records', async () => {
    api.getTasks.mockResolvedValue([]);
    api.getAnalytics.mockResolvedValue({ focusMinutes: 0 });

    render(<DashboardPage />);

    await waitFor(() => expect(
      screen.getByText('Total Tasks').parentElement?.querySelector('.text-2xl')?.textContent
    ).toBe('0'));
    expect(screen.getByText('Completed Tasks').parentElement?.querySelector('.text-2xl')?.textContent).toBe('0');
    expect(screen.getByText('Open Tasks').parentElement?.querySelector('.text-2xl')?.textContent).toBe('0');
    expect(screen.getByText('Focus Time (7d)').parentElement?.querySelector('.text-2xl')?.textContent).toBe('0m');
  });
});
