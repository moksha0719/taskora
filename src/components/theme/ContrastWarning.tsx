import React from 'react';
import { getContrastRatio } from '../../lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ContrastWarningProps {
  textColor: string;
  bgColor: string;
}

export const ContrastWarning: React.FC<ContrastWarningProps> = ({ textColor, bgColor }) => {
  const ratio = getContrastRatio(textColor, bgColor);
  const passesAA = ratio >= 4.5;

  return (
    <div
      className={`p-3 rounded-2xl flex items-center gap-3 text-xs border ${
        passesAA
          ? 'bg-mint-accent/30 text-mint-accent-text border-mint-accent'
          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
      }`}
    >
      {passesAA ? (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <div>
        <span className="font-bold">
          Contrast Ratio: {ratio.toFixed(2)}:1
        </span>
        <span className="ml-1">
          {passesAA
            ? '(WCAG AA Compliant for accessible reading)'
            : '(Warning: Text contrast may be low. Consider a darker or lighter tone)'}
        </span>
      </div>
    </div>
  );
};
