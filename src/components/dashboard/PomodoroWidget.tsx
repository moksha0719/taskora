import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Card } from '../common/Card';
import { useFocusTimer } from '../../context/FocusTimerContext';
import { focusApi } from '../../lib/api/client';
import type { FocusSession } from '../../types';

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

export const PomodoroWidget: React.FC = () => {
  const {
    focusMinutes, breakMinutes, mode, secondsLeft, isActive, starting,
    start, pause, reset, lastCompletedSession,
  } = useFocusTimer();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    focusApi.getSessions()
      .then((result) => {
        if (active) setSessions(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load focus sessions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastCompletedSession) return;
    setSessions((previous) => [
      lastCompletedSession,
      ...previous.filter((session) => session.id !== lastCompletedSession.id),
    ]);
  }, [lastCompletedSession]);

  const todaySessions = useMemo(
    () => sessions.filter((session) => new Date(session.completedAt).toDateString() === new Date().toDateString()),
    [sessions]
  );
  const todayMinutes = todaySessions.reduce((total, session) => total + session.durationMinutes, 0);
  const totalSeconds = (mode === 'focus' ? focusMinutes : breakMinutes) * 60;
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, (totalSeconds - secondsLeft) / totalSeconds)) : 0;
  const circumference = 314;

  const handleToggle = async () => {
    setError(null);
    try {
      if (isActive) pause();
      else await start();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start the focus timer.');
    }
  };

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-rose-500 dark:bg-pink-900/30">
              <Timer className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">Focus Timer</h3>
          </div>
          <Link to="/focus" className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
            Full Mode <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center justify-center py-2">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#FEE2E2" strokeWidth="7" className="dark:stroke-rose-950/40" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#F43F5E" strokeWidth="7"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-rose-400">{mode === 'focus' ? 'Focus' : 'Break'}</span>
              <span className="my-0.5 text-2xl font-extrabold font-heading text-deep-purple dark:text-white" aria-live="off">
                {formatTime(secondsLeft)}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => void handleToggle()} disabled={starting}
                  className="flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                  {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                  {starting ? 'Starting...' : isActive ? 'Pause' : secondsLeft === totalSeconds ? 'Start' : 'Resume'}
                </button>
                {secondsLeft !== totalSeconds && (
                  <button type="button" onClick={reset} className="rounded-full p-1 text-muted-purple hover:bg-primary-subtle" aria-label="Reset focus timer">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-subtle pt-3">
        {error && <p role="alert" className="mb-2 text-xs text-rose-600">{error}</p>}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-purple">Today&apos;s focus</span>
          <span className="font-bold text-deep-purple dark:text-white">
            {loading ? 'Loading...' : `${todayMinutes} min · ${todaySessions.length} sessions`}
          </span>
        </div>
        {!loading && todaySessions.length === 0 && !error && (
          <p className="mt-1 text-[11px] text-muted-purple">No completed focus sessions today.</p>
        )}
      </div>
    </Card>
  );
};
