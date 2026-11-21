import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudyChecklistWidget } from './StudyChecklistWidget';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({ tasksApi: api }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const task = {
  id: 'task-1',
  userId: 'user-1',
  title: 'Review actual notes',
  description: undefined,
  dueDate: '',
  priority: 'medium' as const,
  status: 'todo' as const,
  category: 'Study',
  tags: [],
  subtasks: [],
  createdAt: '2026-11-20T08:00:00.000Z',
  updatedAt: '2026-11-20T08:00:00.000Z',
};

describe('StudyChecklistWidget', () => {
  beforeEach(() => {
    api.getTasks.mockReset();
    api.updateTask.mockReset();
    api.createTask.mockReset();
  });

  it('loads user tasks and persists checklist completion through the API', async () => {
    api.getTasks.mockResolvedValue([task]);
    api.updateTask.mockResolvedValue({ ...task, status: 'completed' });
    render(<MemoryRouter><StudyChecklistWidget /></MemoryRouter>);

    const taskButton = await screen.findByRole('button', { name: /Review actual notes/ });
    fireEvent.click(taskButton);

    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith('task-1', { status: 'completed' }));
    await waitFor(() => expect(taskButton).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows an empty state when the account has no tasks', async () => {
    api.getTasks.mockResolvedValue([]);
    render(<MemoryRouter><StudyChecklistWidget /></MemoryRouter>);

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });
});
