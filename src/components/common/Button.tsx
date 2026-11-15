import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  pill?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  pill = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const variants = {
    primary: 'btn-primary-gradient text-white shadow-lavender-sm',
    secondary: 'bg-primary-subtle text-primary hover:bg-lavender-200 dark:bg-primary-light/20 dark:text-lavender-200',
    outline: 'border border-primary-light/60 text-deep-purple hover:bg-primary-subtle/50 dark:border-primary/40 dark:text-lavender-100',
    ghost: 'text-deep-purple hover:bg-primary-subtle/50 dark:text-lavender-200 dark:hover:bg-primary/20',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
    icon: 'p-2.5 w-10 h-10',
  };

  const shape = pill ? 'rounded-full' : 'rounded-2xl';

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], shape, className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
