import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { studyPlansApi } from '../lib/api/client';
import { StudyPlan, StudySubject, StudySession } from '../types';
import { Sparkles, BookOpen, Clock, Calendar, CheckCircle2, AlertTriangle, Plus, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';

export const StudyPlannerPage: React.FC = () => {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

  // Generator form
  const [hoursPerWeek, setHoursPerWeek] = useState(24);
  const [studyDays, setStudyDays] = useState(5);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    'Distributed Systems',
    'Interaction Design',
    'Discrete Mathematics',
  ]);

  useEffect(() => {
    studyPlansApi.getPlan().then((data) => {
      setPlan(data);
      setLoading(false);
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsGeneratorModalOpen(false);

    const generated = await studyPlansApi.generateSmartSchedule(selectedSubjects, hoursPerWeek);
    setPlan(generated);
    setLoading(false);

    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#9885E8', '#C7B9F5', '#FEF3D6'],
    });
  };

  const days: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Smart Study Planner
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            AI distributes cognitive workload evenly across your week, preventing last-minute cramming (FR-05).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={() => alert('Plan saved successfully to your cloud profile!')}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Save Plan</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            pill
            onClick={() => setIsGeneratorModalOpen(true)}
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Smart Schedule</span>
          </Button>
        </div>
      </div>

      {/* Subject Workload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plan?.subjects.map((sub) => {
          const progress = Math.round((sub.completedHoursWeekly / sub.targetHoursWeekly) * 100);
          return (
            <Card key={sub.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />
                  <div>
                    <h4 className="text-sm font-bold text-deep-purple dark:text-white">
                      {sub.name}
                    </h4>
                    <span className="text-[11px] text-muted-purple">{sub.code}</span>
                  </div>
                </div>
                <Badge variant="primary">{sub.targetHoursWeekly}h / week</Badge>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-purple">Progress</span>
                  <span className="text-primary font-bold">{sub.completedHoursWeekly}h ({progress}%)</span>
                </div>
                <div className="h-2 w-full bg-lavender-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Weekly Schedule Grid */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-subtle">
          <div>
            <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
              Weekly Study Timetable
            </h3>
            <p className="text-xs text-muted-purple">
              Target: {plan?.weeklyTargetHours || 24} hours balanced across spaced repetition blocks.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-mint-accent text-mint-accent-text flex items-center gap-1">
            ✓ Conflict-Free Optimized
          </span>
        </div>

        {/* Timetable Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const daySessions = plan?.sessions.filter((s) => s.day === day) || [];
            const isWeekend = day === 'Sat' || day === 'Sun';

            return (
              <div
                key={day}
                className={cn(
                  'rounded-2xl p-3 border min-h-[280px] flex flex-col',
                  isWeekend
                    ? 'bg-primary-subtle/10 border-dashed border-subtle'
                    : 'bg-surface dark:bg-[#1E163B] border-subtle'
                )}
              >
                <div className="pb-2 mb-2 border-b border-subtle/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-deep-purple dark:text-white">
                    {day}
                  </span>
                  <span className="text-[10px] text-muted-purple">
                    {daySessions.length} blocks
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        'p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.02]',
                        session.isCompleted
                          ? 'bg-mint-accent/20 border-emerald-300 text-muted-purple'
                          : 'bg-primary-subtle/40 border-primary/30 text-deep-purple dark:text-lavender-100'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {session.startTime} - {session.endTime}
                        </span>
                        {session.isCompleted && (
                          <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                        )}
                      </div>
                      <h5 className="font-bold text-xs truncate">
                        {session.subjectName}
                      </h5>
                      <div className="mt-1 space-y-0.5">
                        {session.topics.map((topic, i) => (
                          <span key={i} className="block text-[10px] text-muted-purple truncate">
                            • {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {daySessions.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[11px] text-muted-purple/60 italic text-center py-8">
                      {isWeekend ? 'Rest & Recharge 🌸' : 'Free Study Slot'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Generator Modal */}
      <Modal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        title="AI Smart Study Schedule Generator"
        description="Enter your weekly available hours and deadlines to generate an optimal spaced repetition timetable."
      >
        <form onSubmit={handleGenerate} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Weekly Available Study Hours: <span className="text-primary font-bold">{hoursPerWeek}h</span>
            </label>
            <input
              type="range"
              min={10}
              max={40}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-purple mt-1">
              <span>10 hrs (Light)</span>
              <span>24 hrs (Balanced)</span>
              <span>40 hrs (Intensive)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Study Days per Week: <span className="text-primary font-bold">{studyDays} Days</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setStudyDays(num)}
                  className={cn(
                    'py-2 rounded-xl text-xs font-bold border transition-all',
                    studyDays === num
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white dark:bg-[#181131] border-subtle text-muted-purple'
                  )}
                >
                  {num} Days / Week
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-primary-subtle/30 text-xs text-muted-purple space-y-1">
            <span className="font-bold text-deep-purple dark:text-white block">
              Cognitive Load Optimization Rules:
            </span>
            <p>• Max 2.5 hours per subject in a single continuous block.</p>
            <p>• Spaced repetition interval: 48 hours between related topics.</p>
            <p>• Weekends reserved for light review and consolidation.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsGeneratorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Schedule</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
