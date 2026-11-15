import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface MascotProps {
  mood?: 'happy' | 'focus' | 'celebrate' | 'calm' | 'confused';
  size?: number | string;
  className?: string;
  showSparkles?: boolean;
}

export const MascotBunny: React.FC<MascotProps> = ({
  mood = 'happy',
  size = 120,
  className = '',
  showSparkles = true,
}) => {
  const { config } = useTheme();

  if (config.mascot === 'none') {
    return null;
  }

  const renderMoodElements = () => {
    switch (mood) {
      case 'focus':
        return (
          <>
            {/* Cute round wireframe glasses */}
            <circle cx="48" cy="62" r="12" fill="none" stroke="#55458A" strokeWidth="2.5" />
            <circle cx="80" cy="62" r="12" fill="none" stroke="#55458A" strokeWidth="2.5" />
            <line x1="60" y1="62" x2="68" y2="62" stroke="#55458A" strokeWidth="2.5" />
            {/* Lavender study book */}
            <rect x="42" y="86" width="44" height="26" rx="4" fill="#9885E8" />
            <path d="M64 86 L64 112" stroke="#FFFFFF" strokeWidth="2" />
            <rect x="46" y="90" width="14" height="3" rx="1.5" fill="#FFFFFF" opacity="0.8" />
            <rect x="68" y="90" width="14" height="3" rx="1.5" fill="#FFFFFF" opacity="0.8" />
          </>
        );

      case 'celebrate':
        return (
          <>
            {/* Little lavender party hat */}
            <polygon points="64,12 50,38 78,38" fill="#9885E8" />
            <circle cx="64" cy="11" r="4.5" fill="#FEF3D6" />
            <line x1="53" y1="28" x2="75" y2="28" stroke="#F7DDED" strokeWidth="2.5" />
            {/* Sparkling stars */}
            <path d="M24 35 L26 40 L31 42 L26 44 L24 49 L22 44 L17 42 L22 40 Z" fill="#FFD166" />
            <path d="M102 30 L104 34 L108 36 L104 38 L102 42 L100 38 L96 36 L100 34 Z" fill="#FFD166" />
            {/* Chubby hands raised */}
            <ellipse cx="40" cy="78" rx="8" ry="6" fill="#FFF7FA" />
            <ellipse cx="88" cy="78" rx="8" ry="6" fill="#FFF7FA" />
          </>
        );

      case 'confused':
        return (
          <>
            {/* Tilted eyes and sweatdrop */}
            <ellipse cx="48" cy="58" rx="4" ry="4" fill="#55458A" />
            <ellipse cx="80" cy="62" rx="4.5" ry="3.5" fill="#55458A" />
            {/* Question mark float */}
            <text x="96" y="44" fill="#9885E8" fontSize="22" fontWeight="bold" fontFamily="Quicksand">?</text>
            <path d="M60 74 Q64 70 68 74" fill="none" stroke="#55458A" strokeWidth="2.2" strokeLinecap="round" />
          </>
        );

      case 'calm':
        return (
          <>
            {/* Sleeping serene curved eyes */}
            <path d="M44 60 Q48 65 52 60" fill="none" stroke="#55458A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M76 60 Q80 65 84 60" fill="none" stroke="#55458A" strokeWidth="2.5" strokeLinecap="round" />
            {/* Little cup of warm tea */}
            <rect x="54" y="88" width="20" height="18" rx="4" fill="#DDF3E9" />
            <path d="M74 92 C78 92 78 98 74 98" fill="none" stroke="#2D7C5D" strokeWidth="2" />
            <path d="M61 84 Q64 80 62 76" fill="none" stroke="#C7B9F5" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          </>
        );

      case 'happy':
      default:
        return (
          <>
            {/* Happy eyes with glint */}
            <circle cx="48" cy="60" r="4.5" fill="#55458A" />
            <circle cx="80" cy="60" r="4.5" fill="#55458A" />
            <circle cx="50" cy="58" r="1.5" fill="#FFFFFF" />
            <circle cx="82" cy="58" r="1.5" fill="#FFFFFF" />
            {/* Happy smiling mouth */}
            <path d="M60 71 Q64 76 68 71" fill="none" stroke="#55458A" strokeWidth="2" strokeLinecap="round" />
            {/* Soft pink heart held in paws like the Pinterest reference */}
            <path
              d="M64 96 C64 96 52 86 52 79 C52 74 56 71 60 71 C62.5 71 64 73 64 73 C64 73 65.5 71 68 71 C72 71 76 74 76 79 C76 86 64 96 64 96 Z"
              fill="#F7DDED"
              stroke="#E8A9CD"
              strokeWidth="1.5"
            />
            {/* Paws holding heart */}
            <circle cx="53" cy="80" r="5" fill="#FFF7FA" />
            <circle cx="75" cy="80" r="5" fill="#FFF7FA" />
          </>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-center relative select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 128 128"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        {/* Shadow base */}
        <ellipse cx="64" cy="116" rx="36" ry="7" fill="rgba(152, 133, 232, 0.16)" />

        {/* Bunny Left Ear */}
        <g className="origin-bottom-center transition-transform duration-300 hover:-rotate-3">
          <ellipse cx="46" cy="32" rx="13" ry="28" fill="#FFF7FA" stroke="#EFE5F7" strokeWidth="1.5" />
          <ellipse cx="46" cy="34" rx="7" ry="18" fill="#F7DDED" />
        </g>

        {/* Bunny Right Ear */}
        <g className="origin-bottom-center transition-transform duration-300 hover:rotate-3">
          <ellipse cx="82" cy="32" rx="13" ry="28" fill="#FFF7FA" stroke="#EFE5F7" strokeWidth="1.5" />
          <ellipse cx="82" cy="34" rx="7" ry="18" fill="#F7DDED" />
        </g>

        {/* Chubby Head and Body */}
        <ellipse cx="64" cy="74" rx="36" ry="34" fill="#FFF7FA" stroke="#EFE5F7" strokeWidth="1.5" />

        {/* Soft Blush Cheeks */}
        <circle cx="38" cy="68" r="6" fill="#F7DDED" opacity="0.85" />
        <circle cx="90" cy="68" r="6" fill="#F7DDED" opacity="0.85" />

        {/* Tiny nose */}
        <ellipse cx="64" cy="66" rx="2.5" ry="1.8" fill="#E8A9CD" />

        {/* Dynamic Mood Elements */}
        {renderMoodElements()}

        {/* Sparkles & Star decorations if enabled in theme */}
        {config.decorationsEnabled && showSparkles && (
          <>
            <path
              d="M18 22 L20 26 L24 28 L20 30 L18 34 L16 30 L12 28 L16 26 Z"
              fill="#C7B9F5"
              className="animate-pulse-subtle"
            />
            <path
              d="M108 52 L110 55 L113 56 L110 57 L108 60 L106 57 L103 56 L106 55 Z"
              fill="#FFD166"
              className="animate-pulse-subtle"
            />
            <circle cx="106" cy="22" r="2.5" fill="#F7DDED" />
            <circle cx="22" cy="68" r="2" fill="#DDF3E9" />
          </>
        )}
      </svg>
    </div>
  );
};
