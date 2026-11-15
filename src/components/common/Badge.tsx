import React from 'react';
import { cn } from '../../lib/utils';
import { TaskPriority, TaskStatus } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'pink' | 'mint' | 'peach' | 'blue' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'sm',
  className,
}) => {
  const variants = {
    primary: 'bg-primary-subtle text-primary border border-primary/20 dark:bg-primary/20 dark:text-lavender-200',
    pink: 'bg-soft-pink text-soft-pink-text border border-soft-pink-text/20 dark:bg-soft-pink/30 dark:text-pink-300',
    mint: 'bg-mint-accent text-mint-accent-text border border-mint-accent-text/20 dark:bg-mint-accent/20 dark:text-emerald-300',
    peach: 'bg-soft-peach text-soft-peach-text border border-soft-peach-text/20 dark:bg-soft-peach/20 dark:text-amber-300',
    blue: 'bg-soft-blue text-soft-blue-text border border-soft-blue-text/20 dark:bg-soft-blue/20 dark:text-sky-300',
    muted: 'bg-lavender-100 text-muted-purple dark:bg-lavender-900/40 dark:text-lavender-300',
    outline: 'border border-primary-light/50 text-muted-purple',
  };

  const sizes = {
    sm: 'text-[11px] font-medium px-2.5 py-0.5 rounded-full',
    md: 'text-xs font-semibold px-3 py-1 rounded-full',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 leading-none select-none', variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  switch (priority) {
    case 'urgent':
      return <Badge variant="pink">Urgent 🔥</Badge>;
    case 'high':
      return <Badge variant="peach">High ⚡</Badge>;
    case 'medium':
      return <Badge variant="primary">Medium</Badge>;
    case 'low':
    default:
      return <Badge variant="muted">Low</Badge>;
  }
};

export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <Badge variant="mint">Completed ✓</Badge>;
    case 'in_progress':
      return <Badge variant="peach">In Progress</Badge>;
    case 'in_review':
      return <Badge variant="blue">In Review</Badge>;
    case 'todo':
    default:
      return <Badge variant="primary">To Do</Badge>;
  }
};
