import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { authApi } from '../../lib/api/client';

vi.mock('../../lib/api/client', () => ({
  authApi: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('../../components/common/MascotBunny', () => ({
  MascotBunny: () => null,
}));

const LoginTarget = () => {
  const location = useLocation();
  return <p>{(location.state as { message?: string } | null)?.message}</p>;
};

describe('password reset page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the entered email to the forgot-password API and shows generic instructions', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(
      'If an account exists, reset instructions will be sent.',
    );
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const email = screen.getByLabelText('Account Email');
    expect(email).toHaveValue('');
    fireEvent.change(email, { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith('student@example.com');
    });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('submits the token and new password to the reset API and returns to login with a notice', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue('Password reset successfully.');
    render(
      <MemoryRouter initialEntries={['/forgot-password?token=opaque-reset-token']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<LoginTarget />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('opaque-reset-token', 'secure-password');
    });
    expect(await screen.findByText('Password reset successfully. Please sign in with your new password.')).toBeInTheDocument();
  });

  it('shows backend reset errors in the page', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(new Error('Reset token is invalid or expired'));
    render(
      <MemoryRouter initialEntries={['/forgot-password?token=expired-token']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reset token is invalid or expired');
  });
});
