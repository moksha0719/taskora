import { DashboardWidgetConfig, ThemeConfig } from '../types';

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: 'lavender',
  primaryColor: '#9885E8',
  secondaryColor: '#C7B9F5',
  backgroundColor: '#F5F1FF',
  surfaceColor: '#FFFFFF',
  textColor: '#55458A',
  fontHeading: 'Plus Jakarta Sans',
  fontBody: 'Inter',
  cardStyle: 'rounded-24',
  mascot: 'bunny',
  decorationsEnabled: true,
  darkMode: 'light',
};

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'study_calendar', title: 'Study Calendar', enabled: true, order: 1 },
  { id: 'focus_timer', title: 'Today Focus', enabled: true, order: 2 },
  { id: 'study_plan', title: 'Study Plan', enabled: true, order: 3 },
  { id: 'stats_overview', title: 'Key Metrics', enabled: true, order: 4 },
  { id: 'productivity_chart', title: 'Productivity Overview', enabled: true, order: 5 },
  { id: 'today_tasks', title: "Today's Tasks", enabled: true, order: 6 },
  { id: 'recent_activity', title: 'Recent Activity Feed', enabled: true, order: 7 },
  { id: 'bunny_motivation', title: 'Bunny Mascot Motivation Card', enabled: true, order: 8 },
];
