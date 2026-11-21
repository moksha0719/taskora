import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { focusApi } from '../lib/api/client';
import type { FocusSession } from '../types';
import { useAuth } from './AuthContext';

type FocusMode = 'focus' | 'break';

interface TimerSnapshot {
  focusMinutes: number;
  breakMinutes: number;
  mode: FocusMode;
  subject: string;
  remainingSeconds: number;
  active: boolean;
  endsAt: number | null;
  sessionToken: string | null;
  pendingCompletionToken: string | null;
}

interface FocusTimerContextValue {
  focusMinutes: number;
  breakMinutes: number;
  mode: FocusMode;
  subject: string;
  subjectLocked: boolean;
  secondsLeft: number;
  isActive: boolean;
  starting: boolean;
  persistenceError: string | null;
  completionError: string | null;
  lastCompletedSession: FocusSession | null;
  start: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setPreset: (focusMinutes: number, breakMinutes: number) => void;
  setMode: (mode: FocusMode) => void;
  setSubject: (subject: string) => void;
  retryCompletion: () => void;
}

const STORAGE_PREFIX = 'taskora.focus-timer.';
const DEFAULT_SNAPSHOT: TimerSnapshot = {
  focusMinutes: 25,
  breakMinutes: 5,
  mode: 'focus',
  subject: 'Study session',
  remainingSeconds: 25 * 60,
  active: false,
  endsAt: null,
  sessionToken: null,
  pendingCompletionToken: null,
};

const FocusTimerContext = createContext<FocusTimerContextValue | undefined>(undefined);

function isTimerSnapshot(value: unknown): value is TimerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const timer = value as Partial<TimerSnapshot>;
  return Number.isInteger(timer.focusMinutes) && Number.isInteger(timer.breakMinutes) &&
    (timer.mode === 'focus' || timer.mode === 'break') &&
    typeof timer.subject === 'string' &&
    Number.isInteger(timer.remainingSeconds) &&
    typeof timer.active === 'boolean' &&
    (timer.endsAt === null || typeof timer.endsAt === 'number') &&
    (timer.sessionToken === null || typeof timer.sessionToken === 'string') &&
    (timer.pendingCompletionToken === null || typeof timer.pendingCompletionToken === 'string');
}

