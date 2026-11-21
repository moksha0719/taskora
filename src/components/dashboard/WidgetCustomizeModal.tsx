import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { DashboardWidgetConfig } from '../../types';
import { dashboardApi } from '../../lib/api/client';
import { ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { DEFAULT_DASHBOARD_WIDGETS } from '../../lib/defaults';

interface WidgetCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLayoutUpdated: (widgets: DashboardWidgetConfig[]) => void;
}

export const WidgetCustomizeModal: React.FC<WidgetCustomizeModalProps> = ({
  isOpen,
  onClose,
  onLayoutUpdated,
}) => {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() =>
    dashboardApi.getWidgets()
  );

  const toggleWidget = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    setWidgets(newWidgets);
  };

  const handleSave = () => {
    dashboardApi.saveWidgets(widgets);
    onLayoutUpdated(widgets);
    onClose();
  };

  const handleReset = () => {
    setWidgets(DEFAULT_DASHBOARD_WIDGETS);
    dashboardApi.saveWidgets(DEFAULT_DASHBOARD_WIDGETS);
    onLayoutUpdated(DEFAULT_DASHBOARD_WIDGETS);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Dashboard Layout"
      description="Choose which cards to display and reorder them according to your workflow."
      maxWidth="md"
    >
      <div className="space-y-2 py-2">
        {widgets.map((widget, idx) => (
          <div
            key={widget.id}
            className="flex items-center justify-between p-3 rounded-2xl bg-primary-subtle/30 dark:bg-[#1E163B] border border-subtle"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleWidget(widget.id)}
                className={`p-2 rounded-xl transition-colors ${
                  widget.enabled
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-muted-purple/20 text-muted-purple'
                }`}
                title={widget.enabled ? 'Disable widget' : 'Enable widget'}
              >
                {widget.enabled ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              <span
                className={`text-xs font-semibold ${
                  widget.enabled
                    ? 'text-deep-purple dark:text-white'
                    : 'text-muted-purple line-through'
                }`}
              >
                {widget.title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveWidget(idx, 'up')}
                disabled={idx === 0}
                className="p-1.5 rounded-lg text-muted-purple hover:bg-primary-subtle disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Move widget up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveWidget(idx, 'down')}
                disabled={idx === widgets.length - 1}
                className="p-1.5 rounded-lg text-muted-purple hover:bg-primary-subtle disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Move widget down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-subtle">
        <Button variant="outline" size="sm" onClick={handleReset} pill>
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} pill>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} pill>
            Save Layout
          </Button>
        </div>
      </div>
    </Modal>
  );
};
