import React from 'react';
import { cn } from '../../lib/utils';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-lavender-100/80 dark:bg-lavender-900/30 rounded-2xl',
        className
      )}
    />
  );
};
