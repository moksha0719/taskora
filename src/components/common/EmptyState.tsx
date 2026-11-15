import React from 'react';
import { MascotBunny } from './MascotBunny';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  mood?: 'confused' | 'happy' | 'calm';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  mood = 'confused',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
      <MascotBunny mood={mood} size={110} className="mb-4 animate-bounce-subtle" />
      <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted-purple max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} pill size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
