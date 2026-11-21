import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LiveThemePreview } from '../components/theme/LiveThemePreview';
import { ContrastWarning } from '../components/theme/ContrastWarning';
import { useTheme, THEME_PRESETS } from '../context/ThemeContext';
import { ThemeConfig, ThemePresetId, MascotType } from '../types';
import { Palette, Sparkles, RotateCcw, Check, Sun, Moon, Laptop, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';

export const ThemeStudioPage: React.FC = () => {
  const {
    config,
    setPreset,
    updateConfig,
    resetToDefault,
    toggleDarkMode,
    toggleDecorations,
    setMascot,
  } = useTheme();

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.7 },
      colors: [config.primaryColor, config.secondaryColor, '#FEF3D6'],
    });
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Lavender Dream Theme Studio</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Personalize your workspace aesthetics. Changes preview live before you save.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" pill onClick={resetToDefault}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </Button>

          <Button variant="primary" size="sm" pill onClick={handleSave}>
            <Check className="w-4 h-4" />
            <span>{savedSuccess ? 'Saved!' : 'Save Theme'}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Controls on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Preset Palettes */}
          <Card className="p-6">
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white mb-3">
              Theme Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                const preset = THEME_PRESETS[presetKey];
                const isSelected = config.preset === presetKey;

                return (
                  <div
                    key={presetKey}
                    onClick={() => setPreset(presetKey)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30 bg-primary-subtle/30'
                        : 'border-subtle bg-white dark:bg-[#1E163B] hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-deep-purple dark:text-white">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        className="w-5 h-5 rounded-md border border-black/10"
                        style={{ backgroundColor: preset.primaryColor }}
                        title="Primary accent"
                      />
                      <div
                        className="w-5 h-5 rounded-md border border-black/10"
                        style={{ backgroundColor: preset.secondaryColor }}
                        title="Secondary accent"
                      />
                      <div
                        className="w-5 h-5 rounded-md border border-black/10"
                        style={{ backgroundColor: preset.backgroundColor }}
                        title="Background"
                      />
                      <div
                        className="w-5 h-5 rounded-md border border-black/10"
                        style={{ backgroundColor: preset.textColor }}
                        title="Text"
                      />
                    </div>

                    <p className="text-[11px] text-muted-purple line-clamp-1">
                      {preset.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Color Customizer with WCAG AA Contrast Validation */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white pb-2 border-b border-subtle">
              Color Adjustments & WCAG AA Contrast Check
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                  Primary Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-muted-purple">{config.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                  Secondary Lilac
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-muted-purple">{config.secondaryColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-muted-purple">{config.backgroundColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                  Surface Cards
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.surfaceColor}
                    onChange={(e) => updateConfig({ surfaceColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-muted-purple">{config.surfaceColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1">
                  Text Heading
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={(e) => updateConfig({ textColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-muted-purple">{config.textColor}</span>
                </div>
              </div>
            </div>

            {/* Live Contrast Warning Alert */}
            <ContrastWarning
              textColor={config.textColor}
              bgColor={config.surfaceColor}
            />
          </Card>

          {/* Typography, Card Style & Mascot Selectors */}
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mascot Selector */}
              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                  Study Mascot Companion
                </label>
                <select
                  value={config.mascot}
                  onChange={(e) => setMascot(e.target.value as MascotType)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
                >
                  <option value="bunny">Bramble the Bunny 🐰 (Default)</option>
                  <option value="kitten">Mochi the Kitten 🐱</option>
                  <option value="bear">Barnaby the Bear 🐻</option>
                  <option value="none">Minimalist (No Mascot)</option>
                </select>
              </div>

              {/* Card Style */}
              <div>
                <label className="block text-xs font-semibold text-deep-purple dark:text-lavender-200 mb-1.5">
                  Card Border Style
                </label>
                <select
                  value={config.cardStyle}
                  onChange={(e) =>
                    updateConfig({
                      cardStyle: e.target.value as ThemeConfig['cardStyle'],
                    })
                  }
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none"
                >
                  <option value="rounded-24">Lavender Soft (26px - Default)</option>
                  <option value="rounded-32">Extra Curved (32px)</option>
                  <option value="squircle">Squircle (20px)</option>
                  <option value="minimal">Sharp Minimal (12px)</option>
                </select>
              </div>
            </div>

            {/* Sparkles & Stickers Toggle */}
            <label className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/20 dark:bg-primary/5 cursor-pointer mt-2">
              <div>
                <span className="text-xs font-bold text-deep-purple dark:text-white block">
                  Decorative Stars, Sparkles & Stickers
                </span>
                <span className="text-[11px] text-muted-purple">
                  Enable subtle animated sparkles around motivation cards.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.decorationsEnabled}
                onChange={toggleDecorations}
                className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
              />
            </label>
          </Card>
        </div>

        {/* Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-purple flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>Real-Time Live Canvas</span>
            </span>
            <Badge variant="primary">Instant Preview</Badge>
          </div>

          <LiveThemePreview config={config} />

          <p className="text-[11px] text-muted-purple text-center px-4 leading-relaxed">
            All colors and radius values synchronize across your sessions and persist in your browser profile.
          </p>
        </div>
      </div>
    </div>
  );
};
