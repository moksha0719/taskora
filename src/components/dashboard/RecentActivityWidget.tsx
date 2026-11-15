import React from 'react';
import { Card } from '../common/Card';
import { Check, Folder, MessageCircle, UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';

export const RecentActivityWidget: React.FC = () => {
  const activities = [
    {
      id: 1,
      title: 'Completed "User Research"',
      time: '2h ago',
      icon: Check,
      bg: 'bg-mint-accent text-mint-accent-text dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      id: 2,
      title: 'Updated project "Website Redesign"',
      time: '5h ago',
      icon: Folder,
      bg: 'bg-soft-peach text-soft-peach-text dark:bg-amber-950/40 dark:text-amber-300',
    },
    {
      id: 3,
      title: 'New message from Sarah',
      time: '1d ago',
      icon: MessageCircle,
      bg: 'bg-soft-pink text-soft-pink-text dark:bg-pink-950/40 dark:text-pink-300',
    },
    {
      id: 4,
      title: 'Uploaded report.pdf',
      time: '2d ago',
      icon: UploadCloud,
      bg: 'bg-soft-blue text-soft-blue-text dark:bg-sky-950/40 dark:text-sky-300',
    },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3.5">
        {activities.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between py-1 group hover:bg-primary-subtle/30 px-2 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
                    item.bg
                  )}
                >
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-xs font-semibold text-deep-purple dark:text-lavender-100 truncate">
                  {item.title}
                </span>
              </div>
              <span className="text-[11px] font-medium text-muted-purple flex-shrink-0 ml-3">
                {item.time}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
