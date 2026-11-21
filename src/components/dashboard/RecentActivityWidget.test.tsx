import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentActivityWidget } from './RecentActivityWidget';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getNotes: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  tasksApi: { getTasks: api.getTasks },
  notesApi: { getNotes: api.getNotes },
  focusApi: { getSessions: api.getSessions },
}));

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    api.getTasks.mockReset();
    api.getNotes.mockReset();
    api.getSessions.mockReset();
  });

  it('derives activity from the account tasks, notes, and focus sessions', async () => {
    api.getTasks.mockResolvedValue([{
      id: 'task-1',
      title: 'Read my notes',
      status: 'completed',
      updatedAt: '2026-11-20T08:00:00.000Z',
    }]);
    api.getNotes.mockResolvedValue([]);
    api.getSessions.mockResolvedValue([]);

    render(<RecentActivityWidget />);

    expect(await screen.findByText('Completed task: Read my notes')).toBeInTheDocument();
    expect(screen.queryByText(/Website Redesign|Sarah|report\.pdf/)).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no activity', async () => {
    api.getTasks.mockResolvedValue([]);
    api.getNotes.mockResolvedValue([]);
    api.getSessions.mockResolvedValue([]);

    render(<RecentActivityWidget />);

    expect(await screen.findByText(/No recent activity yet/)).toBeInTheDocument();
  });
});
