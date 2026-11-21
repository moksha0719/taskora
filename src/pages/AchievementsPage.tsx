import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { MascotBunny } from '../components/common/MascotBunny';
import { gamificationApi } from '../lib/api/client';
import { Achievement, XPTransaction } from '../types';
import { Trophy, Star, Sparkles, CheckCircle2, Lock, Flame, Hourglass, GraduationCap, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export const AchievementsPage: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [transactions, setTransactions] = useState<XPTransaction[]>([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      gamificationApi.getAchievements(),
      gamificationApi.getXPTransactions(),
      gamificationApi.getSummary(),
    ]).then(([achievementData, transactionData, summary]) => {
      setAchievements(achievementData);
      setTransactions(transactionData);
      setXpTotal(summary.xpTotal);
      setCurrentLevel(summary.level);
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Unable to load achievements.');
    }).finally(() => setLoading(false));
  }, []);

  const levelBase = (currentLevel - 1) * 500;
  const xpInLevel = Math.max(0, xpTotal - levelBase);
  const nextLevelXP = currentLevel * 500;
  const xpPercentage = Math.min(100, Math.round((xpInLevel / 500) * 100));

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Hourglass':
        return <Hourglass className="w-6 h-6" />;
      case 'Flame':
        return <Flame className="w-6 h-6" />;
      case 'GraduationCap':
        return <GraduationCap className="w-6 h-6" />;
      case 'Users':
        return <Users className="w-6 h-6" />;
      case 'Sparkles':
        return <Sparkles className="w-6 h-6" />;
      case 'CheckCircle2':
      default:
        return <CheckCircle2 className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
          <span>Achievements & Scholar XP</span>
        </h2>
        <p className="text-xs text-muted-purple mt-0.5">
          Level up your study rituals. XP awards are audited, traceable, and protected against duplicates.
        </p>
      </div>

      {loading && (
        <Card className="p-5 text-sm text-muted-purple">Loading your achievements...</Card>
      )}
      {error && (
        <Card className="p-5 text-sm text-rose-600">{error}</Card>
      )}

      {/* Level & XP Banner */}
      {!loading && !error && (
      <Card className="p-8 bg-gradient-to-r from-primary-subtle/60 via-white to-soft-pink/40 dark:from-[#1E163B] dark:to-[#2B1D3D] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-soft-lilac text-white flex items-center justify-center text-3xl shadow-lavender flex-shrink-0">
            🏆
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Scholar Rank
            </span>
            <h3 className="text-2xl font-extrabold font-heading text-deep-purple dark:text-white">
              Level {currentLevel} • Focused Scholar
            </h3>
            <p className="text-xs text-muted-purple">
              {xpInLevel} / 500 XP to Level {currentLevel + 1}
            </p>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="w-full md:w-80 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-muted-purple">XP Progress</span>
            <span className="text-primary">{xpPercentage}%</span>
          </div>
          <div className="h-3 w-full bg-lavender-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-primary to-soft-lilac rounded-full transition-all duration-700"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-purple block text-right">
            {Math.max(0, 500 - xpInLevel)} XP needed for next milestone
          </span>
        </div>
      </Card>
      )}

      {/* Badges Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
          Badges & Honors
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading && !error && achievements.length === 0 && (
            <Card className="p-5 text-sm text-muted-purple">
              No achievements are available yet.
            </Card>
          )}
          {achievements.map((ach) => {
            const isUnlocked = !!ach.unlockedAt;

            return (
              <Card
                key={ach.id}
                className={cn(
                  'p-5 flex items-start gap-4 transition-all',
                  isUnlocked
                    ? 'border-primary/40 bg-white/90 dark:bg-[#1E163B]/90'
                    : 'opacity-60 bg-primary-subtle/10 border-dashed border-subtle'
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm',
                    isUnlocked
                      ? 'bg-gradient-to-tr from-primary-subtle to-soft-pink text-primary'
                      : 'bg-muted-purple/20 text-muted-purple'
                  )}
                >
                  {isUnlocked ? getBadgeIcon(ach.icon) : <Lock className="w-5 h-5" />}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-deep-purple dark:text-white truncate">
                      {ach.title}
                    </h4>
                    <span className="text-xs font-bold text-primary">
                      +{ach.xpReward} XP
                    </span>
                  </div>
                  <p className="text-xs text-muted-purple leading-snug">
                    {ach.description}
                  </p>

                  <div className="pt-2">
                    {isUnlocked ? (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        ✓ Unlocked {new Date(ach.unlockedAt!).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-purple italic">
                        Progress: {ach.progress} / {ach.targetRequirement}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <div className="pb-3 mb-3 border-b border-subtle flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold font-heading text-deep-purple dark:text-white">
              XP Transaction Ledger (Audited)
            </h4>
            <p className="text-xs text-muted-purple">Immutable log of XP awards to prevent duplicate bonuses.</p>
          </div>
          <Badge variant="primary">Verified</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle text-muted-purple uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Activity Description</th>
                <th className="py-2.5 px-3">Category Source</th>
                <th className="py-2.5 px-3 text-right">XP Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle/60">
              {!loading && !error && transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-3 text-center text-muted-purple">
                    No XP transactions yet.
                  </td>
                </tr>
              )}
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-primary-subtle/20 transition-colors">
                  <td className="py-2.5 px-3 text-muted-purple whitespace-nowrap">
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-deep-purple dark:text-white">
                    {tx.reason}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant="muted">{tx.source.replace('_', ' ')}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-primary whitespace-nowrap">
                    +{tx.amount} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
