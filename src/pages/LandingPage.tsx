import React from 'react';
import { Link } from 'react-router-dom';
import { MascotBunny } from '../components/common/MascotBunny';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import {
  Sparkles,
  BookOpen,
  Hourglass,
  Flame,
  CheckCircle2,
  Bot,
  Users,
  ArrowRight,
  ShieldCheck,
  Heart
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] text-deep-purple dark:text-white flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Top Navbar */}
      <header className="px-6 sm:px-12 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-soft-lilac flex items-center justify-center shadow-lavender-sm text-white">
            <MascotBunny mood="happy" size={32} showSparkles={false} />
          </div>
          <div>
            <span className="text-xl font-extrabold font-heading text-deep-purple dark:text-white tracking-tight">
              Taskora
            </span>
            <span className="block text-[10px] font-bold text-primary tracking-wider uppercase">
              Study & Growth
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" pill size="sm">
              Log in
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="primary" pill size="sm">
              <span>Open App</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 max-w-7xl mx-auto px-6 sm:px-12 py-12 lg:py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-subtle text-primary border border-primary/20 text-xs font-bold mb-6 animate-pulse-subtle">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Personal Productivity & Study Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight leading-[1.15] mb-6">
            Organize Your Life.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-lavender-400">
              Focus on Your Goals.
            </span>{' '}
            Achieve More.
          </h1>

          <p className="text-base sm:text-lg text-muted-purple mb-8 leading-relaxed">
            Stop jumping between fragmented tools. Taskora brings intelligent study planning,
            focus sessions, daily habits, and AI action proposals into one serene,
            pastel-tinted workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" pill className="w-full sm:w-auto">
                <span>Start Studying Free</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" pill className="w-full sm:w-auto">
                <span>Sign in</span>
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-xs text-muted-purple">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Free forever for students
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> Privacy-first data ownership
            </span>
          </div>
        </div>

        {/* Hero Illustration / Mascot Card */}
        <div className="relative w-full max-w-md flex items-center justify-center">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 to-soft-pink/40 rounded-full blur-3xl opacity-70 -z-10 animate-pulse-subtle" />
          <Card className="p-8 sm:p-10 w-full text-center relative border-2 border-primary/20 shadow-lavender-lg bg-white/90 dark:bg-[#1E163B]/90 backdrop-blur-md">
            <MascotBunny mood="happy" size={160} className="animate-float mb-4" />
            <h3 className="text-xl font-bold font-heading text-deep-purple dark:text-white">
              Meet Bramble 🌸
            </h3>
            <p className="text-xs text-muted-purple mt-1 max-w-xs mx-auto">
              Your personal study companion cheering you on through every Pomodoro and exam cram!
            </p>

          </Card>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="bg-surface/50 dark:bg-[#181131]/50 py-16 px-6 sm:px-12 border-y border-subtle">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-extrabold font-heading text-deep-purple dark:text-white">
              Engineered for Focused Minds
            </h2>
            <p className="text-sm text-muted-purple mt-2">
              Every workflow adheres to our "Lavender Dream" design system for zero visual clutter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 text-left hover:border-primary/40">
              <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-deep-purple dark:text-white mb-1.5 font-heading">
                Smart Study Planner
              </h3>
              <p className="text-xs text-muted-purple leading-relaxed">
                Balanced weekly study timetables distributed around your syllabus, exams, and energy cycles.
              </p>
            </Card>

            <Card className="p-6 text-left hover:border-primary/40">
              <div className="w-12 h-12 rounded-2xl bg-soft-pink text-soft-pink-text dark:bg-pink-950/40 dark:text-pink-300 flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-deep-purple dark:text-white mb-1.5 font-heading">
                AI Action Proposals
              </h3>
              <p className="text-xs text-muted-purple leading-relaxed">
                Structured proposals with Approve / Edit / Reject buttons. Nothing enters your calendar until approved.
              </p>
            </Card>

            <Card className="p-6 text-left hover:border-primary/40">
              <div className="w-12 h-12 rounded-2xl bg-mint-accent text-mint-accent-text dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center mb-4">
                <Hourglass className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-deep-purple dark:text-white mb-1.5 font-heading">
                Zen Focus & Rooms
              </h3>
              <p className="text-xs text-muted-purple leading-relaxed">
                Configurable circular Pomodoro timers, gentle audio chimes, and virtual study rooms with friends.
              </p>
            </Card>

            <Card className="p-6 text-left hover:border-primary/40">
              <div className="w-12 h-12 rounded-2xl bg-soft-peach text-soft-peach-text dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-center mb-4">
                <Flame className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-deep-purple dark:text-white mb-1.5 font-heading">
                Streaks & Gamification
              </h3>
              <p className="text-xs text-muted-purple leading-relaxed">
                Earn XP for study hours and task completions. Unlock badges and track 30-day consistency heatmaps.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section className="py-20 px-6 sm:px-12 max-w-6xl mx-auto w-full text-center">
        <h2 className="text-3xl font-extrabold font-heading text-deep-purple dark:text-white mb-3">
          How Taskora Transforms Your Routine
        </h2>
        <p className="text-sm text-muted-purple mb-14 max-w-xl mx-auto">
          A seamless loop from unstructured thoughts to celebrated milestones.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E163B] border border-subtle relative shadow-lavender-sm">
            <span className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center mb-4 shadow-sm">
              1
            </span>
            <h4 className="text-base font-bold text-deep-purple dark:text-white mb-2 font-heading">
              Brain Dump & AI Structuring
            </h4>
            <p className="text-xs text-muted-purple leading-relaxed">
              Jot messy thoughts into the Brain Dump. One click converts ramblings into actionable prioritized tasks.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E163B] border border-subtle relative shadow-lavender-sm">
            <span className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center mb-4 shadow-sm">
              2
            </span>
            <h4 className="text-base font-bold text-deep-purple dark:text-white mb-2 font-heading">
              Deep Work Sprints
            </h4>
            <p className="text-xs text-muted-purple leading-relaxed">
              Launch Focus Mode or join a Virtual Study Room. Distraction-free full screen with synchronized timers.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E163B] border border-subtle relative shadow-lavender-sm">
            <span className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center mb-4 shadow-sm">
              3
            </span>
            <h4 className="text-base font-bold text-deep-purple dark:text-white mb-2 font-heading">
              Level Up & Reflect
            </h4>
            <p className="text-xs text-muted-purple leading-relaxed">
              Watch your productivity line chart soar, maintain habit streaks, and level up your scholar profile.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-subtle py-8 px-6 sm:px-12 bg-white/50 dark:bg-[#181131]/60 text-xs text-muted-purple">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-deep-purple dark:text-white">Taskora</span>
            <span>• Organize Your Life. Focus on Your Goals. Achieve More.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
            <Link to="/tasks" className="hover:text-primary">Tasks</Link>
            <Link to="/study-planner" className="hover:text-primary">Study Planner</Link>
            <Link to="/theme-studio" className="hover:text-primary">Theme Studio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