export const FocusTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [timer, setTimer] = useState<TimerSnapshot>(DEFAULT_SNAPSHOT);
  const [now, setNow] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [lastCompletedSession, setLastCompletedSession] = useState<FocusSession | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const completionInProgress = useRef<string | null>(null);
  const startingRef = useRef(false);
  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;
  const currentUserId = useRef<string | null>(user?.id || null);
  currentUserId.current = user?.id || null;

  useEffect(() => {
    setCompletionError(null);
    setLastCompletedSession(null);
    setPersistenceError(null);
    setLoadedStorageKey(null);
    completionInProgress.current = null;
    if (!storageKey) {
      setTimer(DEFAULT_SNAPSHOT);
      return;
    }

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) {
        setTimer({ ...DEFAULT_SNAPSHOT, subject: user?.name ? 'Study session' : '' });
        setLoadedStorageKey(storageKey);
        return;
      }
      const parsed: unknown = JSON.parse(saved);
      if (!isTimerSnapshot(parsed)) {
        throw new Error('Saved focus timer data is invalid.');
      }
      setTimer(parsed);
      setLoadedStorageKey(storageKey);
    } catch (cause) {
      setPersistenceError(cause instanceof Error ? cause.message : 'Unable to restore the saved focus timer.');
      setTimer(DEFAULT_SNAPSHOT);
      setLoadedStorageKey(storageKey);
    }
  }, [storageKey, user?.name]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(timer));
      setPersistenceError(null);
    } catch (cause) {
      setPersistenceError(cause instanceof Error ? cause.message : 'Unable to save the focus timer.');
    }
  }, [storageKey, loadedStorageKey, timer]);

  useEffect(() => {
    if (!timer.active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timer.active]);

  const secondsLeft = timer.active && timer.endsAt !== null
    ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000))
    : timer.remainingSeconds;

  useEffect(() => {
    if (!timer.active || secondsLeft > 0) return;
    const token = timer.mode === 'focus' ? timer.sessionToken : null;
    setTimer((previous) => ({
      ...previous,
      mode: previous.mode === 'focus' ? 'break' : 'focus',
      remainingSeconds: (previous.mode === 'focus' ? previous.breakMinutes : previous.focusMinutes) * 60,
      active: false,
      endsAt: null,
      sessionToken: null,
      pendingCompletionToken: token || previous.pendingCompletionToken,
    }));
  }, [secondsLeft, timer.active, timer.mode, timer.sessionToken]);

  useEffect(() => {
    const token = timer.pendingCompletionToken;
    const requestUserId = user?.id;
    if (!token || completionInProgress.current === token) return;
    completionInProgress.current = token;
    setCompletionError(null);
    focusApi.completeSession(token)
      .then((session) => {
        if (currentUserId.current !== requestUserId) return;
        setLastCompletedSession(session);
        setTimer((previous) => previous.pendingCompletionToken === token
          ? { ...previous, pendingCompletionToken: null }
          : previous);
      })
      .catch((cause: unknown) => {
        if (currentUserId.current === requestUserId) {
          setCompletionError(cause instanceof Error ? cause.message : 'Unable to save the completed focus session.');
        }
      })
      .finally(() => {
        if (completionInProgress.current === token) completionInProgress.current = null;
      });
  }, [timer.pendingCompletionToken, retryCount, user?.id]);

  const pause = useCallback(() => {
    setTimer((previous) => ({
      ...previous,
      remainingSeconds: previous.active && previous.endsAt !== null
        ? Math.max(0, Math.ceil((previous.endsAt - Date.now()) / 1000))
        : previous.remainingSeconds,
      active: false,
      endsAt: null,
    }));
  }, []);

  const start = useCallback(async () => {
    if (timer.active || startingRef.current) return;
    if (timer.mode === 'break' || timer.sessionToken) {
      setTimer((previous) => ({
        ...previous,
        active: true,
        endsAt: Date.now() + previous.remainingSeconds * 1000,
      }));
      return;
    }

    const requestUserId = user?.id;
    startingRef.current = true;
    setStarting(true);
    setCompletionError(null);
    try {
      const sessionToken = await focusApi.startSession(timer.subject || 'Study session', timer.focusMinutes);
      if (currentUserId.current !== requestUserId) return;
      setTimer((previous) => ({
        ...previous,
        active: true,
        sessionToken,
        endsAt: Date.now() + previous.remainingSeconds * 1000,
      }));
    } catch (cause) {
      throw cause;
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [timer.active, timer.focusMinutes, timer.mode, timer.remainingSeconds, timer.sessionToken, timer.subject, user?.id]);

  const reset = useCallback(() => {
    setTimer((previous) => ({
      ...previous,
      remainingSeconds: (previous.mode === 'focus' ? previous.focusMinutes : previous.breakMinutes) * 60,
      active: false,
      endsAt: null,
      sessionToken: null,
    }));
  }, []);

  const skip = useCallback(() => {
    setTimer((previous) => {
      const mode = previous.mode === 'focus' ? 'break' : 'focus';
      return {
        ...previous,
        mode,
        remainingSeconds: (mode === 'focus' ? previous.focusMinutes : previous.breakMinutes) * 60,
        active: false,
        endsAt: null,
        sessionToken: null,
      };
    });
  }, []);

  const setPreset = useCallback((focusMinutes: number, breakMinutes: number) => {
    if (!Number.isInteger(focusMinutes) || !Number.isInteger(breakMinutes) || focusMinutes < 1 || breakMinutes < 1) return;
    setTimer((previous) => ({
      ...previous,
      focusMinutes,
      breakMinutes,
      mode: 'focus',
      remainingSeconds: focusMinutes * 60,
      active: false,
      endsAt: null,
      sessionToken: null,
    }));
  }, []);

  const setMode = useCallback((mode: FocusMode) => {
    setTimer((previous) => ({
      ...previous,
      mode,
      remainingSeconds: (mode === 'focus' ? previous.focusMinutes : previous.breakMinutes) * 60,
      active: false,
      endsAt: null,
      sessionToken: null,
    }));
  }, []);

  const setSubject = useCallback((subject: string) => {
    setTimer((previous) => previous.active || previous.sessionToken
      ? previous
      : { ...previous, subject });
  }, []);

  const retryCompletion = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const value = useMemo<FocusTimerContextValue>(() => ({
    focusMinutes: timer.focusMinutes,
    breakMinutes: timer.breakMinutes,
    mode: timer.mode,
    subject: timer.subject,
    subjectLocked: timer.active || Boolean(timer.sessionToken) || starting,
    secondsLeft,
    isActive: timer.active,
    starting,
    persistenceError,
    completionError,
    lastCompletedSession,
    start,
    pause,
    reset,
    skip,
    setPreset,
    setMode,
    setSubject,
    retryCompletion,
  }), [
    timer, secondsLeft, starting, persistenceError, completionError,
    lastCompletedSession, start, pause, reset, skip, setPreset, setMode, setSubject, retryCompletion,
  ]);

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
};

export function useFocusTimer(): FocusTimerContextValue {
  const context = useContext(FocusTimerContext);
  if (!context) throw new Error('useFocusTimer must be used within a FocusTimerProvider');
  return context;
}
