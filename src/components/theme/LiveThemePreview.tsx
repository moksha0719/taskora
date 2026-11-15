import React from 'react';
import { ThemeConfig } from '../../types';
import { MascotBunny } from '../common/MascotBunny';
import { Check, Star, Calendar } from 'lucide-react';

interface LiveThemePreviewProps {
  config: ThemeConfig;
}

export const LiveThemePreview: React.FC<LiveThemePreviewProps> = ({ config }) => {
  const isDark = config.darkMode === 'dark';

  return (
    <div
      className="p-6 rounded-3xl border border-subtle transition-all duration-300 shadow-lavender"
      style={{
        backgroundColor: isDark ? '#140F24' : config.backgroundColor,
        color: isDark ? '#F5F1FF' : config.textColor,
        fontFamily: config.fontBody,
      }}
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-subtle/60">
        <div>
          <span
            className="text-xs uppercase font-bold tracking-wider"
            style={{ color: config.primaryColor }}
          >
            Live Theme Preview
          </span>
          <h4
            className="text-lg font-bold"
            style={{
              fontFamily: config.fontHeading,
              color: isDark ? '#FFFFFF' : config.textColor,
            }}
          >
            Good morning, Emily! ☁️
          </h4>
        </div>
        {config.mascot !== 'none' && (
          <MascotBunny mood="happy" size={54} showSparkles={config.decorationsEnabled} />
        )}
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className="p-3.5 rounded-2xl border flex items-center gap-3 shadow-xs"
          style={{
            backgroundColor: isDark ? '#1E163B' : config.surfaceColor,
            borderColor: '#E8E0FA',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
            }}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs opacity-70">Tasks Done</div>
            <div className="text-lg font-bold leading-tight">24</div>
          </div>
        </div>

        <div
          className="p-3.5 rounded-2xl border flex items-center gap-3 shadow-xs"
          style={{
            backgroundColor: isDark ? '#1E163B' : config.surfaceColor,
            borderColor: '#E8E0FA',
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-soft-peach flex items-center justify-center text-soft-peach-text">
            <Star className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="text-xs opacity-70">Focus Time</div>
            <div className="text-lg font-bold leading-tight">18h</div>
          </div>
        </div>
      </div>

      {/* Mini Interactive Sample Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-md border flex items-center justify-center text-white text-[10px]"
            style={{ backgroundColor: config.primaryColor, borderColor: config.primaryColor }}
          >
            ✓
          </div>
          <span className="text-xs font-medium">Design landing page 🎨</span>
        </div>

        <button
          type="button"
          className="px-4 py-2 rounded-full text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
          }}
        >
          Lavender Action
        </button>
      </div>
    </div>
  );
};
