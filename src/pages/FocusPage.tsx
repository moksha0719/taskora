import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressRing } from '../components/common/ProgressRing';
import { MascotBunny } from '../components/common/MascotBunny';
import { focusApi } from '../lib/api/client';
import { FocusSession } from '../types';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playChime } from '../lib/utils';

export const FocusPage: React.FC = () => {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [subject, setSubject] = useState('Distributed Systems');
  const [isZenMode, setIsZenMode] = useState(false);
  const [ambientSound, setAmbientSound] = useState<'silence' | 'lofi' | 'rain' | 'cafe'>('silence');
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    focusApi.getSessions().then(setSessions);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && secondsLeft === 0) {
      // Completed session
      setIsActive(false);
      playChime();

      if (mode === 'focus') {
        focusApi.logSession(subject, focusMinutes).then((logged) => {
          setSessions((prev) => [logged, ...prev]);
        });

        confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#9885E8', '#FEF3D6', '#DDF3E9'],
        });

        alert(`Focus session complete! You earned ${Math.round(focusMinutes * 2.5)} XP! Take a well-deserved break 🍵`);
        setMode('break');
        setSecondsLeft(breakMinutes * 60);
      } else {
        alert('Break completed! Ready for another focus sprint? 🚀');
        setMode('focus');
        setSecondsLeft(focusMinutes * 60);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsLeft, mode, focusMinutes, breakMinutes, subject]);

  const totalDuration = (mode === 'focus' ? focusMinutes : breakMinutes) * 60;
  const progressPercent = ((totalDuration - secondsLeft) / totalDuration) * 100;

  const formatDisplayTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsLeft((mode === 'focus' ? focusMinutes : breakMinutes) * 60);
  };

  const setTimerPreset = (fMins: number, bMins: number) => {
    setIsActive(false);
    setFocusMinutes(fMins);
    setBreakMinutes(bMins);
    setMode('focus');
    setSecondsLeft(fMins * 60);
  };

  return (
    <div className={`space-y-6 pb-12 animate-fade-in ${isZenMode ? 'fixed inset-0 z-50 bg-dream-bg dark:bg-[#130E26] p-8 flex flex-col justify-center items-center overflow-hidden' : ''}`}>
      {/* Zen Mode Exit button */}
      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-[#1E163B] shadow-lavender text-deep-purple hover:scale-105 transition-all"
        >
          <Minimize2 className="w-5 h-5 text-primary" />
        </button>
      )}

      {/* Header if not in Zen mode */}
      {!isZenMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
              <span>Focus Mode</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-soft-peach text-soft-peach-text font-bold">
                FR-06 Pomodoro & XP
              </span>
            </h2>
            <p className="text-xs text-muted-purple mt-0.5">
              Enter undivided flow state with circular interval timers, ambient audio, and calm Zen mode.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            pill
            onClick={() => setIsZenMode(true)}
            className="text-xs bg-white/70"
          >
            <Maximize2 className="w-3.5 h-3.5 text-primary" />
            <span>Calm Zen Mode</span>
          </Button>
        </div>
      )}

      {/* Main Focus Dial Card */}
      <Card className="p-8 text-center max-w-2xl mx-auto w-full shadow-lavender-lg relative overflow-hidden">
        {/* Mode Selector Pills */}
        <div className="inline-flex p-1 rounded-full bg-primary-subtle/50 dark:bg-primary/20 mb-6">
          <button
            onClick={() => {
              setIsActive(false);
              setMode('focus');
              setSecondsLeft(focusMinutes * 60);
            }}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              mode === 'focus'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-purple hover:text-deep-purple'
            }`}
          >
            Focus Sprint ({focusMinutes}m)
          </button>
          <button
            onClick={() => {
              setIsActive(false);
              setMode('break');
              setSecondsLeft(breakMinutes * 60);
            }}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              mode === 'break'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted-purple hover:text-deep-purple'
            }`}
          >
            Rest Break ({breakMinutes}m)
          </button>
        </div>

        {/* Circular Progress Ring */}
        <div className="my-4 flex justify-center">
          <ProgressRing
            progress={progressPercent}
            size={260}
            strokeWidth={14}
            circleColor={mode === 'focus' ? 'var(--color-primary)' : '#63B995'}
          >
            <div className="space-y-1">
              <span className="text-5xl font-extrabold font-heading text-deep-purple dark:text-white tracking-tight">
                {formatDisplayTime(secondsLeft)}
              </span>
              <span className="text-xs font-semibold text-primary block">
                {mode === 'focus' ? `Focusing on ${subject}` : 'Recharge & Breathe 🍵'}
              </span>
              <MascotBunny mood={mode === 'focus' ? 'focus' : 'calm'} size={50} showSparkles={false} />
            </div>
          </ProgressRing>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={handleReset}
            className="p-3 rounded-full text-muted-purple hover:bg-primary-subtle hover:text-primary transition-all"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <Button
            size="lg"
            pill
            onClick={() => setIsActive(!isActive)}
            className="px-8 py-3 text-base font-bold shadow-lavender"
          >
            {isActive ? (
              <>
                <Pause className="w-5 h-5 mr-1" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-1 fill-current" />
                <span>{secondsLeft === totalDuration ? 'Start Focus' : 'Resume'}</span>
              </>
            )}
          </Button>

          <button
            onClick={() => {
              setSecondsLeft(0);
            }}
            className="p-3 rounded-full text-muted-purple hover:bg-primary-subtle hover:text-primary transition-all"
            title="Skip interval"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>

        {/* Subject and Ambient Sound Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-subtle text-left">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
              Focus Subject Tag
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            >
              <option value="Distributed Systems">Distributed Systems (CS 301)</option>
              <option value="Interaction Design">Interaction Design (DES 210)</option>
              <option value="Discrete Mathematics">Discrete Mathematics (MATH 240)</option>
              <option value="Thesis Research">Thesis Research</option>
              <option value="General Reading">General Reading & Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
              Ambient Audio Background
            </label>
            <select
              value={ambientSound}
              onChange={(e) => setAmbientSound(e.target.value as 'silence' | 'lofi' | 'rain' | 'cafe')}
              className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            >
              <option value="silence">Muted / Silence 🤫</option>
              <option value="lofi">Lo-Fi Study Beats 🎧</option>
              <option value="rain">Soft Rainy Window 🌧️</option>
              <option value="cafe">Quiet Campus Café ☕</option>
            </select>
          </div>
        </div>

        {/* Duration Presets */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-[11px] text-muted-purple mr-1">Presets:</span>
          <button
            onClick={() => setTimerPreset(25, 5)}
            className={`text-xs px-3 py-1 rounded-full border ${focusMinutes === 25 ? 'bg-primary-subtle text-primary border-primary' : 'border-subtle text-muted-purple'}`}
          >
            25m / 5m (Standard)
          </button>
          <button
            onClick={() => setTimerPreset(50, 10)}
            className={`text-xs px-3 py-1 rounded-full border ${focusMinutes === 50 ? 'bg-primary-subtle text-primary border-primary' : 'border-subtle text-muted-purple'}`}
          >
            50m / 10m (Deep Work)
          </button>
          <button
            onClick={() => setTimerPreset(15, 3)}
            className={`text-xs px-3 py-1 rounded-full border ${focusMinutes === 15 ? 'bg-primary-subtle text-primary border-primary' : 'border-subtle text-muted-purple'}`}
          >
            15m / 3m (Sprint)
          </button>
        </div>
      </Card>

      {/* Focus History & XP Awards */}
      {!isZenMode && (
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-subtle">
            <h4 className="text-base font-bold font-heading text-deep-purple dark:text-white">
              Recent Focus Log & XP
            </h4>
            <span className="text-xs font-semibold text-primary">
              Today's Focus: <strong>1h 45m (260 XP)</strong>
            </span>
          </div>

          <div className="space-y-2">
            {sessions.map((ses) => (
              <div
                key={ses.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-soft-peach text-soft-peach-text flex items-center justify-center font-bold">
                    ⏱️
                  </div>
                  <div>
                    <h5 className="font-bold text-deep-purple dark:text-white">
                      {ses.subject}
                    </h5>
                    <span className="text-[11px] text-muted-purple">
                      Duration: {ses.durationMinutes} minutes
                    </span>
                  </div>
                </div>

                <Badge variant="mint">
                  +{ses.xpEarned} XP Awarded
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
