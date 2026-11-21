import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const auth = vi.hoisted(() => ({
  uploadProfilePhoto: vi.fn(),
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
    updateProfile: vi.fn(),
    uploadProfilePhoto: auth.uploadProfilePhoto,
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  }),
}));

describe('profile photo settings', () => {
  beforeEach(() => {
    auth.uploadProfilePhoto.mockReset().mockResolvedValue(undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:profile-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
