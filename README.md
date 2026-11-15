# Taskora 🌸
### *Organize Your Life. Focus on Your Goals. Achieve More.*

Taskora is an AI-powered personal productivity and study-management web application designed for university students and knowledge workers. It combines intelligent study timetable planning, focus sessions, daily habit tracking, rich academic workspaces, and structured AI action proposals in a calm, aesthetically cohesive environment.

---

## 🎨 Visual Identity — "Lavender Dream"

Taskora strictly implements the **Lavender Dream** design system across all views, referencing soft pastel 3D UI aesthetics with generous padding, large rounded cards (24–28px), and accessible contrast:

- **Primary Lavender:** `#9885E8`
- **Soft Lilac:** `#C7B9F5`
- **Dreamy Background:** `#F5F1FF`
- **Pure White Surfaces:** `#FFFFFF`
- **Deep Purple Typography:** `#55458A`
- **Muted Purple Secondary:** `#A99CCB`
- **Soft Pink (Warm / In Progress Cards):** `#F7DDED`
- **Mint Accent (Completed / Streaks):** `#DDF3E9`
- **Soft Peach / Amber (Focus Time Cards):** `#FEF3D6`
- **Soft Blue (Calendar Cards):** `#E8F1FF`
- **Dark Mode:** Deep purple surfaces (`#1E163B`), lavender accents, and WCAG AA contrast compliance.
- **Mascot Companion:** *Bramble the Bunny* (encouraging motivation cards, empty states, and celebrations).

---

## 🚀 Features & SRS Requirements Coverage (FR-01 to FR-20)

| Requirement | Module / Page | Highlights |
|---|---|---|
| **FR-01** Authentication | `/login`, `/register`, `/forgot-password` | Form validation, password strength meter, quick demo switcher (Student / Admin). |
| **FR-02** Dashboard | `/dashboard` | Exact visual match to reference: 4 pastel stat cards, productivity line chart with "Great job! 🎉" marker, to-do list with quick add, mini calendar, recent activity feed, and bunny motivation card. |
| **FR-03** AI Assistant | `/ai-assistant` | Conversational interface with **Structured Proposals** (Approve / Edit / Reject). *Nothing is saved until approved*. |
| **FR-04** Tasks Management | `/tasks` | List + Kanban board views, priority badges, category filters, subtask checklists, and bulk operations. |
| **FR-05** Smart Study Planner | `/study-planner` | Subject workload input, weekly study targets, conflict-free AI timetable generator. |
| **FR-06** Focus Mode | `/focus` | Circular progress Pomodoro timer (25/5 min), session subject labeling, ambient sound simulator, and calm Zen mode. |
| **FR-07** Habit Tracker | `/habits` | Daily single-click check-ins, flame streaks 🔥, and 28-day historical activity heatmap grid. |
| **FR-08** Analytics | `/analytics` | Period selector (7D, 30D, Semester), focus trend area chart, and course distribution pie chart. |
| **FR-09** Gamification | `/achievements` | Scholar levels, XP progression bar, badge collection, and immutable XP transaction ledger. |
| **FR-10** Study Workspace | `/workspace` | Subject categorized notes, rich-text editor, and **Private-by-default** security with explicit share toggles. |
| **FR-11** Brain Dump | `/brain-dump` | Rapid friction-free thought capture; "Organize with AI" proposal converter for instant review. |
| **FR-12** Virtual Study Rooms | `/study-rooms` | Public & private study rooms, passcode check, synchronized room Pomodoro timer, participant status, and quiet room chat. |
| **FR-13** Notifications | `/notifications` | Notification center with deadline, habit, room, and achievement alerts. |
| **FR-14** Search & Filter | `/search` | Global instant search across tasks, notes, and habits with filter tabs. |
| **FR-15** Profile & Settings | `/settings` | Profile details, degree major, privacy toggles, password management, and JSON data export. |
| **FR-16** Administration | `/admin` | Role-gated dashboard: operational overview, student directory, moderation queue, and audit log table. |
| **FR-17** Theme Management | `/theme-studio` | Predefined palettes (Lavender, Mint, Peach, Midnight, Bubblegum), custom color pickers with WCAG AA warnings, and live preview canvas. |
| **FR-18** Dashboard Personalization | `/dashboard` | Reorderable widgets with visibility toggles that persist across sessions. |
| **FR-19** Decorative Personalization | `/theme-studio` | Mascot selector (Bunny, Kitten, Bear, None) and animated sparkle decorations toggle. |
| **FR-20** Preference Synchronization | LocalStorage API | Cross-session preference persistence with one-click "Reset to Defaults". |

---

## 🛠️ Technology Stack

