import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminPage } from './AdminPage';

const api = vi.hoisted(() => ({
  getStats: vi.fn(),
  getReports: vi.fn(),
  getAuditLogs: vi.fn(),
  resolveReport: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({ adminApi: api }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

describe('AdminPage', () => {
  beforeEach(() => {
    api.getStats.mockReset();
    api.getReports.mockReset();
    api.getAuditLogs.mockReset();
    api.resolveReport.mockReset();
  });

  it('does not present zero statistics while administration data is loading', () => {
    api.getStats.mockImplementation(() => new Promise(() => {}));
    api.getReports.mockImplementation(() => new Promise(() => {}));
    api.getAuditLogs.mockImplementation(() => new Promise(() => {}));
    render(<AdminPage />);

    expect(screen.getByText('Loading administration data...')).toBeInTheDocument();
    expect(screen.getByText(/System Status: Checking/)).toBeInTheDocument();
    expect(screen.queryByText('0 active today')).not.toBeInTheDocument();
    expect(screen.queryByText('0h')).not.toBeInTheDocument();
  });

  it('shows actual zero totals and empty states after successful empty responses', async () => {
    api.getStats.mockResolvedValue({
      totalUsers: 0,
      activeUsersToday: 0,
      totalStudyHours: 0,
      totalTasksCompleted: 0,
      reportedContentCount: 0,
    });
    api.getReports.mockResolvedValue([]);
    api.getAuditLogs.mockResolvedValue([]);
    render(<AdminPage />);

    expect(await screen.findByText('0 active today')).toBeInTheDocument();
    expect(screen.getByText('0h')).toBeInTheDocument();
    expect(screen.getByText('No moderation reports are available.')).toBeInTheDocument();
    expect(screen.getByText('No audit log entries are available.')).toBeInTheDocument();
    expect(screen.getByText('User directory management is not yet available.')).toBeInTheDocument();
  });
});
