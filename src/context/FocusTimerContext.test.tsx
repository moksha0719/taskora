import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusTimerProvider, useFocusTimer } from './FocusTimerContext';
import { focusApi } from '../lib/api/client';

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Study User' } }),
}));

vi.mock('../lib/api/client', () => ({
  focusApi: {
    startSession: vi.fn(),
    completeSession: vi.fn(),
  },
}));

const TimerControls: React.FC = () => {
  const timer = useFocusTimer();
  return (
    <div>
      <output aria-label="seconds remaining">{timer.secondsLeft}</output>
      <output aria-label="timer status">{timer.isActive ? 'active' : 'paused'}</output>
      <button type="button" onClick={() => void timer.start()}>Start timer</button>
      <button type="button" onClick={timer.pause}>Pause timer</button>
      <button type="button" onClick={() => timer.setPreset(1, 1)}>Short preset</button>
    </div>
  );
};

function renderTimer() {
  return render(<FocusTimerProvider><TimerControls /></FocusTimerProvider>);
}

function renderNavigableTimer() {
  return render(
    <FocusTimerProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<><TimerControls /><Link to="/focus">Open Focus</Link></>} />
          <Route path="/focus" element={<><TimerControls /><Link to="/dashboard">Back to dashboard</Link></>} />
        </Routes>
      </MemoryRouter>
    </FocusTimerProvider>
  );
}

describe('FocusTimerProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T08:00:00.000Z'));
    vi.mocked(focusApi.startSession).mockResolvedValue('signed-focus-token');
    vi.mocked(focusApi.completeSession).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('shares and restores the active deadline across timer consumer remounts', async () => {
    const first = renderTimer();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    });
    expect(screen.getByLabelText('timer status')).toHaveTextContent('active');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByLabelText('seconds remaining')).toHaveTextContent('1495');
    expect(focusApi.startSession).toHaveBeenCalledWith('Study session', 25);

    first.unmount();
    renderTimer();

    expect(screen.getByLabelText('seconds remaining')).toHaveTextContent('1495');
    expect(screen.getByLabelText('timer status')).toHaveTextContent('active');
  });

  it('keeps the active timer state when navigating between dashboard and focus pages', async () => {
    renderNavigableTimer();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    fireEvent.click(screen.getByRole('link', { name: 'Open Focus' }));
    expect(screen.getByLabelText('timer status')).toHaveTextContent('active');
    expect(screen.getByLabelText('seconds remaining')).toHaveTextContent('1495');

    fireEvent.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    expect(screen.getByLabelText('timer status')).toHaveTextContent('active');
    expect(screen.getByLabelText('seconds remaining')).toHaveTextContent('1495');
    expect(focusApi.startSession).toHaveBeenCalledTimes(1);
  });

  it('preserves elapsed time when paused and does not create another server session on resume', async () => {
    renderTimer();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    });
    act(() => {
      vi.advanceTimersByTime(3000);
      fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }));
    });
    expect(screen.getByLabelText('seconds remaining')).toHaveTextContent('1497');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    });
    expect(screen.getByLabelText('timer status')).toHaveTextContent('active');
    expect(focusApi.startSession).toHaveBeenCalledTimes(1);
  });

  it('records a completed focus interval and switches to its configured break', async () => {
    vi.mocked(focusApi.completeSession).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      subject: 'Study session',
      durationMinutes: 1,
      completedAt: new Date().toISOString(),
      xpEarned: 3,
    });
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Short preset' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    });

    await act(async () => {
      vi.setSystemTime(new Date(Date.now() + 60_000));
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByLabelText('timer status')).toHaveTextContent('paused');
    expect(focusApi.completeSession).toHaveBeenCalledWith('signed-focus-token');
    expect(sessionStorage.getItem('taskora.focus-timer.user-1')).toContain('"mode":"break"');
  });
});
