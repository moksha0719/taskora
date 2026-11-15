import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { MascotBunny } from '../../components/common/MascotBunny';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, UserCheck, ArrowRight, Lock, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('emily.watson@university.edu');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, 'student');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'student' | 'admin') => {
    setLoading(true);
    try {
      const demoEmail = role === 'admin' ? 'admin@taskora.edu' : 'emily.watson@university.edu';
      await login(demoEmail, role);
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] flex items-center justify-center p-4 sm:p-6 selection:bg-primary/20">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-4xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-lg overflow-hidden">
        {/* Left Side: Mascot & Motivational Panel */}
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
            <MascotBunny mood="happy" size={150} className="animate-float mb-4" />
            <h2 className="text-xl font-bold font-heading text-deep-purple dark:text-white">
              Welcome Back! 🌸
            </h2>
            <p className="text-xs text-muted-purple mt-2 max-w-xs mx-auto leading-relaxed">
              Log in to resume your study rituals, check off today's tasks, and keep your streak alive.
            </p>
          </div>

          <div className="text-[11px] text-muted-purple">
            Tagline: "Organize Your Life. Focus on Your Goals. Achieve More."
          </div>
        </div>

        {/* Right Side: Form & Quick Demo Logins */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
              Sign In
            </h3>
            <p className="text-xs text-muted-purple mt-1">
              Enter your credentials or choose a quick demo account.
            </p>
          </div>

          {/* Quick Demo Switcher */}
          <div className="mb-6 p-3 rounded-2xl bg-primary-subtle/40 dark:bg-primary/10 border border-primary/20 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Quick Test Accounts (SRS Evaluator)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('student')}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#1E163B] text-deep-purple dark:text-white border border-subtle hover:border-primary flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
              >
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                <span>Student Demo</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin')}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#1E163B] text-deep-purple dark:text-white border border-subtle hover:border-primary flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>Admin Demo</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                Email Address
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-purple absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-2.5 text-muted-purple hover:text-deep-purple"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-subtle cursor-pointer"
              />
              <label htmlFor="rememberMe" className="ml-2 text-xs text-muted-purple cursor-pointer">
                Remember this device for 30 days
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              pill
              className="w-full py-3 text-xs font-bold mt-2"
            >
              <span>{loading ? 'Signing in...' : 'Sign In to Taskora'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="text-center text-xs text-muted-purple mt-6">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-bold text-primary hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
