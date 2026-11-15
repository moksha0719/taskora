import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { MascotBunny } from '../../components/common/MascotBunny';
import { Mail, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('emily.watson@university.edu');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 600);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 600);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Password updated successfully! You can now log in.');
      navigate('/login');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] flex items-center justify-center p-4 sm:p-6 selection:bg-primary/20">
      <div className="w-full max-w-md p-8 sm:p-10 rounded-4xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-lg text-center">
        <MascotBunny mood="calm" size={110} className="mx-auto mb-4 animate-bounce-subtle" />

        <h3 className="text-2xl font-bold font-heading text-deep-purple dark:text-white mb-2">
          {step === 1 && 'Reset Password'}
          {step === 2 && 'Enter Reset Code'}
          {step === 3 && 'New Password'}
        </h3>
        <p className="text-xs text-muted-purple mb-6">
          {step === 1 && "Don't worry! Enter your email and we'll send a 6-digit verification code."}
          {step === 2 && `We sent a code to ${email}. Check your inbox! (Demo code: 492015)`}
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
              <span>{loading ? 'Sending...' : 'Send Verification Code'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                6-Digit Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono tracking-widest text-center"
                  placeholder="492015"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} pill className="w-full py-3 text-xs font-bold">
              <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
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
