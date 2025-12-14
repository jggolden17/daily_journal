# Frontend Overview

While the backend was written ~entirely by me with ai sometimes used for code-completion/help with docs, I made heavy use of gen-ai tools when writing the frontend, as I am not a FE dev and the focus of the project is not me learning react.

## Architecture

The frontend is built with **React** and **TypeScript**, using a component-based architecture:

- **Pages** - Top-level route components
- **Components** - Reusable UI components
- **Hooks** - Custom React hooks for data fetching and state management
- **API Client** - TypeScript API client for backend communication
- **Types** - TypeScript type definitions

## Project Structure
(note: may be out of date, re-gen with: ` tree -L 5 -I 'node_modules|__pycache__|.git'`)
```
.
├── containerisation
│   └── Dockerfile
├── dist
│   ├── assets
│   │   ├── index-C9zcfANL.css
│   │   └── index-Dx1gVMDM.js
│   └── index.html
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public
├── src
│   ├── App.tsx
│   ├── api
│   │   ├── auth.ts
│   │   ├── client.ts
│   │   ├── journal.ts
│   │   ├── metrics.ts
│   │   └── threads.ts
│   ├── components
│   │   ├── calendar
│   │   │   └── CalendarPopup.tsx
│   │   ├── editor
│   │   │   ├── EntryBlock.tsx
│   │   │   ├── JournalEntryCard.tsx
│   │   │   ├── MarkdownPreview.tsx
│   │   │   └── TipTapEditor.tsx
│   │   ├── layout
│   │   │   ├── AppLayout.tsx
│   │   │   ├── BurgerMenu.tsx
│   │   │   └── DateHeader.tsx
│   │   ├── metrics
│   │   │   ├── ColoredScaleSelect.tsx
│   │   │   ├── MetricsChart.tsx
│   │   │   ├── MetricsIconButton.tsx
│   │   │   ├── MetricsPopup.tsx
│   │   │   └── MetricsSlider.tsx
│   │   └── ui
│   │       ├── SyncIcon.tsx
│   │       └── Toast.tsx
│   ├── hooks
│   │   ├── useAuth.ts
│   │   ├── useMetrics.ts
│   │   └── useTodayEntry.ts
│   ├── index.css
│   ├── main.tsx
│   ├── pages
│   │   ├── DayPage.tsx
│   │   ├── JournalDayView.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MetricsPage.tsx
│   │   └── TodayPage.tsx
│   ├── types
│   │   ├── journal.ts
│   │   └── metrics.ts
│   ├── utils
│   │   ├── dateFormatting.ts
│   │   └── entryMarkers.ts
│   └── vite-env.d.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Key Components

### Pages

- **TodayPage** - Main page for creating and viewing today's entries (wraps JournalDayView)
- **DayPage** - Page for viewing and editing entries for a specific date (wraps JournalDayView)
- **JournalDayView** - Core component for displaying and managing journal entries for a given date. Handles entry creation, editing, deletion, and metrics integration
- **MetricsPage** - View and analyze daily metrics over time with charts and date range selection
- **LoginPage** - Google Sign-In authentication page

### Components

#### Layout
- **AppLayout** - Main application layout with navigation and conditional styling based on route
- **BurgerMenu** - Slide-out navigation menu that appears on mouse proximity to left edge, includes navigation links and logout
- **DateHeader** - Date display with previous/next navigation arrows, calendar popup trigger, and sync status indicator

#### Editor
- **EntryBlock** - Individual journal entry block component that wraps TipTapEditor, handles timestamps, separators, and auto-save
- **TipTapEditor** - WYSIWYG markdown editor built on TipTap, converts between markdown and HTML, supports keyboard shortcuts (Cmd/Ctrl+Enter to save)
- **MarkdownPreview** - Rendered markdown preview component

#### Calendar
- **CalendarPopup** - Modal popup calendar showing which days have entries, allows navigation to specific dates

#### Metrics
- **MetricsChart** - Charts for visualizing metrics over time using Recharts
- **MetricsPopup** - Multi-page modal popup for entering daily metrics (sleep, productivity, activity, mood)
- **MetricsSlider** - Color-coded slider component for metric input (1-7 scale)
- **MetricsIconButton** - Floating action button to open metrics popup
- **ColoredScaleSelect** - Color-coded scale selector for metrics

#### UI
- **SyncIcon** - Visual indicator showing sync status (saving, unsaved changes, synced)
- **Toast** - Toast notification component

### Hooks

Custom hooks encapsulate data fetching and state management:

- **useAuth** - Authentication state and Google Sign-In integration
- **useTodayEntry** - Fetch and manage journal entries for a specific date (create, update, delete, refresh)
- **useMetrics** - Fetch and manage daily metrics for a specific date, includes save functionality

### API Client

The API client (`src/api/`) provides typed functions for backend communication:

- **client.ts** - Base HTTP client configuration
- **auth.ts** - Authentication endpoints
- **journal.ts** - Journal entry endpoints
- **metrics.ts** - Metrics endpoints
- **threads.ts** - Thread endpoints

## Routing

Routing is handled by **React Router** with HashRouter:

- `/login` - Login page (public, redirects to home if authenticated)
- `/` - Today page (protected, redirects to login if not authenticated)
- `/day/:date` - Specific day page (protected)
- `/metrics` - Metrics view (protected)

Protected routes require authentication and redirect to `/login` if not authenticated. The calendar is accessed via a popup from the DateHeader component rather than a dedicated route.

## State Management

State management is handled through:
- **React hooks** (useState, useEffect)
- **Custom hooks** for data fetching
- **Context** (if needed for global state)

No external state management library is used - React's built-in state management is sufficient.

## Styling

- **Tailwind CSS** - Utility-first CSS framework
- **Tailwind Typography** - For markdown content styling
- Custom CSS in `index.css` for global styles

## TypeScript

The project uses TypeScript for type safety:
- Type definitions in `src/types/`
- API response types defined in API client files
- Component props are typed

## Development

### Running the Development Server

```bash
cd frontend
npm run dev
```

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Environment Variables

Frontend environment variables (prefixed with `VITE_`):
- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_API_BACKEND_URL` - Internal backend URL for Docker networking

