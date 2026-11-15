import React from 'react';
import { Card } from './Card';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  variant: 'purple' | 'pink' | 'mint' | 'peach';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant,
  className,
}) => {
  const iconVariants = {
    purple: {
      bg: 'bg-[#EDE8FC] dark:bg-primary/20',
      text: 'text-[#9885E8] dark:text-[#C7B9F5]',
      border: 'border-[#DDD4F9] dark:border-primary/30',
      badge: 'text-[#8772E2] dark:text-[#C7B9F5]',
    },
    pink: {
      bg: 'bg-[#F7DDED] dark:bg-pink-900/30',
      text: 'text-[#C4679D] dark:text-pink-300',
      border: 'border-[#F0C9E2] dark:border-pink-800/40',
      badge: 'text-[#9B4D7D] dark:text-pink-300',
    },
    mint: {
      bg: 'bg-[#DDF3E9] dark:bg-emerald-900/30',
      text: 'text-[#3E9872] dark:text-emerald-300',
      border: 'border-[#C1E8D6] dark:border-emerald-800/40',
      badge: 'text-[#2D7C5D] dark:text-emerald-300',
    },
    peach: {
      bg: 'bg-[#FEF3D6] dark:bg-amber-900/30',
      text: 'text-[#D98A16] dark:text-amber-300',
      border: 'border-[#F8E3B2] dark:border-amber-800/40',
      badge: 'text-[#A86B12] dark:text-amber-300',
    },
  };

  const style = iconVariants[variant];

  return (
    <Card className={cn('p-5 flex items-center justify-between group hover:border-primary/40', className)}>
      <div className="flex items-center gap-4">
        {/* Pastel 3D-styled rounded icon box */}
        <div
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-105',
            style.bg,
            style.text,
            style.border
          )}
        >
          <Icon className="w-7 h-7 stroke-[2.2]" />
        </div>

        {/* Content */}
        <div>
          <span className="text-xs font-medium text-muted-purple block mb-0.5">
            {title}
          </span>
          <div className="text-2xl font-bold tracking-tight text-deep-purple dark:text-white font-heading">
            {value}
          </div>
          <span className={cn('text-xs font-medium block mt-0.5', style.badge)}>
            {subtitle}
          </span>
        </div>
      </div>
    </Card>
  );
};
