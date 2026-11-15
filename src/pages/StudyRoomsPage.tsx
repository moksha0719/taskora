import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { MascotBunny } from '../components/common/MascotBunny';
import { roomsApi } from '../lib/api/client';
import { StudyRoom, RoomMessage } from '../types';
import { Users, Lock, Unlock, Play, MessageSquare, Send, Plus, ArrowLeft, Volume2, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export const StudyRoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState<StudyRoom | null>(null);

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Create room form
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');

  const fetchRooms = async () => {
    const data = await roomsApi.getRooms();
    setRooms(data);
    if (activeRoom) {
      const refreshed = data.find((r) => r.id === activeRoom.id);
      if (refreshed) setActiveRoom(refreshed);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleJoinRoom = (room: StudyRoom) => {
    if (room.isPrivate) {
      setSelectedPrivateRoom(room);
    } else {
      setActiveRoom(room);
    }
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPrivateRoom && passcodeAttempt === (selectedPrivateRoom.passcode || '1234')) {
      setActiveRoom(selectedPrivateRoom);
      setSelectedPrivateRoom(null);
      setPasscodeAttempt('');
    } else {
      alert('Incorrect passcode. Please try again! (Hint: demo passcode is 1234)');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !chatInput.trim()) return;

    await roomsApi.postMessage(activeRoom.id, chatInput.trim());
    setChatInput('');
    fetchRooms();
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    const newRoom = await roomsApi.createRoom({
      name: roomName.trim(),
      topic: roomTopic.trim(),
      isPrivate,
      passcode: isPrivate ? passcode : undefined,
    });

    setIsCreateModalOpen(false);
    setRoomName('');
    setRoomTopic('');
    setActiveRoom(newRoom);
    fetchRooms();
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* If inside an active study room */}
      {activeRoom ? (
        <div className="space-y-6">
          {/* Room Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveRoom(null)}
                className="p-2.5 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle text-muted-purple hover:text-primary transition-colors"
                aria-label="Leave room"
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

            <Button
              variant="outline"
              size="sm"
              pill
              onClick={() => setActiveRoom(null)}
              className="text-xs text-rose-500 hover:bg-rose-50 border-rose-200"
            >
              Leave Room
            </Button>
          </div>

          {/* Synchronized Timer + Ambient Bar */}
          <Card className="p-6 bg-gradient-to-r from-primary-subtle/50 via-white to-mint-accent/30 dark:from-[#1E163B] dark:to-[#222B38] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl shadow-lavender-sm">
                ⏱️
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Synchronized Room Pomodoro
                </span>
                <div className="text-3xl font-extrabold font-heading text-deep-purple dark:text-white">
                  14:00 remaining
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle text-xs font-semibold text-deep-purple dark:text-lavender-100 shadow-xs">
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Rain & Lo-Fi Lounge Audio</span>
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
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-primary/30"
                      />
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
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                  {activeRoom.messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 text-xs">
                      <img
                        src={m.userAvatar}
                        alt={m.userName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                      />
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
              <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
                <span>Virtual Study Rooms</span>
                <Badge variant="primary">FR-12 Shared Flow</Badge>
              </h2>
              <p className="text-xs text-muted-purple mt-0.5">
                Study alongside peers worldwide with synchronized Pomodoro timers and quiet ambient chat.
              </p>
            </div>

            <Button variant="primary" size="sm" pill onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </Button>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
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
                    {room.currentMode === 'focus' ? '• 25m Focus Sprint' : '• 5m Break'}
                  </span>
                  <Button
                    size="sm"
                    pill
                    onClick={() => handleJoinRoom(room)}
                  >
                    <span>Join Room</span>
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
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Room Passcode
            </label>
            <input
              type="password"
              required
              value={passcodeAttempt}
              onChange={(e) => setPasscodeAttempt(e.target.value)}
              placeholder="e.g. 1234"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-center tracking-widest font-mono text-base"
            />
            <p className="text-[10px] text-muted-purple mt-1 text-center">
              Hint: Try demo passcode <code className="font-bold text-primary">1234</code>
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
              value={roomTopic}
              onChange={(e) => setRoomTopic(e.target.value)}
              placeholder="e.g. Solving past papers silently"
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
            />
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
                Set 4-Digit Passcode
              </label>
              <input
                type="text"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="1234"
                className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
              />
            </div>
          )}

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
            <Button type="submit" variant="primary" size="sm" pill>
              Launch Room
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
