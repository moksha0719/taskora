import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { MascotBunny } from '../../components/common/MascotBunny';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../lib/api/client';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const resetToken = useMemo(() => new URLSearchParams(search).get('token'), [search]);
  const [step, setStep] = useState<1 | 2 | 3>(resetToken ? 3 : 1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setStep(resetToken ? 3 : 1);
    setFormError(null);
  }, [resetToken]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setStep(2);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      setFormError('The password reset link is missing or invalid.');
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      navigate('/login', {
        replace: true,
        state: { message: 'Password reset successfully. Please sign in with your new password.' },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] flex items-center justify-center p-4 sm:p-6 selection:bg-primary/20">
      <div className="w-full max-w-md p-8 sm:p-10 rounded-4xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-lg text-center">
        <MascotBunny mood="calm" size={110} className="mx-auto mb-4 animate-bounce-subtle" />

        <h3 className="text-2xl font-bold font-heading text-deep-purple dark:text-white mb-2">
          {step === 1 && 'Reset Password'}
          {step === 2 && 'Check your email'}
          {step === 3 && 'New Password'}
        </h3>
        <p className="text-xs text-muted-purple mb-6">
          {step === 1 && "Enter your email and, if an account exists, we’ll send secure reset instructions."}
          {step === 2 && 'If an account exists for this email and email delivery is configured, reset instructions will be sent.'}
          {step === 3 && 'Choose a strong new password for your Taskora account.'}
        </p>
        {formError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-left text-xs text-rose-700">{formError}</p>}

        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-4 text-left">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="name@university.edu"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} pill className="w-full py-3 text-xs font-bold">
              <span>{loading ? 'Sending...' : 'Send Reset Instructions'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Button type="button" onClick={() => navigate('/login')} pill className="w-full py-3 text-xs font-bold">
              <span>Return to login</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4 text-left">
            <div>
              <label htmlFor="reset-password" className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                Enter New Password
              </label>
              <input
                id="reset-password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                autoComplete="new-password"
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFormError(null);
                }}
                className="w-full text-xs px-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="At least 8 characters"
              />
            </div>

            <Button type="submit" disabled={loading} pill className="w-full py-3 text-xs font-bold">
              <span>{loading ? 'Saving...' : 'Set New Password'}</span>
              <CheckCircle2 className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        <div className="mt-6 text-xs text-muted-purple">
          Remembered your password?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};
