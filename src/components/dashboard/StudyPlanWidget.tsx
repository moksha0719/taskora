import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { Card } from '../common/Card';
import { STUDY_PLANS_UPDATED_EVENT, studyPlansApi } from '../../lib/api/client';
import type { ApiStudyPlan, StudyDayCode } from '../../types';

const WEEKDAY_CODES: StudyDayCode[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const COMPLETION_PAGE_SIZE = 100;
const COMPLETION_RANGE_DAYS = 365;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load your study plan.';
}

function formatWeeklyTarget(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h/week`;
}

function formatPlanDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function countScheduledSessions(plan: ApiStudyPlan): number {
  const scheduleItems = plan.subjects.flatMap((subject) => subject.scheduleItems || []);
  if (scheduleItems.length === 0) return 0;

  const firstDay = new Date(`${plan.startDate.slice(0, 10)}T00:00:00.000Z`);
  const lastDay = new Date(`${plan.endDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(firstDay.getTime()) || Number.isNaN(lastDay.getTime()) || firstDay > lastDay) return 0;

  const sessionsPerWeekday = new Map<StudyDayCode, number>();
  scheduleItems.forEach(({ dayOfWeek }) => {
    sessionsPerWeekday.set(dayOfWeek, (sessionsPerWeekday.get(dayOfWeek) || 0) + 1);
  });

  let total = 0;
  for (let day = firstDay.getTime(); day <= lastDay.getTime(); day += 24 * 60 * 60 * 1000) {
    const weekday = WEEKDAY_CODES[new Date(day).getUTCDay()];
    total += sessionsPerWeekday.get(weekday) || 0;
  }
  return total;
}

async function loadPlanCompletions(plan: ApiStudyPlan) {
  const completions = [];
  const rangeEnd = addDays(plan.endDate, 1);
  let rangeStart = plan.startDate.slice(0, 10);

  while (rangeStart < rangeEnd) {
    const rangeLimit = addDays(rangeStart, COMPLETION_RANGE_DAYS);
    const rangeTo = rangeLimit < rangeEnd ? rangeLimit : rangeEnd;
    let page = 1;

    while (true) {
      const pageCompletions = await studyPlansApi.getCompletions(
        plan.id,
        rangeStart,
        rangeTo,
        { page, limit: COMPLETION_PAGE_SIZE },
      );
      completions.push(...pageCompletions);
      if (pageCompletions.length < COMPLETION_PAGE_SIZE) break;
      page += 1;
    }

    rangeStart = rangeTo;
  }

  return completions;
}

export const StudyPlanWidget: React.FC = () => {
  const [studyPlan, setStudyPlan] = useState<ApiStudyPlan | null>(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadStudyPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activePlan = await studyPlansApi.getActivePlan();
      setStudyPlan(activePlan);
      if (!activePlan) {
        setCompletedSessions(0);
        setTotalSessions(0);
        return;
      }

      const scheduledSessions = countScheduledSessions(activePlan);
      setTotalSessions(scheduledSessions);
      if (scheduledSessions === 0) {
        setCompletedSessions(0);
        return;
      }
      const completions = await loadPlanCompletions(activePlan);
      setCompletedSessions(completions.filter((completion) => completion.completed).length);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudyPlan();
  }, [loadStudyPlan, reloadKey]);

  useEffect(() => {
    const refreshStudyPlan = () => setReloadKey((key) => key + 1);
    window.addEventListener(STUDY_PLANS_UPDATED_EVENT, refreshStudyPlan);
    return () => window.removeEventListener(STUDY_PLANS_UPDATED_EVENT, refreshStudyPlan);
  }, []);

  return (
    <Card className="rounded-3xl bg-gradient-to-br from-white via-primary-subtle/20 to-pink-50/60 p-6 dark:from-[#1E163B] dark:to-[#2A1D3D]">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-100 text-primary dark:bg-pink-900/30">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-purple uppercase tracking-wider">
              Active Study Plan
            </span>
            <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white">
              {studyPlan?.title || 'Study Plan'}
            </h3>
          </div>
        </div>
        <Link
          to="/study-planner"
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          <span>Study Planner</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading && <p role="status" className="text-xs text-muted-purple">Loading your study plan...</p>}
      {error && (
        <div className="flex items-center justify-between gap-3 text-xs text-rose-600" role="alert">
          <span>{error}</span>
          <button type="button" className="font-bold" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && !studyPlan && (
        <div className="rounded-2xl bg-primary-subtle/30 px-4 py-6 text-center dark:bg-primary/10">
          <p className="text-sm font-semibold text-deep-purple dark:text-white">
            No active study plan. Create one to track your progress!
          </p>
          <Link
            to="/study-planner"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-lavender-sm hover:opacity-90"
          >
            Create Plan
          </Link>
        </div>
      )}
      {!loading && !error && studyPlan && (
        <div>
          <p className="mb-3 text-xs text-muted-purple">
            {studyPlan.startDate.slice(0, 10)} – {studyPlan.endDate.slice(0, 10)}
          </p>
          <p className="mb-4 text-xs text-muted-purple">
            Next session: <span className="font-semibold text-deep-purple dark:text-lavender-100">
              {studyPlan.nextSessionDate ? formatPlanDate(studyPlan.nextSessionDate) : 'No upcoming sessions'}
            </span>
          </p>
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-deep-purple dark:text-white">Study plan progress</span>
              <span className="text-muted-purple">
                {totalSessions > 0
                  ? `${Math.min(completedSessions, totalSessions)} of ${totalSessions} sessions completed`
                  : 'No sessions scheduled yet'}
              </span>
            </div>
            {totalSessions > 0 && (
              <div
                role="progressbar"
                aria-label="Study plan progress"
                aria-valuemin={0}
                aria-valuemax={totalSessions}
                aria-valuenow={Math.min(completedSessions, totalSessions)}
                className="h-2 overflow-hidden rounded-full bg-primary-subtle dark:bg-primary/20"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (completedSessions / totalSessions) * 100)}%` }}
                />
              </div>
            )}
          </div>
          {studyPlan.subjects.length === 0 ? (
            <p className="text-xs text-muted-purple">No subjects have been added to this plan.</p>
          ) : (
            <ul className="space-y-2">
              {studyPlan.subjects.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-deep-purple dark:text-lavender-100">
                    {subject.name}
                  </span>
                  <span className="shrink-0 text-muted-purple">
                    {formatWeeklyTarget(subject.targetMinutesPerWeek)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
