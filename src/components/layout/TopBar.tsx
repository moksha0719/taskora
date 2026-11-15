import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  Sparkles,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { INITIAL_NOTIFICATIONS } from '../../lib/mockData';
import { cn } from '../../lib/utils';

interface TopBarProps {
  onToggleMobileNav: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileNav }) => {
  const { user, logout, switchUserRole } = useAuth();
  const { config, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = INITIAL_NOTIFICATIONS.filter((n) => !n.read).length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="h-20 px-6 sm:px-8 flex items-center justify-between border-b border-subtle bg-surface/70 backdrop-blur-md sticky top-0 z-30 transition-colors">
      {/* Left Greeting & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 rounded-2xl text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>{getGreeting()}, {user?.name?.split(' ')[0] || 'Emily'}!</span>
            <span className="text-xl animate-float inline-block">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-purple mt-0.5">
            Let's make today productive.
          </p>
        </div>
      </div>

      {/* Right Top Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Reference Image: AI Study Tip Card */}
        <div className="hidden xl:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white dark:bg-[#1E163B] border border-primary/20 shadow-lavender-sm text-xs">
          <div className="w-6 h-6 rounded-lg bg-primary-subtle text-primary flex items-center justify-center font-bold">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-bold text-primary uppercase tracking-wide">
              AI Study Tip
            </div>
            <div className="text-xs font-semibold text-deep-purple dark:text-white">
              You learn best in short, focused sessions. Keep going!
            </div>
          </div>
        </div>

        {/* Reference Image: 7 Day Streak Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-sm">
          <span className="text-base">🔥</span>
          <div className="text-left leading-tight">
            <span className="text-xs font-bold text-deep-purple dark:text-white">
              7 Day Streak
            </span>
          </div>
        </div>

        {/* Role Switcher Pill for instant testing of Admin vs Student */}
        <button
          onClick={() => switchUserRole(user?.role === 'admin' ? 'student' : 'admin')}
          title="Click to toggle between Student and Admin mode"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-subtle text-primary border border-primary/20 hover:scale-105 transition-all shadow-sm"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Role: <strong className="capitalize">{user?.role}</strong></span>
        </button>

        {/* Search Icon Trigger */}
        <button
          onClick={() => navigate('/search')}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications Button with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95 relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#1E163B] shadow-sm animate-pulse-subtle">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Notification Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-surface dark:bg-[#1E163B] border border-subtle shadow-lavender-lg p-4 z-50 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-subtle">
                <span className="font-bold text-sm font-heading text-deep-purple dark:text-white">
                  Notifications
                </span>
                <Link
                  to="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="py-2 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {INITIAL_NOTIFICATIONS.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setShowNotifications(false);
                      if (item.actionUrl) navigate(item.actionUrl);
                    }}
                    className="p-2.5 rounded-2xl hover:bg-primary-subtle/50 cursor-pointer transition-colors flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-deep-purple dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted-purple line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95"
          aria-label="Toggle dark mode"
        >
          {config.darkMode === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-primary" />
          )}
        </button>

        {/* User Profile Avatar / Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-10 h-10 rounded-full border border-primary/30 p-0.5 overflow-hidden shadow-lavender-sm active:scale-95 transition-all"
            aria-label="Open profile menu"
          >
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
              alt={user?.name || 'User'}
              className="w-full h-full object-cover rounded-full"
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-3 w-56 rounded-3xl bg-surface dark:bg-[#1E163B] border border-subtle shadow-lavender-lg p-3 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-subtle">
                <p className="text-xs font-bold text-deep-purple dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-[11px] text-muted-purple truncate">
                  {user?.email}
                </p>
              </div>
              <div className="py-2 space-y-1">
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle"
                >
                  <UserIcon className="w-4 h-4 text-primary" />
                  <span>Profile & Settings</span>
                </Link>
                <Link
                  to="/theme-studio"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Lavender Theme Studio</span>
                </Link>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
