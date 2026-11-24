import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  User as UserIcon,
  Sparkles,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationsApi } from '../../lib/api/client';
import { NotificationItem } from '../../types';

interface TopBarProps {
  onToggleMobileNav: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileNav }) => {
  const { user, logout } = useAuth();
  const { config, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationRequest = React.useRef(0);

  const loadNotifications = React.useCallback(async () => {
    if (!user) {
      notificationRequest.current += 1;
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError(null);
      setLoadingNotifications(false);
      return;
    }
    const requestId = ++notificationRequest.current;
    setLoadingNotifications(true);
    try {
      const [items, unread] = await Promise.all([
        notificationsApi.getNotifications(),
        notificationsApi.getUnreadCount(),
      ]);
      if (requestId === notificationRequest.current) {
        setNotifications(items);
        setUnreadCount(unread);
        setNotificationError(null);
      }
    } catch (cause) {
      if (requestId === notificationRequest.current) {
        setNotificationError(cause instanceof Error ? cause.message : 'Unable to load notifications.');
      }
    } finally {
      if (requestId === notificationRequest.current) setLoadingNotifications(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      void loadNotifications();
      return;
    }
    void loadNotifications();
    const refresh = (event?: Event) => {
      const delta = event instanceof CustomEvent
        ? (event.detail as { unreadCountDelta?: unknown } | undefined)?.unreadCountDelta
        : undefined;
      if (typeof delta === 'number' && Number.isFinite(delta)) {
        setUnreadCount((currentCount) => Math.max(0, currentCount + delta));
      }
      void loadNotifications();
    };
    window.addEventListener('taskora:notifications-updated', refresh);
    const interval = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('taskora:notifications-updated', refresh);
      window.clearInterval(interval);
    };
  }, [user, loadNotifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    setShowNotifications(false);
    if (!item.read) {
      try {
        await notificationsApi.markRead(item.id);
        window.dispatchEvent(new CustomEvent('taskora:notifications-updated', {
          detail: { unreadCountDelta: -1 },
        }));
      } catch (cause) {
        setNotificationError(cause instanceof Error ? cause.message : 'Unable to mark this notification as read.');
      }
    }
    if (item.actionUrl) navigate(item.actionUrl);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="h-16 sm:h-20 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 border-b border-subtle bg-surface/70 backdrop-blur-md sticky top-0 z-30 transition-colors">
      {/* Left Greeting & Mobile Toggle */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <button
          onClick={onToggleMobileNav}
          className="md:hidden shrink-0 p-2 rounded-2xl text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-xl lg:text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-1 sm:gap-2">
            <span className="truncate">{getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!</span>
            <span className="text-xl animate-float inline-block">👋</span>
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-purple mt-0.5">
            Let's make today productive.
          </p>
        </div>
      </div>

      {/* Right Top Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
        {/* Search Icon Trigger */}
        <button
          onClick={() => navigate('/search')}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications Button with Badge */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) void loadNotifications();
            }}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95 relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#1E163B] shadow-sm animate-pulse-subtle"
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Notification Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-1.5rem))] sm:w-96 rounded-3xl bg-surface dark:bg-[#1E163B] border border-subtle shadow-lavender-lg p-4 z-50 animate-fade-in">
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
              {notificationError && <p role="alert" className="py-2 text-xs text-rose-600">{notificationError}</p>}
              <div className="py-2 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {loadingNotifications && <p role="status" className="py-3 text-center text-xs text-muted-purple">Loading notifications...</p>}
                {!loadingNotifications && !notificationError && notifications.length === 0 && (
                  <p className="py-3 text-center text-xs text-muted-purple">No notifications yet.</p>
                )}
                {notifications.slice(0, 3).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => void handleNotificationClick(item)}
                    className="flex w-full items-start gap-3 rounded-2xl border-0 bg-transparent p-2.5 text-left transition-colors hover:bg-primary-subtle/50"
                  >
                      <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.read ? 'bg-muted-purple/30' : 'bg-primary'}`} />
                      <div>
                        <p className="text-xs font-bold text-deep-purple dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-purple line-clamp-2 mt-0.5">
                          {item.message}
                        </p>
                      </div>
                    </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-[#1E163B] border border-subtle flex items-center justify-center text-muted-purple hover:text-primary hover:border-primary/50 shadow-lavender-sm transition-all active:scale-95"
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
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-primary/30 p-0.5 overflow-hidden shadow-lavender-sm active:scale-95 transition-all"
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
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
