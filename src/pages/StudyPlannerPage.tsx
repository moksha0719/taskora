import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ApiError, studyPlansApi } from '../lib/api/client';
import { useAuth } from '../context/AuthContext';
import {
  ApiStudyPlan,
  StudyDayCode,
  StudyPlanInput,
  StudyPlanSubjectInput,
  StudyScheduleItem,
  StudySchedulePreviewItem,
} from '../types';
import { cn } from '../lib/utils';

const TIME_ZONE = 'Asia/Colombo';
const DAYS: { code: StudyDayCode; label: string }[] = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
  { code: 'SUN', label: 'Sunday' },
];
const SUBJECT_COLORS = ['#9885E8', '#C7B9F5', '#A99CCB', '#F3A6C8', '#77BFA3'];

interface PlanSubjectForm {
  name: string;
  code: string;
  color: string;
  targetMinutesPerWeek: string;
}

interface PlanForm {
  title: string;
  startDate: string;
  endDate: string;
  weeklyTargetMinutes: string;
  studyDaysPerWeek: string;
  timeZone: string;
  subjects: PlanSubjectForm[];
}

type AvailabilityForm = Record<StudyDayCode, { start: string; end: string }>;

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextDateString(date: string): string {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function newPlanForm(): PlanForm {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  return {
    title: '',
    startDate: localDateString(),
    endDate: localDateString(endDate),
    weeklyTargetMinutes: '600',
    studyDaysPerWeek: '4',
    timeZone: TIME_ZONE,
    subjects: [{ name: '', code: '', color: SUBJECT_COLORS[0], targetMinutesPerWeek: '600' }],
  };
}

function emptyAvailability(): AvailabilityForm {
  return {
    MON: { start: '', end: '' },
    TUE: { start: '', end: '' },
    WED: { start: '', end: '' },
    THU: { start: '', end: '' },
    FRI: { start: '', end: '' },
    SAT: { start: '', end: '' },
    SUN: { start: '', end: '' },
  };
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1).replace(/\.0$/, '')}h`;
}

function scheduleItemsFor(plan: ApiStudyPlan): (StudyScheduleItem & {
  subjectName: string;
  subjectColor: string;
})[] {
  return plan.subjects.flatMap((subject) =>
    (subject.scheduleItems || []).map((item) => ({
      ...item,
      subjectName: subject.name,
      subjectColor: subject.color,
    }))
  );
}

export const StudyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [plans, setPlans] = useState<ApiStudyPlan[]>([]);
  const [plan, setPlan] = useState<ApiStudyPlan | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(newPlanForm);
  const [savingPlan, setSavingPlan] = useState(false);

  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [studyDays, setStudyDays] = useState<StudyDayCode[]>([]);
  const [availability, setAvailability] = useState<AvailabilityForm>(emptyAvailability);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<StudySchedulePreviewItem[] | null>(null);

  const [completionDate, setCompletionDate] = useState(localDateString());
  const [completionStates, setCompletionStates] = useState<Record<string, boolean>>({});
  const [actualDurations, setActualDurations] = useState<Record<string, string>>({});
  const [busyCompletion, setBusyCompletion] = useState<string | null>(null);
  const [loadingCompletions, setLoadingCompletions] = useState(false);

  const handleApiError = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      void logout().finally(() => navigate('/login', {
        replace: true,
        state: { message: 'Your session has expired. Please sign in again.' },
      }));
      return;
    }
    setError(cause instanceof Error ? cause.message : 'An unexpected error occurred.');
  }, [logout, navigate]);

  const loadPlans = useCallback(async (preferredPlanId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [availablePlans, activePlan] = await Promise.all([
        studyPlansApi.getPlans(),
        studyPlansApi.getActivePlan(),
      ]);
      setPlans(availablePlans);

      const nextPlanId = preferredPlanId || activePlan?.id || availablePlans[0]?.id || '';
      if (!nextPlanId) {
        setPlan(null);
        setSelectedPlanId('');
        setPreview(null);
        return;
      }

      const selectedPlan = activePlan?.id === nextPlanId
        ? activePlan
        : await studyPlansApi.getPlan(nextPlanId);
      setPlan(selectedPlan);
      setSelectedPlanId(selectedPlan.id);
      setPreview(null);
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const planId = plan?.id;
  useEffect(() => {
    if (!planId || !completionDate) {
      setCompletionStates({});
      setActualDurations({});
      setLoadingCompletions(false);
      return;
    }

    let isCurrentRequest = true;
    setLoadingCompletions(true);
    setError(null);
    setCompletionStates({});
    setActualDurations({});

    studyPlansApi.getCompletions(planId, completionDate, nextDateString(completionDate))
      .then((completions) => {
        if (!isCurrentRequest) return;
        setCompletionStates(Object.fromEntries(
          completions.map(({ scheduleItemId, occurrenceDate }) => [
            `${planId}:${scheduleItemId}:${occurrenceDate}`,
            true,
          ])
        ));
        setActualDurations(Object.fromEntries(
          completions
            .filter(({ actualDurationMinutes }) => actualDurationMinutes !== null)
            .map(({ scheduleItemId, occurrenceDate, actualDurationMinutes }) => [
              `${planId}:${scheduleItemId}:${occurrenceDate}`,
              String(actualDurationMinutes),
            ])
        ));
      })
      .catch((cause: unknown) => {
        if (isCurrentRequest) handleApiError(cause);
      })
      .finally(() => {
        if (isCurrentRequest) setLoadingCompletions(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [completionDate, handleApiError, planId]);

  const persistedSchedule = useMemo(() => plan ? scheduleItemsFor(plan) : [], [plan]);
  const subjectTargetTotal = planForm.subjects.reduce(
    (total, subject) => total + (Number(subject.targetMinutesPerWeek) || 0),
    0
  );
  const weeklyTarget = Number(planForm.weeklyTargetMinutes);
  const planFormValid = Boolean(
    planForm.title.trim()
    && planForm.startDate
    && planForm.endDate
    && weeklyTarget >= 600
    && weeklyTarget <= 2400
    && Number.isInteger(weeklyTarget)
    && [4, 5, 6].includes(Number(planForm.studyDaysPerWeek))
    && planForm.subjects.length > 0
    && planForm.subjects.every((subject) =>
      subject.name.trim()
      && Number.isSafeInteger(Number(subject.targetMinutesPerWeek))
      && Number(subject.targetMinutesPerWeek) > 0
    )
    && subjectTargetTotal === weeklyTarget
  );

  const selectPlan = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const selectedPlan = await studyPlansApi.getPlan(id);
      setPlan(selectedPlan);
      setSelectedPlanId(selectedPlan.id);
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setLoading(false);
    }
  };

  const openNewPlan = () => {
    setEditingPlanId(null);
    setPlanForm(newPlanForm());
    setError(null);
    setIsPlanModalOpen(true);
  };

  const openEditPlan = () => {
    if (!plan) return;
    setEditingPlanId(plan.id);
    setPlanForm({
      title: plan.title,
      startDate: plan.startDate.slice(0, 10),
      endDate: plan.endDate.slice(0, 10),
      weeklyTargetMinutes: String(plan.weeklyTargetMinutes),
      studyDaysPerWeek: String(plan.studyDaysPerWeek),
      timeZone: plan.timeZone,
      subjects: plan.subjects.map((subject) => ({
        name: subject.name,
        code: subject.code,
        color: subject.color,
        targetMinutesPerWeek: String(subject.targetMinutesPerWeek),
      })),
    });
    setError(null);
    setIsPlanModalOpen(true);
  };

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!planFormValid) {
      setError('Subject weekly targets must add up exactly to the plan weekly target.');
      return;
    }

    const input: StudyPlanInput = {
      title: planForm.title.trim(),
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      timeZone: planForm.timeZone,
      weeklyTargetMinutes: weeklyTarget,
      studyDaysPerWeek: Number(planForm.studyDaysPerWeek),
      subjects: planForm.subjects.map((subject): StudyPlanSubjectInput => ({
        name: subject.name.trim(),
        code: subject.code.trim(),
        color: subject.color,
        targetMinutesPerWeek: Number(subject.targetMinutesPerWeek),
      })),
    };

    setSavingPlan(true);
    setError(null);
    try {
      const savedPlan = editingPlanId
        ? await studyPlansApi.updatePlan(editingPlanId, input)
        : await studyPlansApi.createPlan(input);
      setIsPlanModalOpen(false);
      setNotice(editingPlanId ? 'Draft plan updated.' : 'Study plan created as a draft.');
      await loadPlans(savedPlan.id);
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async () => {
    if (!plan || !window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      await studyPlansApi.deletePlan(plan.id);
      setNotice('Study plan deleted.');
      await loadPlans();
    } catch (cause) {
      handleApiError(cause);
    }
  };

  const openGenerator = () => {
    if (!plan) return;
    setStudyDays(DAYS.slice(0, plan.studyDaysPerWeek).map((day) => day.code));
    setAvailability(emptyAvailability());
    setError(null);
    setIsGeneratorModalOpen(true);
  };

  const toggleStudyDay = (day: StudyDayCode) => {
    setStudyDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day]
    );
  };

  const generateSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!plan) return;
    if (studyDays.length !== plan.studyDaysPerWeek) {
      setError(`Select exactly ${plan.studyDaysPerWeek} study days.`);
      return;
    }

    const availabilityWindows = studyDays.map((day) => {
      const window = availability[day];
      return {
        dayOfWeek: day,
        startMinuteOfDay: toMinutes(window.start),
        endMinuteOfDay: toMinutes(window.end),
      };
    });
    if (studyDays.some((day) => !availability[day].start || !availability[day].end)
      || availabilityWindows.some((window) =>
      !Number.isInteger(window.startMinuteOfDay)
      || !Number.isInteger(window.endMinuteOfDay)
      || window.endMinuteOfDay <= window.startMinuteOfDay
      )) {
      setError('Enter a valid start and end time for every selected day.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const generated = await studyPlansApi.generateSchedule({
        plan: {
          weeklyTargetMinutes: plan.weeklyTargetMinutes,
          studyDaysPerWeek: plan.studyDaysPerWeek,
        },
        subjects: plan.subjects.map(({ id, name, targetMinutesPerWeek }) => ({
          id,
          name,
          targetMinutesPerWeek,
        })),
        studyDays,
        scheduleSettings: { availabilityWindows },
      });
      setPreview(generated);
      setIsGeneratorModalOpen(false);
      setNotice('Schedule preview generated. It has not been saved to the plan.');
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setGenerating(false);
    }
  };

  const saveCompletion = async (itemId: string) => {
    if (!plan) return;
    const stateKey = `${plan.id}:${itemId}:${completionDate}`;
    const durationText = actualDurations[stateKey]?.trim() || '';
    const actualDurationMinutes = durationText === '' ? undefined : Number(durationText);
    if (
      actualDurationMinutes !== undefined
      && (!Number.isSafeInteger(actualDurationMinutes) || actualDurationMinutes <= 0 || actualDurationMinutes > 2147483647)
    ) {
      setError('Actual duration must be a positive whole number of minutes.');
      return;
    }

    setBusyCompletion(stateKey);
    setError(null);
    try {
      await studyPlansApi.upsertCompletion(plan.id, itemId, completionDate, actualDurationMinutes);
      setCompletionStates((current) => ({ ...current, [stateKey]: true }));
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setBusyCompletion(null);
    }
  };

  const deleteCompletion = async (itemId: string) => {
    if (!plan) return;
    const stateKey = `${plan.id}:${itemId}:${completionDate}`;
    setBusyCompletion(stateKey);
    setError(null);
    try {
      await studyPlansApi.deleteCompletion(plan.id, itemId, completionDate);
      setCompletionStates((current) => ({ ...current, [stateKey]: false }));
    } catch (cause) {
      handleApiError(cause);
    } finally {
      setBusyCompletion(null);
    }
  };

  const canDeletePlan = plan && (plan.status === 'DRAFT' || plan.status === 'ARCHIVED');
  const showError = (message: string) => (
    <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Smart Study Planner
          </h2>
          <p className="mt-0.5 text-xs text-muted-purple">
            Plan your weekly study targets and preview sessions that fit your availability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan?.status === 'DRAFT' && (
            <Button variant="outline" size="sm" pill onClick={openEditPlan}>
              <Pencil className="h-4 w-4" />
              Edit draft
            </Button>
          )}
          {canDeletePlan && (
            <Button variant="danger" size="sm" pill onClick={() => void deletePlan()}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          {plan && (
            <Button variant="primary" size="sm" pill onClick={openGenerator}>
              <Sparkles className="h-4 w-4" />
              Generate preview
            </Button>
          )}
          <Button variant="outline" size="sm" pill onClick={openNewPlan}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        </div>
      </div>

      {error && showError(error)}
      {notice && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-purple">Loading your study plans...</Card>
      ) : plans.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <BookOpen className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-bold text-deep-purple dark:text-white">No study plans yet</h3>
          <p className="max-w-md text-sm text-muted-purple">
            Create a plan with weekly subject targets before generating a schedule preview.
          </p>
          <Button variant="primary" pill onClick={openNewPlan}>
            <Plus className="h-4 w-4" />
            Create a study plan
          </Button>
        </Card>
      ) : plan ? (
        <>
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-deep-purple dark:text-white">{plan.title}</h3>
                <Badge variant={plan.status === 'ACTIVE' ? 'mint' : 'primary'}>{plan.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-purple">
                {plan.startDate.slice(0, 10)} – {plan.endDate.slice(0, 10)}
                {' · '}{formatHours(plan.weeklyTargetMinutes)} weekly target
                {' · '}{plan.studyDaysPerWeek} study days
                {' · '}{plan.timeZone}
              </p>
            </div>
            {plans.length > 1 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-purple">
                <span>Choose plan</span>
                <select
                  value={selectedPlanId}
                  onChange={(event) => void selectPlan(event.target.value)}
                  className="max-w-xs rounded-xl border border-subtle bg-white px-3 py-2 text-deep-purple dark:bg-[#181131] dark:text-white"
                >
                  {plans.map((item) => (
                    <option key={item.id} value={item.id}>{item.title} ({item.status})</option>
                  ))}
                </select>
              </label>
            )}
          </Card>

          {plan.status === 'DRAFT' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Plans are created as drafts. The current API has no activation or schedule-save endpoint, so generated schedules remain previews.
            </div>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">Subject targets</h3>
              <span className="text-xs text-muted-purple">Weekly</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plan.subjects.map((subject) => (
                <Card key={subject.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-deep-purple dark:text-white">{subject.name}</h4>
                        {subject.code && <span className="text-[11px] text-muted-purple">{subject.code}</span>}
                      </div>
                    </div>
                    <Badge variant="primary">{formatHours(subject.targetMinutesPerWeek)} / week</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {persistedSchedule.length > 0 && (
            <section>
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 border-b border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">Saved schedule items</h3>
                    <p className="mt-1 text-xs text-muted-purple">
                      Occurrence times are shown in {plan.timeZone}.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-purple">
                    Completion date
                    <input
                      type="date"
                      value={completionDate}
                      onChange={(event) => setCompletionDate(event.target.value)}
                      className="rounded-xl border border-subtle bg-white px-3 py-2 text-deep-purple dark:bg-[#181131] dark:text-white"
                    />
                  </label>
                </div>
                {loadingCompletions && (
                  <p role="status" className="mb-4 text-sm text-muted-purple">
                    Loading completion status...
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {persistedSchedule.map((item) => {
                    const stateKey = `${plan.id}:${item.id}:${completionDate}`;
                    const isCompleted = completionStates[stateKey] === true;
                    const isBusy = busyCompletion === stateKey;
                    return (
                      <div key={item.id} className="rounded-2xl border border-subtle bg-surface p-4 dark:bg-[#1E163B]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-primary">
                            {DAYS.find((day) => day.code === item.dayOfWeek)?.label} · {formatTime(item.startMinuteOfDay)}
                          </span>
                          <Clock className="h-4 w-4 text-muted-purple" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.subjectColor }} />
                          <h4 className="truncate text-sm font-bold text-deep-purple dark:text-white">{item.subjectName}</h4>
                        </div>
                        <p className="mt-1 text-xs text-muted-purple">
                          {item.durationMinutes} min · {item.kind.toLowerCase()}
                        </p>
                        {item.topics.length > 0 && (
                          <p className="mt-2 text-xs text-muted-purple">{item.topics.join(', ')}</p>
                        )}
                        <label className="mt-3 block text-[11px] font-semibold text-muted-purple">
                          Actual duration (optional)
                          <input
                            type="number"
                            min={1}
                            max={2147483647}
                            step={1}
                            value={actualDurations[stateKey] || ''}
                            onChange={(event) => setActualDurations((current) => ({
                              ...current,
                              [stateKey]: event.target.value,
                            }))}
                            className="mt-1 w-full rounded-lg border border-subtle bg-white px-2.5 py-2 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                          />
                        </label>
                        <Button
                          variant={isCompleted ? 'secondary' : 'outline'}
                          size="sm"
                          className="mt-3 w-full"
                          disabled={isBusy || loadingCompletions || !completionDate}
                          onClick={() => void saveCompletion(item.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isBusy ? 'Saving...' : isCompleted ? 'Update completion' : 'Mark complete'}
                        </Button>
                        {isCompleted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 w-full"
                            disabled={isBusy || loadingCompletions}
                            onClick={() => void deleteCompletion(item.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Undo completion
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          {preview && (
            <section>
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-col gap-2 border-b border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">Schedule preview</h3>
                    <p className="mt-1 text-xs text-muted-purple">
                      Not saved. Times reflect the availability you entered in {plan.timeZone}.
                    </p>
                  </div>
                  <Badge variant="primary">{preview.length} sessions</Badge>
                </div>
                {preview.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-purple">No sessions were returned for this preview.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {preview.map((session, index) => (
                      <div key={`${session.subjectId}-${session.dayOfWeek}-${session.startMinuteOfDay}-${index}`} className="rounded-2xl border border-primary/20 bg-primary-subtle/30 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-primary">
                          <span>{DAYS.find((day) => day.code === session.dayOfWeek)?.label}</span>
                          <span>{formatTime(session.startMinuteOfDay)} · {session.durationMinutes} min</span>
                        </div>
                        <h4 className="text-sm font-bold text-deep-purple dark:text-white">{session.subjectName}</h4>
                        <p className="mt-1 text-xs text-muted-purple">{session.kind.toLowerCase()} session</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          )}

          {persistedSchedule.length === 0 && !preview && (
            <Card className="p-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 text-base font-bold text-deep-purple dark:text-white">No saved schedule items</h3>
              <p className="mx-auto mt-1 max-w-lg text-sm text-muted-purple">
                Generate a preview using your actual available times. The current API does not provide an endpoint to save the preview or activate a plan.
              </p>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-purple">
          No plan could be selected. <Link className="font-semibold text-primary hover:underline" to="/study-planner">Reload plans</Link>
        </Card>
      )}

      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={editingPlanId ? 'Edit draft plan' : 'Create study plan'}
        description="Set a weekly target and assign the full target across your subjects."
        maxWidth="2xl"
      >
        <form onSubmit={(event) => void savePlan(event)} className="space-y-4">
          {error && showError(error)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200 sm:col-span-2">
              Plan title
              <input
                required
                maxLength={120}
                value={planForm.title}
                onChange={(event) => setPlanForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Start date
              <input
                required
                type="date"
                value={planForm.startDate}
                onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              End date
              <input
                required
                type="date"
                min={planForm.startDate}
                value={planForm.endDate}
                onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Weekly target (minutes)
              <input
                required
                type="number"
                min={600}
                max={2400}
                step={1}
                value={planForm.weeklyTargetMinutes}
                onChange={(event) => setPlanForm((current) => ({ ...current, weeklyTargetMinutes: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Study days per week
              <select
                value={planForm.studyDaysPerWeek}
                onChange={(event) => setPlanForm((current) => ({ ...current, studyDaysPerWeek: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm dark:bg-[#181131] dark:text-white"
              >
                {[4, 5, 6].map((days) => <option key={days} value={days}>{days} days</option>)}
              </select>
            </label>
            <div className="text-xs font-semibold text-deep-purple dark:text-lavender-200 sm:col-span-2">
              Time zone
              <p className="mt-1 rounded-xl border border-subtle bg-primary-subtle/20 px-3 py-2 text-sm font-normal text-muted-purple">
                {planForm.timeZone}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-deep-purple dark:text-white">Subjects</h4>
                <p className="text-xs text-muted-purple">
                  Assigned: {subjectTargetTotal} / {planForm.weeklyTargetMinutes || 0} minutes
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlanForm((current) => ({
                  ...current,
                  subjects: [...current.subjects, {
                    name: '',
                    code: '',
                    color: SUBJECT_COLORS[current.subjects.length % SUBJECT_COLORS.length],
                    targetMinutesPerWeek: '',
                  }],
                }))}
              >
                <Plus className="h-3.5 w-3.5" />
                Add subject
              </Button>
            </div>
            {planForm.subjects.map((subject, index) => (
              <div key={index} className="grid grid-cols-1 items-end gap-2 rounded-2xl border border-subtle p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_100px_110px_auto]">
                <label className="text-[11px] font-semibold text-muted-purple">
                  Name
                  <input
                    required
                    value={subject.name}
                    onChange={(event) => setPlanForm((current) => ({
                      ...current,
                      subjects: current.subjects.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                    }))}
                    className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                  />
                </label>
                <label className="text-[11px] font-semibold text-muted-purple">
                  Code (optional)
                  <input
                    value={subject.code}
                    onChange={(event) => setPlanForm((current) => ({
                      ...current,
                      subjects: current.subjects.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item),
                    }))}
                    className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                  />
                </label>
                <label className="text-[11px] font-semibold text-muted-purple">
                  Color
                  <input
                    type="color"
                    value={subject.color}
                    onChange={(event) => setPlanForm((current) => ({
                      ...current,
                      subjects: current.subjects.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item),
                    }))}
                    className="mt-1 h-9 w-full rounded-xl border border-subtle bg-white p-1"
                  />
                </label>
                <label className="text-[11px] font-semibold text-muted-purple">
                  Minutes / week
                  <input
                    required
                    type="number"
                    min={1}
                    step={1}
                    value={subject.targetMinutesPerWeek}
                    onChange={(event) => setPlanForm((current) => ({
                      ...current,
                      subjects: current.subjects.map((item, itemIndex) => itemIndex === index ? { ...item, targetMinutesPerWeek: event.target.value } : item),
                    }))}
                    className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={planForm.subjects.length === 1}
                  aria-label={`Remove ${subject.name || 'subject'}`}
                  onClick={() => setPlanForm((current) => ({
                    ...current,
                    subjects: current.subjects.filter((_, itemIndex) => itemIndex !== index),
                  }))}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ))}
          </div>

          <p className={cn(
            'rounded-xl px-3 py-2 text-xs',
            subjectTargetTotal === weeklyTarget
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800'
          )}>
            Subject targets must total exactly {planForm.weeklyTargetMinutes || 0} minutes per week.
          </p>
          <div className="flex justify-end gap-2 border-t border-subtle pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsPlanModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingPlan || !planFormValid}>
              {savingPlan ? 'Saving...' : editingPlanId ? 'Save draft' : 'Create draft'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        title="Generate schedule preview"
        description={`Choose ${plan?.studyDaysPerWeek || 4} days and enter your actual available times in ${plan?.timeZone || TIME_ZONE}.`}
        maxWidth="2xl"
      >
        {plan && (
          <form onSubmit={(event) => void generateSchedule(event)} className="space-y-5">
            {error && showError(error)}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-bold text-deep-purple dark:text-lavender-200">Study days</label>
                <span className="text-xs text-muted-purple">{studyDays.length} / {plan.studyDaysPerWeek} selected</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DAYS.map((day) => (
                  <label key={day.code} className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
                    studyDays.includes(day.code)
                      ? 'border-primary bg-primary-subtle/50 text-primary'
                      : 'border-subtle text-muted-purple'
                  )}>
                    <input
                      type="checkbox"
                      checked={studyDays.includes(day.code)}
                      onChange={() => toggleStudyDay(day.code)}
                      className="accent-primary"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-deep-purple dark:text-lavender-200">Availability windows</h4>
              <p className="text-xs text-muted-purple">
                Enter a start and end time for each selected day. The planner will not assume free time.
              </p>
              {DAYS.filter((day) => studyDays.includes(day.code)).map((day) => (
                <div key={day.code} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-xl border border-subtle px-3 py-2">
                  <span className="text-xs font-semibold text-deep-purple dark:text-white">{day.label}</span>
                  <label className="text-[10px] text-muted-purple">
                    Start
                    <input
                      required
                      type="time"
                      value={availability[day.code].start}
                      onChange={(event) => setAvailability((current) => ({
                        ...current,
                        [day.code]: { ...current[day.code], start: event.target.value },
                      }))}
                      className="mt-1 w-full rounded-lg border border-subtle bg-white px-2 py-1.5 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                    />
                  </label>
                  <label className="text-[10px] text-muted-purple">
                    End
                    <input
                      required
                      type="time"
                      value={availability[day.code].end}
                      onChange={(event) => setAvailability((current) => ({
                        ...current,
                        [day.code]: { ...current[day.code], end: event.target.value },
                      }))}
                      className="mt-1 w-full rounded-lg border border-subtle bg-white px-2 py-1.5 text-xs text-deep-purple dark:bg-[#181131] dark:text-white"
                    />
                  </label>
                </div>
              ))}
            </div>

            <p className="rounded-xl bg-primary-subtle/30 px-3 py-2 text-xs text-muted-purple">
              Total target: {formatHours(plan.weeklyTargetMinutes)} · Sessions are preview-only and are not saved to the plan.
            </p>
            <div className="flex justify-end gap-2 border-t border-subtle pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsGeneratorModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={generating || studyDays.length !== plan.studyDaysPerWeek}>
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? 'Generating...' : 'Generate preview'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
