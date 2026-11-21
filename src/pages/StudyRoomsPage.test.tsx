import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/client';
import { StudyRoomsPage } from './StudyRoomsPage';
import type { StudyRoom } from '../types';

const api = vi.hoisted(() => ({
  getRooms: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  subscribeRoom: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: { id: 'user-2', name: 'New Member', avatar: null },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../components/common/MascotBunny', () => ({
  MascotBunny: () => null,
}));

vi.mock('../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/client')>();
  return {
    ...actual,
    roomsApi: {
      ...actual.roomsApi,
      getRooms: api.getRooms,
      joinRoom: api.joinRoom,
      leaveRoom: api.leaveRoom,
      subscribeRoom: api.subscribeRoom,
    },
  };
});

const ownerParticipant = {
  id: 'user-1',
  name: 'Room Owner',
  avatar: '',
  status: 'focusing' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
};

const currentParticipant = {
  id: 'user-2',
  name: 'New Member',
  avatar: '',
  status: 'focusing' as const,
  joinedAt: '2026-01-01T00:01:00.000Z',
};

const room = (participants: StudyRoom['participants'], maxParticipants = 4): StudyRoom => ({
  id: 'room-1',
  ownerId: 'user-1',
  name: 'Quiet Study Room',
  topic: 'Math',
  isPrivate: false,
  maxParticipants,
  participants,
  messages: [],
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  currentMode: 'focus',
  timerRemainingSeconds: 1500,
  timerStartedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('StudyRoomsPage', () => {
  beforeEach(() => {
    api.getRooms.mockReset();
    api.joinRoom.mockReset().mockResolvedValue(undefined);
    api.leaveRoom.mockReset().mockResolvedValue(undefined);
    api.subscribeRoom.mockReset().mockReturnValue(() => undefined);
  });

  it('shows the refreshed participant list after joining and leaving a room', async () => {
    api.getRooms
      .mockResolvedValueOnce([room([ownerParticipant])])
      .mockResolvedValueOnce([room([ownerParticipant, currentParticipant])])
      .mockResolvedValueOnce([room([ownerParticipant])]);

    render(<StudyRoomsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Join Room' }));
    expect(await screen.findByText('Participants (2)')).toBeInTheDocument();
    expect(screen.getByText('New Member')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }));

    await waitFor(() => {
      expect(screen.getByText('1 / 4')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Join Room' })).toBeInTheDocument();
    expect(api.leaveRoom).toHaveBeenCalledWith('room-1');
  });

  it('shows a clear message when the room fills before the join completes', async () => {
    api.getRooms
      .mockResolvedValueOnce([room([ownerParticipant], 2)])
      .mockResolvedValueOnce([room([ownerParticipant, currentParticipant], 2)]);
    api.joinRoom.mockRejectedValue(new ApiError('Study room is full', 409));

    render(<StudyRoomsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Join Room' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This study room is full. Please choose another room.',
    );
    expect(await screen.findByText('Room Full')).toBeInTheDocument();
    expect(api.joinRoom).toHaveBeenCalledWith('room-1');
  });
});
