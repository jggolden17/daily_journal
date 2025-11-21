# Frontend Overview

While the backend was written ~entirely by me with ai primarily used for code-completion/help with docs, I made heavy use of gen-ai tools when writing the frontend, as this is not my focus.

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
│   │   │   └── JournalCalendar.tsx
│   │   ├── editor
│   │   │   ├── JournalEntryCard.tsx
│   │   │   ├── MarkdownEditor.tsx
│   │   │   └── MarkdownPreview.tsx
│   │   ├── layout
│   │   │   └── AppLayout.tsx
│   │   └── metrics
│   │       ├── ColoredScaleSelect.tsx
│   │       └── MetricsChart.tsx
│   ├── hooks
│   │   ├── useAuth.ts
│   │   ├── useMetrics.ts
│   │   └── useTodayEntry.ts
│   ├── index.css
│   ├── main.tsx
│   ├── pages
│   │   ├── CalendarPage.tsx
│   │   ├── DayPage.tsx
│   │   ├── MetricsPage.tsx
│   │   └── TodayPage.tsx
│   ├── types
│   │   ├── journal.ts
│   │   └── metrics.ts
│   └── vite-env.d.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Key Components

### Pages

- **TodayPage/DayPage** - Main page for creating and viewing a specfic date's entries (default today)
- **CalendarPage** - Calendar view showing which days have entries
- **MetricsPage** - View and analyze daily metrics over time

### Components

#### Layout
- **AppLayout** - Main application layout with navigation and auth

#### Editor
- **JournalEntryCard** - Display and edit individual journal entries
- **MarkdownEditor** - Markdown text editor
- **MarkdownPreview** - Rendered markdown preview

#### Calendar
- **JournalCalendar** - Interactive calendar showing entry dates

#### Metrics
- **MetricsChart** - Charts for visualizing metrics
- **ColoredScaleSelect** - Color-coded scale selector for metrics

### Hooks

Custom hooks encapsulate data fetching and state management:

- **useAuth** - Authentication state and Google Sign-In
- **useTodayEntry** - Fetch and manage today's journal entries
- **useMetrics** - Fetch and manage daily metrics

### API Client

The API client (`src/api/`) provides typed functions for backend communication:

- **client.ts** - Base HTTP client configuration
- **auth.ts** - Authentication endpoints
- **journal.ts** - Journal entry endpoints
- **metrics.ts** - Metrics endpoints
- **threads.ts** - Thread endpoints

## Routing

Routing is handled by **React Router**:

- `/` - Today page (public)
- `/day/:date` - Specific day page (protected)
- `/calendar` - Calendar view (protected)
- `/metrics` - Metrics view (protected)

Protected routes require authentication and redirect to the home page if not authenticated.

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
- `react-markdown` - Markdown rendering
- `recharts` - Chart library for metrics
- `vite` - Build tool and dev server
- `tailwindcss` - CSS framework
- `typescript` - Type safety

See `package.json` for the complete list of dependencies.

## Features

### Authentication

- Google Sign-In integration (currently to-do, a placeholder)
- Protected routes
- User session management

### Journal Entries

- Markdown editor with live preview
- Create, edit, and delete entries
- View entries by date
- Calendar navigation

### Metrics
(currently quite under-developed, plan to extend)

- Track daily metrics (mood, sleep, etc.)
- Color-coded scale selection
- Historical metrics visualization
- Charts and graphs

### Calendar

- Visual calendar showing days with entries
- Click to navigate to specific dates
- Highlight current date
