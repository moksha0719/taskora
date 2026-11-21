import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { MascotBunny } from '../../components/common/MascotBunny';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../lib/api/client';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [step, setStep] = useState<1 | 2 | 3>(resetToken ? 3 : 1);
  const [email, setEmail] = useState('emily.watson@university.edu');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    authApi.forgotPassword(email).then(() => {
      setLoading(false);
      setStep(2);
    }).catch((error) => {
      setLoading(false);
      alert(error instanceof Error ? error.message : 'Unable to request password reset.');
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!resetToken) {
      setLoading(false);
      alert('The password reset link is missing or invalid.');
      return;
    }
    authApi.resetPassword(resetToken, newPassword).then(() => {
      setLoading(false);
      navigate('/login');
    }).catch((error) => {
      setLoading(false);
      alert(error instanceof Error ? error.message : 'Unable to reset password.');
    });
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
          {          step === 1 && "Enter your email and, if an account exists, we’ll send secure reset instructions."}
          {step === 2 && 'If an account exists for this email and email delivery is configured, reset instructions will be sent.'}
          {step === 3 && 'Choose a strong new password for your Taskora account.'}
        </p>

        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                Enter New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
