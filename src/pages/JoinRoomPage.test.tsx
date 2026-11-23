import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../lib/api/client';
import { JoinRoomPage } from './JoinRoomPage';
import type { StudyRoom } from '../types';

const api = vi.hoisted(() => ({
  joinRoomByInviteCode: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: null as { id: string; name: string; avatar: string | null } | null,
  loading: false,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/client')>();
  return {
    ...actual,
    roomsApi: {
      ...actual.roomsApi,
      joinRoomByInviteCode: api.joinRoomByInviteCode,
    },
  };
});

const joinedRoom: StudyRoom = {
  id: 'room-1',
  ownerId: 'owner-1',
  name: 'Quiet Study Room',
  topic: 'Math',
  isPrivate: true,
  inviteCode: 'a1b2c3d4',
  maxParticipants: 4,
  participants: [],
  messages: [],
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  currentMode: 'focus',
  timerRemainingSeconds: 1500,
  timerStartedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const NavigationTarget = () => {
  const location = useLocation();
  const state = location.state as {
    joinedRoomId?: string;
    joinedRoom?: StudyRoom;
    successMessage?: string;
  } | null;
  return (
    <div>
      <p>{state?.joinedRoomId}</p>
      <p>{state?.joinedRoom?.name}</p>
      <p>{state?.successMessage}</p>
    </div>
  );
};

describe('JoinRoomPage', () => {
  beforeEach(() => {
    auth.user = { id: 'user-1', name: 'Member', avatar: null };
    auth.loading = false;
    api.joinRoomByInviteCode.mockReset();
  });

  it('joins by invite code and passes the room to the study rooms page', async () => {
    api.joinRoomByInviteCode.mockResolvedValue(joinedRoom);

    render(
      <MemoryRouter initialEntries={['/join/a1b2c3d4']}>
        <Routes>
          <Route path="/join/:code" element={<JoinRoomPage />} />
          <Route path="/study-rooms" element={<NavigationTarget />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('room-1')).toBeInTheDocument();
    expect(await screen.findByText('Quiet Study Room')).toBeInTheDocument();
    expect(screen.getByText('You joined Quiet Study Room.')).toBeInTheDocument();
    expect(api.joinRoomByInviteCode).toHaveBeenCalledWith('a1b2c3d4');
  });

  it('shows a clear message when the invited room is full', async () => {
    api.joinRoomByInviteCode.mockRejectedValue(new ApiError('Study room is full', 409));

    render(
      <MemoryRouter initialEntries={['/join/a1b2c3d4']}>
        <Routes>
          <Route path="/join/:code" element={<JoinRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Room is full');
  });

  it('shows a clear message when the invite link is invalid', async () => {
    api.joinRoomByInviteCode.mockRejectedValue(new ApiError('Study room not found', 404));

    render(
      <MemoryRouter initialEntries={['/join/invalid']}>
        <Routes>
          <Route path="/join/:code" element={<JoinRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid link');
  });

  it('redirects signed-out visitors to login with a prompt', async () => {
    auth.user = null;
    const LoginTarget = () => {
      const location = useLocation();
      const state = location.state as { message?: string } | null;
      return <p>{state?.message}</p>;
    };

    render(
      <MemoryRouter initialEntries={['/join/a1b2c3d4']}>
        <Routes>
          <Route path="/join/:code" element={<JoinRoomPage />} />
          <Route path="/login" element={<LoginTarget />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Please log in first to join this study room.')).toBeInTheDocument();
    await waitFor(() => expect(api.joinRoomByInviteCode).not.toHaveBeenCalled());
  });
});
