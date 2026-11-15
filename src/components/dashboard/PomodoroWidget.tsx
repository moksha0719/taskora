import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Timer, Play, Pause, RotateCcw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PomodoroWidget: React.FC = () => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(2);
  const totalTargetSessions = 6;

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
      setCompletedSessions((prev) => Math.min(prev + 1, totalTargetSessions));
      setSecondsLeft(25 * 60);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(25 * 60);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = ((25 * 60 - secondsLeft) / (25 * 60)) * 100;
  const strokeDashoffset = 314 - (314 * progressPercent) / 100;

  return (
    <Card className="p-6 relative flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-rose-500">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
              Pomodoro Timer
            </h3>
          </div>

          <Link
            to="/focus"
            className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 group"
          >
            <span>Full Mode</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Center: Circular Ring + Plant Illustration */}
        <div className="flex items-center justify-center gap-4 py-2">
          {/* Circular Countdown Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background ring */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#FEE2E2"
                strokeWidth="7"
                className="dark:stroke-rose-950/40"
              />
              {/* Animated Progress ring */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#F43F5E"
                strokeWidth="7"
                strokeDasharray="314"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>

            {/* Inner Content matching reference */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-bold text-rose-400 dark:text-rose-300">
                Focus Time
              </span>
              <span className="text-2xl font-extrabold font-heading text-deep-purple dark:text-white my-0.5">
                {formatTime(secondsLeft)}
              </span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={toggleTimer}
                  className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm hover:bg-rose-600 active:scale-95 transition-all flex items-center gap-1"
                >
                  {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isActive ? 'Pause' : 'Start'}</span>
                </button>
                {secondsLeft < 25 * 60 && (
                  <button
                    onClick={resetTimer}
                    className="p-1 rounded-full text-muted-purple hover:bg-primary-subtle"
                    title="Reset"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Plant Illustration matching reference visual */}
          <div className="flex flex-col items-center justify-end h-32 select-none">
            <svg
              viewBox="0 0 64 90"
              className="w-16 h-24 transition-transform hover:scale-105 duration-300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Leaves */}
              <path
                d="M32 45 C32 25 18 10 18 10 C18 10 14 26 24 38 C28 42 32 45 32 45 Z"
                fill="#86EFAC"
              />
              <path
                d="M32 40 C32 20 46 8 46 8 C46 8 50 24 40 35 C36 38 32 40 32 40 Z"
                fill="#4ADE80"
              />
              <path
                d="M32 55 C32 35 22 25 22 25 C22 25 20 38 28 48 C30 50 32 55 32 55 Z"
                fill="#22C55E"
              />
              <path
                d="M32 52 C32 34 44 24 44 24 C44 24 44 38 36 48 C34 50 32 52 32 52 Z"
                fill="#86EFAC"
              />
              <path
                d="M32 30 C32 10 32 2 32 2 C32 2 34 10 34 22 C34 26 32 30 32 30 Z"
                fill="#4ADE80"
              />
              {/* Stem */}
              <line x1="32" y1="20" x2="32" y2="60" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
              {/* Pot */}
              <path
                d="M18 60 L46 60 L42 84 L22 84 Z"
                fill="#FDA4AF"
              />
              <rect x="15" y="58" width="34" height="6" rx="3" fill="#FB7185" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Session Counter & Bar */}
      <div className="mt-4 pt-3 border-t border-subtle">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-muted-purple">Today's Focus</span>
          <span className="text-deep-purple dark:text-white font-bold">
            {completedSessions} / {totalTargetSessions} sessions
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-rose-100 dark:bg-rose-950/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-rose-500 transition-all duration-500"
            style={{ width: `${(completedSessions / totalTargetSessions) * 100}%` }}
          />
        </div>
      </div>
    </Card>
  );
};
