import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  BookOpen,
  Layers,
  Bot,
  Lightbulb,
  Hourglass,
  Flame,
  FolderKanban,
  Users,
  BarChart3,
  Trophy,
  Palette,
  ShieldAlert,
  Settings,
  Sparkles,
  Heart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className }) => {
  const { user } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', path: '/tasks', icon: CheckSquare },
    { label: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { label: 'Study Planner', path: '/study-planner', icon: BookOpen },
    { label: 'Flashcards', path: '/flashcards', icon: Layers },
    { label: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'Proposals' },
    { label: 'Brain Dump', path: '/brain-dump', icon: Lightbulb },
    { label: 'Focus Mode', path: '/focus', icon: Hourglass },
    { label: 'Habits', path: '/habits', icon: Flame },
    { label: 'Workspace', path: '/workspace', icon: FolderKanban },
    { label: 'Study Rooms', path: '/study-rooms', icon: Users },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Achievements', path: '/achievements', icon: Trophy },
    { label: 'Theme Studio', path: '/theme-studio', icon: Palette },
    ...(user?.role === 'admin'
      ? [{ label: 'Admin Area', path: '/admin', icon: ShieldAlert, badge: 'Admin' }]
      : []),
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'w-64 flex-shrink-0 flex flex-col justify-between p-4 bg-sidebar dark:bg-[#181131] border-r border-subtle min-h-screen custom-scrollbar overflow-y-auto select-none',
        className
      )}
    >
      <div>
        {/* User Profile Header - Matches Reference Avatar & Welcome */}
        <div className="flex flex-col items-center text-center pt-4 pb-6 px-3 border-b border-subtle/80 mb-4">
          <div className="relative mb-3 group">
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-primary to-soft-pink shadow-lavender-sm">
              <img
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
                alt={user?.name || 'User Avatar'}
                className="w-full h-full object-cover rounded-full bg-white"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-[#1E163B] flex items-center justify-center shadow-sm text-xs">
              ✨
            </div>
          </div>
          <h2 className="text-base font-bold font-heading text-deep-purple dark:text-white flex items-center gap-1.5">
            Hi, {user?.name?.split(' ')[0] || 'there'}! 👋
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Good to see you again
          </p>
        </div>

        {/* Navigation Items List */}
        <nav className="space-y-1 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 group',
                    isActive
                      ? 'bg-primary text-white shadow-lavender-sm'
                      : 'text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle/80 dark:hover:bg-primary/20'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          'w-4 h-4 transition-transform group-hover:scale-110',
                          isActive ? 'text-white' : 'text-primary dark:text-lavender-300'
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-bold',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-primary-subtle text-primary dark:bg-primary/30 dark:text-lavender-200'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Motivation Card - Matches Reference "Take breaks, stay positive" */}
      <div className="mt-6 pt-3 px-1">
        <div className="p-3.5 rounded-3xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-sm flex flex-col items-center text-center relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-mint-accent dark:bg-emerald-950/40 flex items-center justify-center text-xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
            🪴
          </div>
          <span className="text-xs font-bold text-deep-purple dark:text-white">
            Take breaks,
          </span>
          <span className="text-xs font-medium text-muted-purple flex items-center gap-1 mt-0.5">
            stay positive 🌸
          </span>
        </div>
      </div>
    </aside>
  );
};
