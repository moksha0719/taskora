import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { CalendarPage } from './pages/CalendarPage';
import { StudyPlannerPage } from './pages/StudyPlannerPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { BrainDumpPage } from './pages/BrainDumpPage';
import { FocusPage } from './pages/FocusPage';
import { HabitsPage } from './pages/HabitsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { StudyRoomsPage } from './pages/StudyRoomsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThemeStudioPage } from './pages/ThemeStudioPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing & Auth Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Authenticated Application Shell */}
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/study-planner" element={<StudyPlannerPage />} />
              <Route path="/ai-assistant" element={<AIAssistantPage />} />
              <Route path="/brain-dump" element={<BrainDumpPage />} />
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/workspace" element={<WorkspacePage />} />
              <Route path="/study-rooms" element={<StudyRoomsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/theme-studio" element={<ThemeStudioPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* 404 Not Found Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
