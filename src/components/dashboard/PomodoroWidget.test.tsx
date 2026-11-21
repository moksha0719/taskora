import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PomodoroWidget } from './PomodoroWidget';

const api = vi.hoisted(() => ({
  getTodaySummary: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  focusApi: { getTodaySummary: api.getTodaySummary },
}));

const timer = vi.hoisted(() => ({
  focusMinutes: 25,
  breakMinutes: 5,
  mode: 'focus' as const,
  secondsLeft: 1500,
  isActive: false,
  starting: false,
  start: vi.fn(),
  pause: vi.fn(),
  reset: vi.fn(),
  lastCompletedSession: null as { id: string } | null,
}));

vi.mock('../../context/FocusTimerContext', () => ({
  useFocusTimer: () => timer,
}));

function renderWidget() {
  return render(<MemoryRouter><PomodoroWidget /></MemoryRouter>);
}

describe('PomodoroWidget daily focus summary', () => {
  beforeEach(() => {
    api.getTodaySummary.mockReset();
    timer.lastCompletedSession = null;
  });

  it('shows a loading state while the daily total is being fetched', () => {
    api.getTodaySummary.mockReturnValue(new Promise(() => {}));

    renderWidget();

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  it('shows the backend daily focus total', async () => {
    api.getTodaySummary.mockResolvedValue({
      date: '2026-11-21',
      timeZone: 'UTC',
      totalFocusMinutes: 95,
    });

    renderWidget();

    expect(await screen.findByText('95 min')).toBeInTheDocument();
    expect(screen.queryByText('No completed focus sessions today.')).not.toBeInTheDocument();
  });

  it('shows an empty state when the daily total is zero', async () => {
    api.getTodaySummary.mockResolvedValue({
      date: '2026-11-21',
      timeZone: 'UTC',
      totalFocusMinutes: 0,
    });

    renderWidget();

    expect(await screen.findByText('0 min')).toBeInTheDocument();
    expect(screen.getByText('No completed focus sessions today.')).toBeInTheDocument();
  });

  it('shows an error and retries the daily summary request', async () => {
    api.getTodaySummary
      .mockRejectedValueOnce(new Error('Daily summary unavailable'))
      .mockResolvedValueOnce({
        date: '2026-11-21',
        timeZone: 'UTC',
        totalFocusMinutes: 25,
      });

    renderWidget();

    expect(await screen.findByRole('alert')).toHaveTextContent('Daily summary unavailable');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(await screen.findByText('25 min')).toBeInTheDocument();
    expect(api.getTodaySummary).toHaveBeenCalledTimes(2);
  });
});
