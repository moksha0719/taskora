import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_DASHBOARD_WIDGETS } from '../lib/defaults';
import { DashboardPage } from './DashboardPage';

const api = vi.hoisted(() => ({
  createTask: vi.fn(),
  getWidgets: vi.fn(),
  saveWidgets: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  tasksApi: { createTask: api.createTask },
  dashboardApi: { getWidgets: api.getWidgets, saveWidgets: api.saveWidgets },
}));

vi.mock('../components/dashboard/DashboardStatsRow', () => ({
  DashboardStatsRow: () => <div>Dashboard Stats Row</div>,
}));
vi.mock('../components/dashboard/ProductivityChart', () => ({
  ProductivityChart: () => <div>Productivity Chart</div>,
}));
vi.mock('../components/dashboard/TodoWidget', () => ({
  TodoWidget: () => <div>To-Do List</div>,
}));
vi.mock('../components/dashboard/RecentActivityWidget', () => ({ RecentActivityWidget: () => null }));
vi.mock('../components/dashboard/BunnyMotivationCard', () => ({ BunnyMotivationCard: () => null }));
vi.mock('../components/dashboard/SemesterCalendarWidget', () => ({
  SemesterCalendarWidget: () => <div>Calendar Widget</div>,
}));
vi.mock('../components/dashboard/PomodoroWidget', () => ({
  PomodoroWidget: () => <div>Focus Timer Widget</div>,
}));
vi.mock('../components/dashboard/StudyPlanWidget', () => ({
  StudyPlanWidget: () => <div>Study Plan Widget</div>,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    api.createTask.mockReset();
    api.getWidgets.mockReset().mockReturnValue(
      DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({ ...widget })),
    );
    api.saveWidgets.mockReset();
  });

  it('shows the KPI, chart, task, and requested bottom widgets without a study checklist', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Dashboard Stats Row')).toBeInTheDocument();
    expect(screen.getByText('Productivity Chart')).toBeInTheDocument();
    expect(screen.getByText('To-Do List')).toBeInTheDocument();
    expect(screen.getByText('Calendar Widget')).toBeInTheDocument();
    expect(screen.getByText('Focus Timer Widget')).toBeInTheDocument();
    expect(screen.getByText('Study Plan Widget')).toBeInTheDocument();
    expect(DEFAULT_DASHBOARD_WIDGETS.map((widget) => widget.id)).not.toContain('study_checklist');

    fireEvent.click(screen.getByRole('button', { name: 'Customize Widgets' }));
    expect(screen.queryByRole('checkbox', { name: 'Show Study Checklist' })).not.toBeInTheDocument();
  });

  it('shows an inline error and preserves the task when quick creation fails', async () => {
    api.createTask.mockRejectedValueOnce(new Error('Task could not be saved.'));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Implement Raft heartbeat interval ⏱️'), {
      target: { value: 'Review lecture notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Task could not be saved.');
    expect(screen.getByPlaceholderText('e.g. Implement Raft heartbeat interval ⏱️'))
      .toHaveValue('Review lecture notes');
    expect(api.createTask).toHaveBeenCalledTimes(1);
  });

  it('shows the study plan by default and removes it when disabled', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Study Plan Widget')).toBeInTheDocument();
    expect(DEFAULT_DASHBOARD_WIDGETS.map((widget) => widget.id)).not.toContain('flashcards');
    expect(DEFAULT_DASHBOARD_WIDGETS.map((widget) => widget.id)).not.toContain('ai_assistant');

    fireEvent.click(screen.getByRole('button', { name: 'Customize Widgets' }));
    const studyPlanCheckbox = screen.getByRole('checkbox', { name: 'Show Study Plan' });
    expect(studyPlanCheckbox).toBeChecked();
    fireEvent.click(studyPlanCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }));

    await waitFor(() => {
      expect(screen.queryByText('Study Plan Widget')).not.toBeInTheDocument();
    });
    expect(api.saveWidgets).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'study_plan', enabled: false })]),
    );
  });
});
