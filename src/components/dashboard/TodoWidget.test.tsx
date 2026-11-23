import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoWidget } from './TodoWidget';

const api = vi.hoisted(() => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  toggleTaskCompleted: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({ tasksApi: api }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const task = {
  id: 'task-1',
  userId: 'user-1',
  title: 'Review lecture notes',
  dueDate: '2026-11-23',
  priority: 'medium' as const,
  status: 'todo' as const,
  category: 'General',
  tags: [],
  subtasks: [],
  createdAt: '2026-11-23T09:00:00.000Z',
  updatedAt: '2026-11-23T09:00:00.000Z',
};

describe('TodoWidget', () => {
  beforeEach(() => {
    api.getTasks.mockReset().mockResolvedValue([task]);
    api.createTask.mockReset();
    api.toggleTaskCompleted.mockReset();
  });

  it('loads tasks from the API and saves quick-added tasks to the backend', async () => {
    const createdTask = { ...task, id: 'task-2', title: 'Prepare flashcards' };
    api.createTask.mockResolvedValue(createdTask);
    render(<TodoWidget />);

    expect(await screen.findByText('Review lecture notes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add new task' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Finish reading paper 📚'), {
      target: { value: 'Prepare flashcards' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Prepare flashcards',
        status: 'todo',
      }));
    });
    expect(await screen.findByText('Prepare flashcards')).toBeInTheDocument();
    expect(api.getTasks).toHaveBeenCalledTimes(1);
  });
});
