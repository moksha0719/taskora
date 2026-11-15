import React from 'react';
import { Card } from '../common/Card';
import { MascotBunny } from '../common/MascotBunny';

export const BunnyMotivationCard: React.FC = () => {
  return (
    <Card className="p-6 bg-gradient-to-r from-primary-subtle/50 via-white to-soft-pink/30 dark:from-[#1E163B] dark:to-[#2B1D3D] border-primary-light/40 relative overflow-hidden flex items-center justify-between">
      <div className="z-10 max-w-[65%]">
        <h4 className="text-base sm:text-lg font-bold font-heading text-deep-purple dark:text-white leading-snug">
          You're doing amazing!
        </h4>
        <p className="text-xs text-muted-purple font-medium mt-1 flex items-center gap-1">
          Keep up the good work ✨
        </p>
      </div>

      <div className="flex-shrink-0 relative">
        <MascotBunny mood="happy" size={100} className="animate-float" />
      </div>
    </Card>
  );
};