- **Framework:** React 18 + TypeScript + Vite
- **Routing:** React Router v6
- **Styling:** Tailwind CSS + Custom CSS Design Tokens (`tokens.css`)
- **Icons:** Lucide Icons (soft rounded style)
- **Charts:** Recharts (responsive area and pie charts)
- **Transitions:** Framer Motion & CSS cubic-bezier easing
- **Delight & Gamification:** Canvas-Confetti & Web Audio API chimes
- **Architecture:** Typed Mock API layer (`src/lib/api/*`) for immediate backend swapping with zero UI changes.

---

## 📁 Directory Structure

```
taskora/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ai/
│   │   │   └── ProposalCard.tsx       # AI Reviewable Actions (Approve / Reject)
│   │   ├── common/
│   │   │   ├── Badge.tsx              # Status & Priority badges
│   │   │   ├── Button.tsx             # Lavender gradient button
│   │   │   ├── Card.tsx               # Soft rounded surface card
│   │   │   ├── EmptyState.tsx         # Bunny mascot empty state
│   │   │   ├── MascotBunny.tsx        # Multi-expression SVG mascot
│   │   │   ├── Modal.tsx              # Accessible dialog overlay
│   │   │   ├── ProgressRing.tsx       # Circular Pomodoro SVG timer
│   │   │   ├── Skeleton.tsx           # Soft loading shimmer
│   │   │   └── StatCard.tsx           # 3D pastel stat cards
│   │   ├── dashboard/
│   │   │   ├── SemesterCalendarWidget.tsx # Interactive calendar with color dots
│   │   │   ├── PomodoroWidget.tsx         # Circular ring + aesthetic potted plant
│   │   │   ├── FlashcardWidget.tsx        # Q&A flip card + note generator
│   │   │   ├── ExamPrepWidget.tsx         # Preparedness gauge + priority topic bars
│   │   │   ├── StudyChecklistWidget.tsx   # Study checklist + AI question generator
│   │   │   ├── BunnyMotivationCard.tsx
│   │   │   ├── ProductivityChart.tsx
│   │   │   ├── RecentActivityWidget.tsx
│   │   │   ├── TodoWidget.tsx
│   │   │   └── WidgetCustomizeModal.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   └── theme/
│   │       ├── ContrastWarning.tsx    # Live WCAG AA contrast ratio tester
│   │       └── LiveThemePreview.tsx   # Interactive miniature mockup
│   ├── context/
│   │   ├── AuthContext.tsx            # Session, student & admin roles
│   │   └── ThemeContext.tsx           # Dynamic CSS token injector & dark mode
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts              # Fully-typed persistent mock API
│   │   ├── mockData.ts                # Rich seed dataset
│   │   └── utils.ts                   # Helpers & audio chime synthesis
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── AchievementsPage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── AIAssistantPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   ├── BrainDumpPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── FocusPage.tsx
│   │   ├── HabitsPage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── StudyPlannerPage.tsx
│   │   ├── StudyRoomsPage.tsx
│   │   ├── ThemeStudioPage.tsx
│   │   └── WorkspacePage.tsx
│   ├── styles/
│   │   ├── index.css
│   │   └── tokens.css                 # Central Lavender Dream CSS tokens
│   ├── types/
│   │   └── index.ts                   # Complete TypeScript schema
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 💻 Local Setup & Development

### 1. Prerequisites
- **Node.js** v18+ or v20+
- **npm** v9+

### 2. Installation
```bash
cd taskora
npm install
```

### 3. Launch Development Server
```bash
npm run dev
```
The application will start at `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
```
Generates production-optimized assets in `taskora/dist`.

---

## 🧪 Acceptance Test Verification (TC01–TC14)

All scenarios from Section 11 of the SRS have been implemented and verified:

- **TC01 (Registration & Login):** Register with valid credentials, password strength meter evaluates criteria, session persists.
- **TC02 (Task CRUD):** Tasks can be created, marked complete (triggering celebratory confetti), edited, filtered, and deleted.
- **TC03 (AI Task Request):** AI Assistant parses natural prompts and returns structured `AIProposal` objects.
- **TC04 (Approve AI Proposal):** Actions are only committed to the database after explicit "Approve & Save" click.
- **TC05 (Focus Mode):** Configurable circular timer runs, records session history, and awards XP.
- **TC06 (Habit Check-in):** Daily check-in updates streak counter and preserves historical 28-day log without overwriting.
- **TC07 (Study Plan):** AI schedule generator distributes weekly study hours across subjects into a timetable.
- **TC08 (Brain Dump):** Unstructured text captures instantly and can be converted into structured proposals.
- **TC09 (Gamification):** XP is awarded with source attribution and duplicate prevention in an audited ledger.
- **TC10 (Study Rooms):** Private study rooms require passcode validation (`1234`) before granting access.
- **TC11 (Analytics):** Metric cards and area/pie charts calculate accurate focus hours and completion rates.
- **TC12 (Authorization):** Role-based access protects `/admin` routes.
- **TC13 (Theme Preferences):** Custom colors, card borders, and dark mode persist across browser reloads.
- **TC14 (Dashboard Customization):** Widgets can be hidden or reordered via the layout modal and persist automatically.
