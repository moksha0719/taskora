import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { adminApi } from '../lib/api/client';
import { AdminStats, ModerationReport, AuditLogEntry } from '../types';
import { ShieldCheck, AlertTriangle, Users, Database, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const fetchAdminData = async () => {
    const s = await adminApi.getStats();
    const r = await adminApi.getReports();
    const l = await adminApi.getAuditLogs();
    setStats(s);
    setReports(r);
    setLogs(l);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleResolve = async (id: string, action: 'resolved' | 'dismissed') => {
    await adminApi.resolveReport(id, action);
    fetchAdminData();
  };

  const mockUsers = [
    { id: 'usr_1', name: 'Emily Watson', email: 'emily.watson@university.edu', role: 'Student', status: 'Active', hours: '18h' },
    { id: 'usr_2', name: 'Alex Rivera', email: 'alex.rivera@university.edu', role: 'Student', status: 'Active', hours: '24h' },
    { id: 'usr_3', name: 'Dr. Alexander Vance', email: 'admin@taskora.edu', role: 'Admin', status: 'Active', hours: '12h' },
    { id: 'usr_4', name: 'Sophia Chen', email: 'sophia@university.edu', role: 'Student', status: 'Active', hours: '31h' },
  ];

  const filteredUsers = mockUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>Administration & Governance</span>
            <Badge variant="peach">FR-16 Role-Gated</Badge>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Operational telemetry, community content moderation, and audited system event logs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Health: Nominal ({stats?.serverUptimePercent || 99.98}%)</span>
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
                {stats?.totalUsers || 1428}
              </div>
              <span className="text-xs text-primary font-semibold">{stats?.activeUsersToday || 412} active today</span>
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
                {(stats?.totalStudyHours || 19840).toLocaleString()}h
              </div>
              <span className="text-xs text-amber-600 font-semibold">Across 8 departments</span>
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
                {(stats?.totalTasksCompleted || 34820).toLocaleString()}
              </div>
              <span className="text-xs text-emerald-600 font-semibold">89.4% on-time completion</span>
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
                {reports.filter((r) => r.status === 'pending').length}
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
          <Badge variant="pink">{reports.filter((r) => r.status === 'pending').length} Pending</Badge>
        </div>

        <div className="space-y-3">
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
                    Resolve & Censor
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

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-purple absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-subtle bg-white dark:bg-[#181131]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-subtle text-muted-purple uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Platform Role</th>
                <th className="py-2.5 px-3">Total Study Logged</th>
                <th className="py-2.5 px-3">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-primary-subtle/20 transition-colors">
                  <td className="py-3 px-3 font-bold text-deep-purple dark:text-white">
                    {u.name}
                  </td>
                  <td className="py-3 px-3 text-muted-purple">{u.email}</td>
                  <td className="py-3 px-3">
                    <Badge variant={u.role === 'Admin' ? 'peach' : 'primary'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 font-semibold text-primary">{u.hours}</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ● Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* System Audit Logs (FR-16) */}
      <Card className="p-6">
        <div className="pb-3 mb-3 border-b border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">
              Immutable Audit Log (FR-16)
            </h3>
            <p className="text-xs text-muted-purple">Security events, role elevations, and room creation actions.</p>
          </div>
          <Badge variant="muted">Compliant</Badge>
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
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
