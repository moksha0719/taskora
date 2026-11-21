import React from 'react';
import { ThemeConfig } from '../../types';
import { MascotBunny } from '../common/MascotBunny';

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
            Your selected theme
          </h4>
        </div>
        {config.mascot !== 'none' && (
          <MascotBunny mood="happy" size={54} showSparkles={config.decorationsEnabled} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="p-3.5 rounded-2xl border shadow-xs"
          style={{
            backgroundColor: isDark ? '#1E163B' : config.surfaceColor,
            borderColor: '#E8E0FA',
          }}
        >
          <div className="w-full h-8 rounded-xl" style={{ backgroundColor: config.primaryColor }} />
          <div className="mt-2 text-xs opacity-70">Primary color</div>
        </div>

        <div
          className="p-3.5 rounded-2xl border shadow-xs"
          style={{
            backgroundColor: isDark ? '#1E163B' : config.backgroundColor,
            borderColor: '#E8E0FA',
          }}
        >
          <div className="w-full h-8 rounded-xl border border-subtle" style={{ backgroundColor: config.backgroundColor }} />
          <div className="mt-2 text-xs opacity-70">Background</div>
        </div>

        <div
          className="p-3.5 rounded-2xl border shadow-xs"
          style={{
            backgroundColor: isDark ? '#1E163B' : config.surfaceColor,
            borderColor: '#E8E0FA',
          }}
        >
          <div className="w-full h-8 rounded-xl border border-subtle" style={{ backgroundColor: config.surfaceColor }} />
          <div className="mt-2 text-xs opacity-70">Card surface</div>
        </div>
      </div>
    </div>
  );
};
