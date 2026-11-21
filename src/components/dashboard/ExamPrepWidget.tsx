import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { Card } from '../common/Card';
import { studyPlansApi } from '../../lib/api/client';
import { ApiStudyPlan } from '../../types';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load your study plan.';
}

function formatWeeklyTarget(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h/week`;
}

export const ExamPrepWidget: React.FC = () => {
  const [studyPlan, setStudyPlan] = useState<ApiStudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadStudyPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStudyPlan(await studyPlansApi.getActivePlan());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudyPlan();
  }, [loadStudyPlan, reloadKey]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300">
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
        <div className="py-6 text-center">
          <p className="text-sm font-semibold text-deep-purple dark:text-white">No active study plan</p>
          <p className="mt-1 text-xs text-muted-purple">Create a study plan to see your subjects here.</p>
        </div>
      )}
      {!loading && !error && studyPlan && (
        <div>
          <p className="mb-3 text-xs text-muted-purple">
            {studyPlan.startDate.slice(0, 10)} – {studyPlan.endDate.slice(0, 10)}
          </p>
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
