import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { adminApi } from '../lib/api/client';
import { AdminStats, ModerationReport, AuditLogEntry } from '../types';
import { ShieldCheck, AlertTriangle, Users, Database, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const s = await adminApi.getStats();
      const r = await adminApi.getReports();
      const l = await adminApi.getAuditLogs();
      setStats(s);
      setReports(r);
      setLogs(l);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') void fetchAdminData();
  }, [user?.role]);

  const handleResolve = async (id: string, action: 'resolved' | 'dismissed') => {
    try {
      await adminApi.resolveReport(id, action);
      await fetchAdminData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update the moderation report.');
    }
  };

  const pendingReportCount = loading
    ? '…'
    : error
      ? '—'
      : reports.filter((report) => report.status === 'pending').length;

  if (user?.role !== 'admin') {
    return (
      <Card className="p-6 text-sm text-muted-purple">
        Admin access is required to view this page.
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Administration & Governance</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Operational telemetry, community content moderation, and audited system event logs.
          </p>
        </div>

        {loading && (
          <Card className="p-5 text-sm text-muted-purple">Loading administration data...</Card>
        )}
        {error && (
          <Card className="p-5 text-sm text-rose-600">{error}</Card>
        )}

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Status: {loading ? 'Checking' : error ? 'Unavailable' : 'Connected'}</span>
        </div>
      </div>

      {/* Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Registered Scholars</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">
                {loading ? '…' : stats?.totalUsers.toLocaleString() ?? '—'}
              </div>
              <span className="text-xs text-primary font-semibold">
                {loading ? 'Checking activity...' : stats ? `${stats.activeUsersToday.toLocaleString()} active today` : 'Unavailable'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-soft-peach text-soft-peach-text flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Total Study Hours</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">
                {loading ? '…' : stats ? `${stats.totalStudyHours.toLocaleString()}h` : '—'}
              </div>
              <span className="text-xs text-muted-purple font-semibold">All recorded focus sessions</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-mint-accent text-mint-accent-text flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Tasks Completed</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">
                {loading ? '…' : stats?.totalTasksCompleted.toLocaleString() ?? '—'}
              </div>
              <span className="text-xs text-muted-purple font-semibold">All recorded completed tasks</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-soft-pink text-soft-pink-text flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-muted-purple">Moderation Queue</span>
              <div className="text-2xl font-bold text-deep-purple dark:text-white">
                {pendingReportCount}
              </div>
              <span className="text-xs text-rose-500 font-semibold">Requires faculty review</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Moderation Queue Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-subtle">
          <div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Reported Content & Community Moderation</span>
            </h3>
            <p className="text-xs text-muted-purple">
              Protecting student study spaces from spam, off-topic links, and policy violations.
            </p>
          </div>
          <Badge variant="pink">{pendingReportCount} Pending</Badge>
        </div>

        <div className="space-y-3">
          {!loading && !error && reports.length === 0 && (
            <p className="text-sm text-muted-purple">No moderation reports are available.</p>
          )}
          {reports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                report.status === 'pending'
                  ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20'
                  : 'bg-primary-subtle/20 border-subtle opacity-60'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={report.status === 'pending' ? 'pink' : 'mint'}>
                    {report.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-bold text-deep-purple dark:text-white">
                    Reason: {report.reason}
                  </span>
                </div>
                <p className="text-xs text-muted-purple italic">
                  Snippet: "{report.contentSnippet}"
                </p>
                <span className="text-[10px] text-muted-purple block">
                  Reported by {report.reportedBy} at {new Date(report.reportedAt).toLocaleTimeString()}
                </span>
              </div>

              {report.status === 'pending' && (
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    pill
                    onClick={() => handleResolve(report.id, 'dismissed')}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    pill
                    onClick={() => handleResolve(report.id, 'resolved')}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* User Management Section */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-subtle">
          <div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">
              Student & User Management
            </h3>
            <p className="text-xs text-muted-purple">Active platform scholars and role assignments.</p>
          </div>

        </div>
        <div className="rounded-2xl border border-subtle p-4 text-xs text-muted-purple">
          User directory management is not yet available.
        </div>
      </Card>

      <Card className="p-6">
        <div className="pb-3 mb-3 border-b border-subtle flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-purple">Recorded moderation events and related activity.</p>
          </div>
          <Badge variant="muted">Recorded events</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle text-muted-purple uppercase text-[10px] font-bold">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Actor Email</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Target Entity</th>
                <th className="py-2 px-3">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-primary-subtle/20 transition-colors">
                  <td className="py-2.5 px-3 text-muted-purple whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-deep-purple dark:text-white">
                    {log.actorEmail}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-primary">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-muted-purple">{log.target}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-purple">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
              {!loading && !error && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-muted-purple">No audit log entries are available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
