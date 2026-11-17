import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { MascotBunny } from '../../components/common/MascotBunny';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, ArrowRight, Lock, Mail, User as UserIcon, Check } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register, authError } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', score: 0, color: 'bg-muted-purple/20' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { label: 'Weak', score: 25, color: 'bg-rose-500' };
    if (score === 2) return { label: 'Fair', score: 50, color: 'bg-amber-500' };
    if (score === 3) return { label: 'Good', score: 75, color: 'bg-primary' };
    return { label: 'Strong', score: 100, color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setFormError('Please agree to the terms to proceed.');
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const message = await register(name, email, password);
      navigate('/login', { replace: true, state: { message } });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] flex items-center justify-center p-4 sm:p-6 selection:bg-primary/20">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-4xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-lg overflow-hidden">
        {/* Left Side: Mascot Panel */}
        <div className="bg-gradient-to-br from-primary-subtle via-[#FAF6FE] to-soft-pink/40 dark:from-[#181131] dark:to-[#2B1D3D] p-8 sm:p-12 flex flex-col justify-between items-center text-center border-b md:border-b-0 md:border-r border-subtle">
          <div className="flex items-center gap-2 self-start">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
              <MascotBunny mood="happy" size={26} showSparkles={false} />
            </div>
            <span className="font-extrabold font-heading text-lg text-deep-purple dark:text-white">
              Taskora
            </span>
          </div>

          <div className="my-8">
            <MascotBunny mood="celebrate" size={150} className="animate-float mb-4" />
            <h2 className="text-xl font-bold font-heading text-deep-purple dark:text-white">
              Join Taskora Today! ✨
            </h2>
            <p className="text-xs text-muted-purple mt-2 max-w-xs mx-auto leading-relaxed">
              Create your account to unlock smart timetables, AI study suggestions, and gamified achievement badges.
            </p>
          </div>

          <div className="space-y-1.5 text-xs text-muted-purple text-left w-full max-w-xs bg-white/70 dark:bg-[#1E163B]/60 p-3.5 rounded-2xl border border-subtle">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Full access to study timetable generator</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>AI task proposal reviews & conversions</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Unlimited focus mode & habit streaks</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
              Create Account
            </h3>
            <p className="text-xs text-muted-purple mt-1">
              Start your journey to organized, calm productivity.
            </p>
          </div>

          {(formError || authError) && (
            <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError || authError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Emily Watson"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                University / Personal Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="emily@university.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-2.5 text-muted-purple hover:text-deep-purple"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full bg-lavender-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-purple">
                    <span>Password Strength:</span>
                    <span className="font-bold">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Repeat your password"
                />
              </div>
            </div>

            <div className="flex items-center pt-1">
              <input
                id="agreeTerms"
                type="checkbox"
                required
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-subtle cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="ml-2 text-xs text-muted-purple cursor-pointer">
                I agree to the Terms of Service & Privacy Guidelines
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              pill
              className="w-full py-3 text-xs font-bold mt-2"
            >
              <span>{loading ? 'Creating...' : 'Create Free Account'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="text-center text-xs text-muted-purple mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
