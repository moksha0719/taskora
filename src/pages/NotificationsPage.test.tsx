import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsPage } from './NotificationsPage';
import { TopBar } from '../components/layout/TopBar';
import { notificationsApi } from '../lib/api/client';
import type { NotificationItem } from '../types';

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', name: 'Test User' },
  logout: vi.fn(),
}));

const theme = vi.hoisted(() => ({
  config: { darkMode: 'light' },
  toggleDarkMode: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  notificationsApi: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => theme,
}));

const unreadNotification: NotificationItem = {
  id: 'notification-1',
  userId: 'user-1',
  title: 'Task deadline',
  message: 'A task is due soon.',
  type: 'deadline',
  read: false,
  createdAt: '2026-11-20T08:00:00.000Z',
};

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks notifications as read and deletes them through the API', async () => {
    vi.mocked(notificationsApi.getNotifications)
      .mockResolvedValueOnce([unreadNotification])
      .mockResolvedValueOnce([{ ...unreadNotification, read: true }])
      .mockResolvedValueOnce([]);
    vi.mocked(notificationsApi.markRead).mockResolvedValue(undefined);
    vi.mocked(notificationsApi.deleteNotification).mockResolvedValue(undefined);
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Task deadline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Read' }));
    await waitFor(() => expect(notificationsApi.markRead).toHaveBeenCalledWith('notification-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Delete notification: Task deadline' }));
    expect(await screen.findByText('You have no notifications yet.')).toBeInTheDocument();
    expect(notificationsApi.deleteNotification).toHaveBeenCalledWith('notification-1');
  });

  it('shows API errors when notification actions fail', async () => {
    vi.mocked(notificationsApi.getNotifications).mockResolvedValue([unreadNotification]);
    vi.mocked(notificationsApi.markRead).mockRejectedValue(new Error('Read update failed'));
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Read' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Read update failed');
  });

  it('updates the TopBar unread badge immediately and reconciles it with the API after marking read', async () => {
    let markReadSucceeded = false;
    let resolveRefreshedCount!: (count: number) => void;
    const refreshedCount = new Promise<number>((resolve) => {
      resolveRefreshedCount = resolve;
    });
    vi.mocked(notificationsApi.getNotifications).mockImplementation(async () => [
      { ...unreadNotification, read: markReadSucceeded },
    ]);
    vi.mocked(notificationsApi.getUnreadCount)
      .mockReset()
      .mockResolvedValueOnce(1)
      .mockReturnValueOnce(refreshedCount);
    vi.mocked(notificationsApi.markRead).mockImplementation(async () => {
      markReadSucceeded = true;
    });

    render(
      <MemoryRouter>
        <TopBar onToggleMobileNav={vi.fn()} />
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('1 unread notifications')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Read' }));

    await waitFor(() => expect(notificationsApi.getUnreadCount).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('1 unread notifications')).not.toBeInTheDocument();
    expect(notificationsApi.markRead).toHaveBeenCalledWith('notification-1');

    resolveRefreshedCount(0);
  });
});
