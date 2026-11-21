import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const auth = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Alex Doe',
      email: 'alex@example.com',
      role: 'student',
      avatar: '',
    },
    updateProfile: auth.updateProfile,
    uploadProfilePhoto: auth.uploadProfilePhoto,
    changePassword: vi.fn(),
    deleteAccount: auth.deleteAccount,
  }),
}));

describe('profile photo settings', () => {
  beforeEach(() => {
    localStorage.clear();
    auth.updateProfile.mockReset().mockResolvedValue(undefined);
    auth.uploadProfilePhoto.mockReset().mockResolvedValue(undefined);
    auth.deleteAccount.mockReset().mockResolvedValue(undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:profile-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists profile visibility and email alert preferences for the current user', () => {
    const { unmount } = render(<SettingsPage />);
    const profileVisibility = screen.getByRole('checkbox', { name: /Profile Visible to Others/ });
    const emailAlerts = screen.getByRole('checkbox', { name: /Email Alerts/ });

    fireEvent.click(profileVisibility);
    fireEvent.click(emailAlerts);

    expect(JSON.parse(localStorage.getItem('taskora.settings.preferences:user-1') || '{}')).toEqual({
      profileVisible: false,
      emailAlerts: false,
    });

    unmount();
    render(<SettingsPage />);

    expect(screen.getByRole('checkbox', { name: /Profile Visible to Others/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Email Alerts/ })).not.toBeChecked();
  });

  it('shows an inline error when saving profile details fails', async () => {
    auth.updateProfile.mockRejectedValueOnce(new Error('Profile update failed.'));
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile update failed.');
    expect(auth.updateProfile).toHaveBeenCalledWith({
      name: 'Alex Doe',
      bio: '',
      major: '',
    });
  });

  it('shows an inline success message after saving profile details', async () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profile settings updated successfully.');
  });

  it('previews a selected image and saves it through the authenticated profile API', async () => {
    render(<SettingsPage />);
    const file = new File(['image data'], 'profile.webp', { type: 'image/webp' });

    fireEvent.change(screen.getByLabelText('Choose profile photo'), {
      target: { files: [file] },
    });

    expect(screen.getByAltText('Alex Doe')).toHaveAttribute('src', 'blob:profile-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Save Photo' }));

    await waitFor(() => expect(auth.uploadProfilePhoto).toHaveBeenCalledWith(file));
    expect(await screen.findByRole('status')).toHaveTextContent('Profile photo updated.');
  });

  it('cancels a selected image without uploading it', () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('Choose profile photo'), {
      target: { files: [new File(['image data'], 'profile.png', { type: 'image/png' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(auth.uploadProfilePhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save Photo' })).not.toBeInTheDocument();
  });

  it('rejects unsupported image types before upload', () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('Choose profile photo'), {
      target: { files: [new File(['not an image'], 'profile.gif', { type: 'image/gif' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG, or WebP image.');
    expect(auth.uploadProfilePhoto).not.toHaveBeenCalled();
  });

  it('shows upload failures and keeps the selected photo available for retry', async () => {
    auth.uploadProfilePhoto.mockRejectedValueOnce(new Error('Profile photo upload failed.'));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('Choose profile photo'), {
      target: { files: [new File(['image data'], 'profile.png', { type: 'image/png' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Photo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile photo upload failed.');
    expect(screen.getByRole('button', { name: 'Save Photo' })).toBeInTheDocument();
  });

  it('warns that all tasks and related data are permanently deleted before confirmation', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(screen.getByText(
      'All your tasks and related data—including study plans, notes, focus sessions, habits, notifications, and progress—will be permanently deleted.',
    )).toBeInTheDocument();
    expect(screen.getByText('Warning: This cannot be undone. Your data cannot be recovered after deletion.')).toBeInTheDocument();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });
});
