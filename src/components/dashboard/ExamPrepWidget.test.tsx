import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExamPrepWidget } from './ExamPrepWidget';

const api = vi.hoisted(() => ({ getActivePlan: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ studyPlansApi: api }));

describe('ExamPrepWidget', () => {
  beforeEach(() => api.getActivePlan.mockReset());

  it('shows subjects from the active account study plan', async () => {
    api.getActivePlan.mockResolvedValue({
      id: 'plan-1',
      title: 'My current plan',
      startDate: '2026-11-20',
      endDate: '2026-12-20',
      subjects: [{ id: 'subject-1', name: 'Discrete Mathematics', targetMinutesPerWeek: 600 }],
    });
    render(<MemoryRouter><ExamPrepWidget /></MemoryRouter>);

    expect(await screen.findByText('My current plan')).toBeInTheDocument();
    expect(screen.getByText('Discrete Mathematics')).toBeInTheDocument();
    expect(screen.getByText('10 h/week')).toBeInTheDocument();
    expect(screen.queryByText('Data Structures Final Exam')).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no active plan', async () => {
    api.getActivePlan.mockResolvedValue(null);
    render(<MemoryRouter><ExamPrepWidget /></MemoryRouter>);

    expect(await screen.findByText('No active study plan')).toBeInTheDocument();
  });
});