## Dependencies

Key dependencies:
- `react` & `react-dom` - React framework
- `react-router-dom` - Routing
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder` - WYSIWYG editor
- `marked` - Markdown to HTML conversion
- `turndown` - HTML to Markdown conversion
- `react-markdown` - Markdown rendering (for preview)
- `recharts` - Chart library for metrics
- `@react-oauth/google` - Google Sign-In integration
- `vite` - Build tool and dev server
- `tailwindcss` & `@tailwindcss/typography` - CSS framework and typography plugin
- `typescript` - Type safety

See `package.json` for the complete list of dependencies.

## Features

### Authentication

- Google Sign-In integration using @react-oauth/google
- Protected routes with automatic redirects
- User session management via useAuth hook
- Local environment support with mock authentication

### Journal Entries

- WYSIWYG markdown editor (TipTap) with automatic markdown conversion
- Create, edit, and delete entries with auto-save
- Multiple entries per day with timestamps
- View entries by date with date navigation
- Calendar popup for date selection and navigation
- Manual save with Cmd/Ctrl+Enter keyboard shortcut

### Metrics

- Track daily metrics: sleep (quality, duration, times), productivity (paid/personal), physical activity, and overall mood
- Multi-page popup interface for metric entry
- Color-coded sliders (1-7 scale) for metric input
- Historical metrics visualization with date range selection
- Charts and graphs using Recharts
- Average calculations displayed for selected date ranges

### Calendar

- Popup calendar accessible from DateHeader
- Visual calendar showing days with entries (green indicator)
- Click to navigate to specific dates
- Month navigation with previous/next controls
- Highlights current date and selected date
