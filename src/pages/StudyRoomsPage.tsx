import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { MascotBunny } from '../components/common/MascotBunny';
import { ApiError, roomsApi } from '../lib/api/client';
import { StudyRoom } from '../types';
import { Users, Lock, Unlock, Play, Pause, RotateCcw, MessageSquare, Send, Plus, ArrowLeft, Volume2, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const StudyRoomsPage: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState<StudyRoom | null>(null);
  const [roomActionError, setRoomActionError] = useState<string | null>(null);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Create room form
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [focusDurationMinutes, setFocusDurationMinutes] = useState('25');
  const [breakDurationMinutes, setBreakDurationMinutes] = useState('5');
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');

  const fetchRooms = async (showLoading = true): Promise<StudyRoom[] | null> => {
    if (showLoading) setRoomsLoading(true);
    setRoomsError(null);
    try {
      const data = await roomsApi.getRooms();
      setRooms(data);
      setActiveRoom((currentRoom) => currentRoom
        ? data.find((room) => room.id === currentRoom.id) || null
        : null);
      return data;
    } catch (cause) {
      setRoomsError(cause instanceof Error ? cause.message : 'Unable to load study rooms.');
      return null;
    } finally {
      if (showLoading) setRoomsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    return roomsApi.subscribeRoom(activeRoom.id, (event) => {
      if (typeof event === 'object' && event !== null && 'type' in event) {
        void fetchRooms(false);
      }
    });
  }, [activeRoom?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void fetchRooms(false), 15000);
    return () => window.clearInterval(interval);
  }, [activeRoom?.id]);

  const handleJoinRoom = async (room: StudyRoom) => {
    if (room.isPrivate) return setSelectedPrivateRoom(room);
    setRoomActionBusy(true);
    setRoomActionError(null);
    try {
      await roomsApi.joinRoom(room.id);
      const updatedRooms = await fetchRooms(false);
      const joinedRoom = updatedRooms?.find((item) => item.id === room.id);
      if (!joinedRoom) {
        setRoomActionError('You joined the room, but its participant list could not be refreshed. Please retry.');
        return;
      }
      setActiveRoom(joinedRoom);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await fetchRooms(false);
        setRoomActionError('This study room is full. Please choose another room.');
      } else {
        setRoomActionError(cause instanceof Error ? cause.message : 'Unable to join this room.');
      }
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPrivateRoom) {
      setRoomActionBusy(true);
      setRoomActionError(null);
      try {
        await roomsApi.joinRoom(selectedPrivateRoom.id, passcodeAttempt);
        const updatedRooms = await fetchRooms(false);
        const joinedRoom = updatedRooms?.find((room) => room.id === selectedPrivateRoom.id);
        if (!joinedRoom) {
          setRoomActionError('You joined the room, but its participant list could not be refreshed. Please retry.');
          return;
        }
        setActiveRoom(joinedRoom);
        setSelectedPrivateRoom(null);
        setPasscodeAttempt('');
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 409) {
          await fetchRooms(false);
          setRoomActionError('This study room is full. Please choose another room.');
        } else {
          setRoomActionError(cause instanceof Error ? cause.message : 'Unable to join this room.');
        }
      } finally {
        setRoomActionBusy(false);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !chatInput.trim()) return;

    setRoomActionError(null);
    try {
      await roomsApi.postMessage(activeRoom.id, chatInput.trim());
      setChatInput('');
      await fetchRooms(false);
    } catch (cause) {
      setRoomActionError(cause instanceof Error ? cause.message : 'Unable to send your message.');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setRoomActionBusy(true);
    setRoomActionError(null);
    try {
      const newRoom = await roomsApi.createRoom({
        name: roomName.trim(),
        topic: roomTopic.trim(),
        isPrivate,
        passcode: isPrivate ? passcode : undefined,
        maxParticipants: Number(maxParticipants),
        focusDurationMinutes: Number(focusDurationMinutes),
        breakDurationMinutes: Number(breakDurationMinutes),
      });
      setIsCreateModalOpen(false);
      setRoomName('');
      setRoomTopic('');
      setActiveRoom(newRoom);
      await fetchRooms(false);
    } catch (cause) {
      setRoomActionError(cause instanceof Error ? cause.message : 'Unable to create the study room.');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    const isOwner = activeRoom.ownerId === user?.id;
    if (isOwner && !window.confirm('Delete this room and its messages? Room owners cannot leave while keeping the room open.')) return;
    setRoomActionBusy(true);
    setRoomActionError(null);
    try {
      if (isOwner) await roomsApi.deleteRoom(activeRoom.id);
      else {
        await roomsApi.leaveRoom(activeRoom.id);
        const roomId = activeRoom.id;
        setRooms((currentRooms) => currentRooms.map((room) => room.id === roomId
          ? { ...room, participants: room.participants.filter((participant) => participant.id !== user?.id) }
          : room));
      }
      setActiveRoom(null);
      await fetchRooms(false);
    } catch (cause) {
      setRoomActionError(cause instanceof Error ? cause.message : 'Unable to leave this room.');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleUpdateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRoom) return;
    setRoomActionBusy(true);
    setRoomActionError(null);
    try {
      await roomsApi.updateRoom(activeRoom.id, {
        name: roomName.trim(),
        topic: roomTopic.trim(),
        maxParticipants: Number(maxParticipants),
        focusDurationMinutes: Number(focusDurationMinutes),
        breakDurationMinutes: Number(breakDurationMinutes),
      });
      setIsEditModalOpen(false);
      await fetchRooms(false);
    } catch (cause) {
      setRoomActionError(cause instanceof Error ? cause.message : 'Unable to update this room.');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleTimerAction = async (action: 'start' | 'pause' | 'reset' | 'next') => {
    if (!activeRoom) return;
    setRoomActionBusy(true);
    setRoomActionError(null);
    try {
      await roomsApi.updateTimer(activeRoom.id, action);
      await fetchRooms(false);
    } catch (cause) {
      setRoomActionError(cause instanceof Error ? cause.message : 'Unable to update the room timer.');
    } finally {
      setRoomActionBusy(false);
    }
  };

  const formatRoomTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const activeRoomSeconds = activeRoom
    ? Math.max(0, activeRoom.timerRemainingSeconds - (
      activeRoom.timerStartedAt
        ? Math.floor((currentTime - new Date(activeRoom.timerStartedAt).getTime()) / 1000)
        : 0
    ))
    : 0;
  const isRoomOwner = activeRoom?.ownerId === user?.id;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* If inside an active study room */}
      {activeRoom ? (
        <div className="space-y-6">
          {/* Room Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleLeaveRoom()}
                disabled={roomActionBusy}
                className="p-2.5 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle text-muted-purple hover:text-primary transition-colors"
                aria-label={isRoomOwner ? 'Delete room' : 'Leave room'}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-deep-purple dark:text-white">
                    {activeRoom.name}
                  </h2>
                  <Badge variant={activeRoom.currentMode === 'focus' ? 'primary' : 'mint'}>
                    {activeRoom.currentMode === 'focus' ? 'Focus Sprint ⏱️' : 'Group Break 🍵'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-purple mt-0.5">
                  Topic: {activeRoom.topic} • {activeRoom.participants.length} Active Scholars
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isRoomOwner && (
                <Button variant="outline" size="sm" pill disabled={roomActionBusy} onClick={() => {
                  setRoomName(activeRoom.name);
                  setRoomTopic(activeRoom.topic);
                  setMaxParticipants(String(activeRoom.maxParticipants));
                  setFocusDurationMinutes(String(activeRoom.focusDurationMinutes));
                  setBreakDurationMinutes(String(activeRoom.breakDurationMinutes));
                  setIsEditModalOpen(true);
                }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit Room
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                pill
                disabled={roomActionBusy}
                onClick={() => void handleLeaveRoom()}
                className="text-xs text-rose-500 hover:bg-rose-50 border-rose-200"
              >
                {isRoomOwner ? <Trash2 className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                {isRoomOwner ? 'Delete Room' : 'Leave Room'}
              </Button>
            </div>
          </div>

          {(roomActionError || roomsError) && (
            <Card role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-rose-600">
              <span>{roomActionError || roomsError}</span>
              <button type="button" className="font-bold text-primary" onClick={() => void fetchRooms(false)}>Retry</button>
            </Card>
          )}

          {/* Synchronized Timer + Ambient Bar */}
          <Card className="p-6 bg-gradient-to-r from-primary-subtle/50 via-white to-mint-accent/30 dark:from-[#1E163B] dark:to-[#222B38] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl shadow-lavender-sm">
                ⏱️
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Shared {activeRoom.currentMode === 'focus' ? 'Focus' : 'Break'} Timer
                </span>
                <div className="text-3xl font-extrabold font-heading text-deep-purple dark:text-white" aria-live="off">
                  {formatRoomTimer(activeRoomSeconds)} remaining
                </div>
                {activeRoomSeconds === 0 && (
                  <p className="mt-1 text-xs text-muted-purple">Interval complete. Start or switch to the next interval.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isRoomOwner && (
                <div className="flex flex-wrap gap-2">
                  {!activeRoom.timerStartedAt || activeRoomSeconds === 0 ? (
                    <Button size="sm" pill disabled={roomActionBusy} onClick={() => void handleTimerAction('start')}>
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  ) : (
                    <Button size="sm" pill variant="outline" disabled={roomActionBusy} onClick={() => void handleTimerAction('pause')}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  )}
                  <Button size="sm" pill variant="outline" disabled={roomActionBusy} onClick={() => void handleTimerAction('reset')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button size="sm" pill variant="outline" disabled={roomActionBusy} onClick={() => void handleTimerAction('next')}>
                    Next
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle text-xs font-semibold text-deep-purple dark:text-lavender-100 shadow-xs">
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Room timer synchronized</span>
              </div>
              <MascotBunny mood="focus" size={54} showSparkles={false} />
            </div>
          </Card>

          {/* Grid: Participants on left, Live Chat on right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
            {/* Participants (5 cols) */}
            <Card className="lg:col-span-5 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-subtle">
                <h4 className="text-base font-bold font-heading text-deep-purple dark:text-white">
                  Participants ({activeRoom.participants.length})
                </h4>
                <span className="text-xs text-muted-purple">Max {activeRoom.maxParticipants}</span>
              </div>

              <div className="space-y-3">
                {activeRoom.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      {p.avatar ? (
                        <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" />
                      ) : (
                        <span aria-label={`${p.name} avatar`} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-primary-subtle text-xs font-bold text-primary">
                          {p.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                      <div>
                        <h5 className="text-xs font-bold text-deep-purple dark:text-white">
                          {p.name}
                        </h5>
                        <p className="text-[11px] text-muted-purple">
                          {p.currentTask || 'Focusing quietly'}
                        </p>
                      </div>
                    </div>

                    <Badge variant={p.status === 'focusing' ? 'peach' : 'mint'}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chat Panel (7 cols) */}
            <Card className="lg:col-span-7 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-subtle">
                  <h4 className="text-base font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>Room Study Chat</span>
                  </h4>
                  <span className="text-[11px] text-muted-purple">Encouraging comments only 🌸</span>
                </div>

                {/* Message stream */}
                <div className="max-h-[320px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                  {activeRoom.messages.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-purple">No messages yet. Send the first study note.</p>
                  )}
                  {activeRoom.messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 text-xs">
                      {m.userAvatar ? (
                        <img src={m.userAvatar} alt={m.userName} className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                      ) : (
                        <span aria-label={`${m.userName} avatar`} className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[10px] font-bold text-primary">
                          {m.userName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-deep-purple dark:text-white">
                            {m.userName}
                          </span>
                          <span className="text-[10px] text-muted-purple">{m.timestamp}</span>
                        </div>
                        <p className="p-3 rounded-2xl bg-primary-subtle/30 dark:bg-primary/10 text-deep-purple dark:text-lavender-100 leading-relaxed">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Composer */}
              <form onSubmit={handleSendMessage} className="pt-4 border-t border-subtle mt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send encouraging study note to room..."
                    className="flex-1 text-xs px-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
                  />
                  <Button type="submit" disabled={!chatInput.trim()} pill size="sm">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      ) : (
        /* Room Directory */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
                <span>Virtual Study Rooms</span>
              </h2>
              <p className="text-xs text-muted-purple mt-0.5">
                Study alongside peers worldwide with synchronized Pomodoro timers and quiet ambient chat.
              </p>
            </div>

            <Button variant="primary" size="sm" pill onClick={() => {
              setRoomName('');
              setRoomTopic('');
              setIsPrivate(false);
              setPasscode('');
              setMaxParticipants('8');
              setFocusDurationMinutes('25');
              setBreakDurationMinutes('5');
              setRoomActionError(null);
              setIsCreateModalOpen(true);
            }}>
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </Button>
          </div>

          {roomActionError && <Card role="alert" className="p-4 text-sm text-rose-600">{roomActionError}</Card>}
          {roomsLoading && <Card role="status" className="p-5 text-sm text-muted-purple">Loading study rooms...</Card>}
          {roomsError && (
            <Card role="alert" className="p-5 flex items-center justify-between gap-3 text-sm text-rose-600">
              <span>{roomsError}</span>
              <button type="button" className="font-bold text-primary" onClick={() => void fetchRooms()}>
                Retry
              </button>
            </Card>
          )}
          {!roomsLoading && !roomsError && rooms.length === 0 && (
            <Card className="p-6 text-sm text-muted-purple">
              No study rooms are available yet. Create one to start a shared study session.
            </Card>
          )}

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!roomsLoading && !roomsError && rooms.map((room) => (
              <Card key={room.id} className="p-6 flex flex-col justify-between hover:border-primary/50">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Badge variant={room.isPrivate ? 'peach' : 'mint'}>
                      {room.isPrivate ? (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Private Room
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Unlock className="w-3 h-3" /> Public Room
                        </span>
                      )}
                    </Badge>

                    <span className="text-xs font-semibold text-muted-purple flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {room.participants.length} / {room.maxParticipants}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
                    {room.name}
                  </h3>
                  <p className="text-xs text-muted-purple line-clamp-2">
                    {room.topic}
                  </p>
                </div>

                <div className="pt-4 border-t border-subtle mt-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary">
                    {room.currentMode === 'focus'
                      ? `• ${room.focusDurationMinutes}m Focus Sprint`
                      : `• ${room.breakDurationMinutes}m Break`}
                  </span>
                  <Button
                    size="sm"
                    pill
                    disabled={roomActionBusy || (
                      room.participants.length >= room.maxParticipants &&
                      !room.participants.some((participant) => participant.id === user?.id)
                    )}
                    onClick={() => handleJoinRoom(room)}
                  >
                    <span>{room.participants.length >= room.maxParticipants ? 'Room Full' : 'Join Room'}</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Private Room Passcode Modal (TC10) */}
      <Modal
        isOpen={!!selectedPrivateRoom}
        onClose={() => setSelectedPrivateRoom(null)}
        title="Private Study Room Access"
        description="This room is protected by a passcode. Enter the room key to join (TC10)."
      >
        <form onSubmit={handleVerifyPasscode} className="space-y-4 pt-2">
          {roomActionError && <p role="alert" className="text-sm text-rose-600">{roomActionError}</p>}
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Room Passcode
            </label>
            <input
              type="password"
              required
              value={passcodeAttempt}
              onChange={(e) => setPasscodeAttempt(e.target.value)}
              placeholder="Enter a private passcode"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-center tracking-widest font-mono text-base"
            />
            <p className="text-[10px] text-muted-purple mt-1 text-center">
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setSelectedPrivateRoom(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              Enter Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Room Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Study Room"
        description="Host a group focus session for your project group or study club."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Room Name
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Midterm Cram Lounge ☕"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Topic / Purpose
            </label>
            <input
              type="text"
              required
              value={roomTopic}
              onChange={(e) => setRoomTopic(e.target.value)}
              placeholder="e.g. Solving past papers silently"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Max people
              <input type="number" min={2} max={100} required value={maxParticipants}
                onChange={(event) => setMaxParticipants(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Focus min
              <input type="number" min={1} max={1440} required value={focusDurationMinutes}
                onChange={(event) => setFocusDurationMinutes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">
              Break min
              <input type="number" min={1} max={1440} required value={breakDurationMinutes}
                onChange={(event) => setBreakDurationMinutes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
          </div>

          <div className="flex items-center pt-2">
            <input
              id="isPrivate"
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary/40"
            />
            <label htmlFor="isPrivate" className="ml-2 text-xs text-deep-purple dark:text-white cursor-pointer font-semibold">
              Make Room Private (Require Passcode)
            </label>
          </div>

          {isPrivate && (
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Set passcode (4-64 characters)
              </label>
              <input
                type="password"
                required
                minLength={4}
                maxLength={64}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Private room passcode"
                className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
              />
            </div>
          )}

          {roomActionError && <p role="alert" className="text-xs text-rose-600">{roomActionError}</p>}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill disabled={roomActionBusy}>
              {roomActionBusy ? 'Creating...' : 'Launch Room'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Study Room"
        description="Update room details and timer durations."
      >
        <form onSubmit={handleUpdateRoom} className="space-y-4 pt-2">
          <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200">
            Room name
            <input required maxLength={120} value={roomName} onChange={(event) => setRoomName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2.5 dark:bg-[#181131]" />
          </label>
          <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200">
            Topic
            <input required maxLength={160} value={roomTopic} onChange={(event) => setRoomTopic(event.target.value)}
              className="mt-1 w-full rounded-xl border border-subtle bg-white px-3 py-2.5 dark:bg-[#181131]" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">Max people
              <input type="number" min={2} max={100} required value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">Focus min
              <input type="number" min={1} max={1440} required value={focusDurationMinutes} onChange={(event) => setFocusDurationMinutes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
            <label className="text-xs font-semibold text-deep-purple dark:text-lavender-200">Break min
              <input type="number" min={1} max={1440} required value={breakDurationMinutes} onChange={(event) => setBreakDurationMinutes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white px-2.5 py-2 dark:bg-[#181131]" />
            </label>
          </div>
          {roomActionError && <p role="alert" className="text-xs text-rose-600">{roomActionError}</p>}
          <div className="flex justify-end gap-2 border-t border-subtle pt-3">
            <Button type="button" variant="ghost" size="sm" pill onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" pill disabled={roomActionBusy}>
              {roomActionBusy ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
