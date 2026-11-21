import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Bell, Download, Trash2, CheckCircle2, Save, Camera } from 'lucide-react';

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, uploadProfilePhoto, changePassword, deleteAccount } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [major, setMajor] = useState(user?.major || '');
  const [email, setEmail] = useState(user?.email || '');

  // Privacy toggles
  const [profileVisible, setProfileVisible] = useState(true);
  const [roomPresenceVisible, setRoomPresenceVisible] = useState(true);
  const [privateByDefault, setPrivateByDefault] = useState(true);

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [habitPrompts, setHabitPrompts] = useState(true);

  // Password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ name, bio, major, email });
    alert('Profile settings updated successfully!');
  };

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!PROFILE_PHOTO_TYPES.has(file.type)) {
      setPhotoError('Choose a JPG, PNG, or WebP image.');
      setPhotoSuccess(null);
      return;
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setPhotoError('Profile photos must be 5 MB or smaller.');
      setPhotoSuccess(null);
      return;
    }

    setPhotoError(null);
    setPhotoSuccess(null);
    setSelectedPhoto(file);
  };

  const handleCancelPhoto = () => {
    setSelectedPhoto(null);
    setPhotoError(null);
    setPhotoSuccess(null);
  };

  const handleSavePhoto = async () => {
    if (!selectedPhoto) return;
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoSuccess(null);
    try {
      await uploadProfilePhoto(selectedPhoto);
      setSelectedPhoto(null);
      setPhotoSuccess('Profile photo updated.');
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Unable to update your profile photo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        profile: user,
        exportedAt: new Date().toISOString(),
        application: 'Taskora Personal Study Platform',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskora_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
          <span>Profile & Account Settings</span>
        </h2>
        <p className="text-xs text-muted-purple mt-0.5">
          Manage your student identity, privacy visibility, notification alerts, and data exports.
        </p>
      </div>

      {/* Profile Details Form */}
      <Card className="p-6">
        <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white pb-3 mb-4 border-b border-subtle flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <span>Personal Information</span>
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <img
              src={photoPreview || user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
              alt={user?.name || 'User'}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary/30 shadow-sm"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-deep-purple dark:text-white">{name}</h4>
              <p className="text-xs text-muted-purple">{email}</p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose profile photo"
                onChange={handlePhotoSelection}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  pill
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoLoading}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{selectedPhoto ? 'Choose Another' : 'Change Photo'}</span>
                </Button>
                {selectedPhoto && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      pill
                      onClick={handleSavePhoto}
                      disabled={photoLoading}
                    >
                      <span>{photoLoading ? 'Saving...' : 'Save Photo'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      pill
                      onClick={handleCancelPhoto}
                      disabled={photoLoading}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-purple mt-1">JPG, PNG, or WebP. Maximum 5 MB.</p>
              {photoError && <p role="alert" className="text-xs text-rose-600 mt-1">{photoError}</p>}
              {photoSuccess && <p role="status" className="text-xs text-emerald-600 mt-1">{photoSuccess}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Academic Degree / Major
              </label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Bio / Focus Mantra
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="sm" pill>
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>Save Profile</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Privacy Settings */}
      <Card className="p-6">
        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 cursor-pointer">
            <div>
              <span className="font-bold text-deep-purple dark:text-white block">
                Study Notes Private by Default
              </span>
              <span className="text-muted-purple text-[11px]">
                Require explicit action to share lecture notes with peers.
              </span>
            </div>
            <input
              type="checkbox"
              checked={privateByDefault}
              onChange={(e) => setPrivateByDefault(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 cursor-pointer">
            <div>
              <span className="font-bold text-deep-purple dark:text-white block">
                Show Study Room Online Presence
              </span>
              <span className="text-muted-purple text-[11px]">
                Allow group members to see your current Pomodoro sprint timer.
              </span>
            </div>
            <input
              type="checkbox"
              checked={roomPresenceVisible}
              onChange={(e) => setRoomPresenceVisible(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card className="p-6">
        <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white pb-3 mb-4 border-b border-subtle flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span>Notification & Sound Alerts</span>
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 cursor-pointer">
            <div>
              <span className="font-bold text-deep-purple dark:text-white block">
                Focus Timer Chimes
              </span>
              <span className="text-muted-purple text-[11px]">
                Play gentle chime when Pomodoro or break period completes.
              </span>
            </div>
            <input
              type="checkbox"
              checked={soundEffects}
              onChange={(e) => setSoundEffects(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 cursor-pointer">
            <div>
              <span className="font-bold text-deep-purple dark:text-white block">
                Daily Habit Streaks Reminders
              </span>
              <span className="text-muted-purple text-[11px]">
                Receive prompt 1 hour before habit deadline.
              </span>
            </div>
            <input
              type="checkbox"
              checked={habitPrompts}
              onChange={(e) => setHabitPrompts(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* Account Safety & Data Export */}
      <Card className="p-6">
        <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white pb-3 mb-4 border-b border-subtle flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <span>Account Security & Export</span>
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={() => setIsPasswordModalOpen(true)}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            pill
            onClick={handleExportData}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export My Data (JSON)</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            pill
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </Button>
        </div>
      </Card>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
        description="Ensure your new password contains at least 8 characters."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await changePassword(currentPw, newPw);
              setCurrentPw('');
              setNewPw('');
              setIsPasswordModalOpen(false);
              alert('Password changed successfully!');
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Unable to change password.');
            }
          }}
          className="space-y-4 pt-2"
        >
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-2xl border border-subtle bg-white dark:bg-[#181131]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" pill>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Account?"
        description="This action is permanent and will delete all study plans, notes, and XP records."
      >
        <div className="space-y-4 pt-2 text-xs text-muted-purple">
          <p className="p-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200">
            ⚠️ Warning: Your data cannot be recovered after deletion.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-subtle">
            <Button
              variant="ghost"
              size="sm"
              pill
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              pill
              onClick={() => {
                void deleteAccount().then(() => {
                  window.location.href = '/login';
                }).catch((error) => {
                  alert(error instanceof Error ? error.message : 'Unable to delete account.');
                });
              }}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
