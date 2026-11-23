import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/client';
import { StudyRoomsPage } from './StudyRoomsPage';
import type { StudyRoom } from '../types';

const api = vi.hoisted(() => ({
  getRooms: vi.fn(),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  deleteRoom: vi.fn(),
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
      createRoom: api.createRoom,
      joinRoom: api.joinRoom,
      leaveRoom: api.leaveRoom,
      deleteRoom: api.deleteRoom,
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
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    api.getRooms.mockReset();
    api.createRoom.mockReset();
    api.joinRoom.mockReset().mockResolvedValue(undefined);
    api.leaveRoom.mockReset().mockResolvedValue(undefined);
    api.deleteRoom.mockReset().mockResolvedValue(undefined);
    api.subscribeRoom.mockReset().mockReturnValue(() => undefined);
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    originalClipboard = undefined;
  });

  it('shows the refreshed participant list after joining and leaving a room', async () => {
    api.getRooms
      .mockResolvedValueOnce([room([ownerParticipant])])
      .mockResolvedValueOnce([room([ownerParticipant, currentParticipant])])
      .mockResolvedValueOnce([room([ownerParticipant])]);

    render(<MemoryRouter><StudyRoomsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Join Room' }));
    expect(await screen.findByText('Participants (2)')).toBeInTheDocument();
    expect(screen.getByText('New Member')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }));

    await waitFor(() => {
      expect(screen.getByText('1 / 4')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Join Room' })).toBeInTheDocument();
    expect(api.leaveRoom).toHaveBeenCalledWith('room-1');
    expect(api.deleteRoom).not.toHaveBeenCalled();
  });

  it('shows a clear message when the room fills before the join completes', async () => {
    api.getRooms
      .mockResolvedValueOnce([room([ownerParticipant], 2)])
      .mockResolvedValueOnce([room([ownerParticipant, currentParticipant], 2)]);
    api.joinRoom.mockRejectedValue(new ApiError('Study room is full', 409));

    render(<MemoryRouter><StudyRoomsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Join Room' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This study room is full. Please choose another room.',
    );
    expect(await screen.findByText('Room Full')).toBeInTheDocument();
    expect(api.joinRoom).toHaveBeenCalledWith('room-1');
  });

  it('keeps a newly created private room active when refreshing the public list', async () => {
    api.getRooms.mockResolvedValue([]);
    api.createRoom.mockResolvedValue({
      ...room([currentParticipant]),
      ownerId: currentParticipant.id,
      name: 'Private study room',
      isPrivate: true,
    });

    render(<MemoryRouter><StudyRoomsPage /></MemoryRouter>);
    await screen.findByText('No study rooms are available yet. Create one to start a shared study session.');
    fireEvent.click(screen.getByRole('button', { name: 'Create Room' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Midterm Cram Lounge ☕'), {
      target: { value: 'Private study room' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Solving past papers silently'), {
      target: { value: 'Distributed Systems' },
    });
    fireEvent.click(screen.getByLabelText('Make Room Private (Require Passcode)'));
    fireEvent.change(screen.getByPlaceholderText('Private room passcode'), {
      target: { value: 'room-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Launch Room' }));

    expect(await screen.findByRole('heading', { name: 'Private study room' })).toBeInTheDocument();
    expect(api.createRoom).toHaveBeenCalledWith(expect.objectContaining({
      isPrivate: true,
      passcode: 'room-secret',
    }));
    expect(api.getRooms).toHaveBeenCalledTimes(2);
  });

  it('opens an invite-joined private room and copies its invite link', async () => {
    const privateRoom = {
      ...room([currentParticipant]),
      isPrivate: true,
      inviteCode: 'a1b2c3d4',
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    api.getRooms.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/study-rooms',
        state: { joinedRoom: privateRoom, successMessage: 'You joined Quiet Study Room.' },
      }]}>
        <StudyRoomsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Quiet Study Room' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You joined Quiet Study Room.');
    fireEvent.click(screen.getByRole('button', { name: 'Copy Invite Link' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/join/a1b2c3d4`,
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Link Copied!');
  });
});
