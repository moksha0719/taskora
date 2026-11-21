import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeConfig, ThemePresetId, MascotType } from '../types';
import { themeApi } from '../lib/api/client';

export const THEME_PRESETS: Record<ThemePresetId, Partial<ThemeConfig> & { name: string; description: string }> = {
  lavender: {
    name: 'Lavender Dream (Default)',
    description: 'Calm, soft lavender with gentle purple tones and dreamy aesthetics.',
    primaryColor: '#9885E8',
    secondaryColor: '#C7B9F5',
    backgroundColor: '#F5F1FF',
    surfaceColor: '#FFFFFF',
    textColor: '#55458A',
  },
  mint: {
    name: 'Mint Blossom',
    description: 'Refreshing sage mint with serene green accents and clean focus.',
    primaryColor: '#63B995',
    secondaryColor: '#B6E2D3',
    backgroundColor: '#F1F9F5',
    surfaceColor: '#FFFFFF',
    textColor: '#2E5945',
  },
  peach: {
    name: 'Peach Sunset',
    description: 'Warm pastel peach with gentle amber glow for cozy study evenings.',
    primaryColor: '#E68A6E',
    secondaryColor: '#FDD5C6',
    backgroundColor: '#FFF7F2',
    surfaceColor: '#FFFFFF',
    textColor: '#663B2B',
  },
  midnight: {
    name: 'Midnight Amethyst',
    description: 'Deep violet surfaces with vivid lilac highlights.',
    primaryColor: '#B298DC',
    secondaryColor: '#E2D9F3',
    backgroundColor: '#16102B',
    surfaceColor: '#231B40',
    textColor: '#EBE5FA',
  },
  bubblegum: {
    name: 'Bubblegum Dream',
    description: 'Playful pastel pink and baby blue with sparkling accents.',
    primaryColor: '#E879A8',
    secondaryColor: '#FCD4E5',
    backgroundColor: '#FFF2F8',
    surfaceColor: '#FFFFFF',
    textColor: '#6B3550',
  },
};

interface ThemeContextType {
  config: ThemeConfig;
  setPreset: (preset: ThemePresetId) => void;
  updateConfig: (updates: Partial<ThemeConfig>) => void;
  resetToDefault: () => void;
  toggleDarkMode: () => void;
  toggleDecorations: () => void;
  setMascot: (mascot: MascotType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(() => themeApi.getThemeConfig());

  // Apply theme tokens to root element
  useEffect(() => {
    const root = document.documentElement;

    // Handle dark mode class
    const isDark =
      config.darkMode === 'dark' ||
      (config.darkMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply color variables if not in standard dark mode or if customized
    if (!isDark) {
      root.style.setProperty('--color-primary', config.primaryColor);
      root.style.setProperty('--color-primary-light', config.secondaryColor);
      root.style.setProperty('--color-bg', config.backgroundColor);
      root.style.setProperty('--color-surface', config.surfaceColor);
      root.style.setProperty('--color-text-main', config.textColor);
    } else {
      // In dark mode keep harmonious dark variations
      root.style.setProperty('--color-primary', config.primaryColor);
      root.style.setProperty('--color-primary-light', '#3A2E63');
      root.style.setProperty('--color-bg', '#130E26');
      root.style.setProperty('--color-surface', '#1E163B');
      root.style.setProperty('--color-text-main', '#F3EFFF');
    }

    // Apply border radius
    if (config.cardStyle === 'rounded-32') {
      root.style.setProperty('--radius-card', '32px');
    } else if (config.cardStyle === 'squircle') {
      root.style.setProperty('--radius-card', '20px');
    } else if (config.cardStyle === 'minimal') {
      root.style.setProperty('--radius-card', '12px');
    } else {
      root.style.setProperty('--radius-card', '26px');
    }

    // Persist
    themeApi.saveThemeConfig(config);
  }, [config]);

  const setPreset = (preset: ThemePresetId) => {
    const presetValues = THEME_PRESETS[preset];
    if (presetValues) {
      setConfig((prev) => ({
        ...prev,
        ...presetValues,
        preset,
      }));
    }
  };

  const updateConfig = (updates: Partial<ThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const resetToDefault = () => {
    const def = themeApi.resetTheme();
    setConfig(def);
  };

  const toggleDarkMode = () => {
    setConfig((prev) => ({
      ...prev,
      darkMode: prev.darkMode === 'dark' ? 'light' : 'dark',
    }));
  };

  const toggleDecorations = () => {
    setConfig((prev) => ({
      ...prev,
      decorationsEnabled: !prev.decorationsEnabled,
    }));
  };

  const setMascot = (mascot: MascotType) => {
    setConfig((prev) => ({ ...prev, mascot }));
  };

  return (
    <ThemeContext.Provider
      value={{
        config,
        setPreset,
        updateConfig,
        resetToDefault,
        toggleDarkMode,
        toggleDecorations,
        setMascot,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
