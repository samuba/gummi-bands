# Gummi Bands - Product Requirements Document

## Executive Summary

### Product Overview

**Gummi Bands** is a local-first PWA for tracking resistance band workouts. Built specifically with X3 Bar in mind, it works with any rubber band-based resistance training system.

**Tagline:** "Stretchin here and there and everywhere 🎶"

**One-liner:** A privacy-focused, offline-first workout tracker that makes logging resistance band exercises simple and fast.

### Problem Statement

Resistance band training (particularly with systems like X3 Bar) requires tracking multiple variables:
- Which bands were used (resistance levels)
- Full and partial rep counts
- Exercise progression over time
- Multiple exercises per session

Existing fitness apps are often:
- Over-featured with complex UIs
- Not optimized for resistance band-specific tracking
- Slow to log quick workout data

### Solution

Gummi Bands provides a streamlined, mobile-first interface for:
- Quick workout logging (exercises, bands, reps)
- Template-based workout sessions
- Historical tracking and progression
- Complete offline functionality with local data storage

### Key Differentiators

- **Local-First:** All data stored in browser (PGLite)
- **Privacy-Focused:** No accounts, no tracking, no data collection
- **Optimized for Resistance Bands:** Track multiple bands per exercise
- **Progressive Web App:** Works online/offline, installable like a native app
- **Fast & Simple:** Minimal friction from start workout to logging exercises

---

## Product Vision & Goals

### Vision Statement

Empower resistance band users to focus on their workout, not their tracking app. Gummi Bands should feel invisible—fast to open, quick to log, and always available when you need it.

### Primary Objectives

1. **Simplicity:** Reduce workout logging to essential inputs only
2. **Reliability:** Function perfectly offline with local data persistence
3. **Speed:** Load instantly, log exercises in seconds
4. **Progressive Overload:** Make it easy to see previous performance and beat it

### Target Users

**Primary Audience:**
- X3 Bar users looking for dedicated tracking
- Resistance band fitness enthusiasts
- Home workout practitioners

**User Characteristics:**
- Mobile-first users (workout tracking on phone)
- Value simplicity over complex analytics
- Prefer offline-capable tools
- Want to track progressive overload

### Success Metrics

**Engagement:**
- Daily active users (DAU)
- Workouts logged per week
- Session completion rate

**Technical:**
- App load time < 2 seconds
- Offline functionality reliability
- Data persistence (zero data loss)

**User Satisfaction:**
- Time to log exercise < 30 seconds
- Template reuse rate
- App retention after 30 days

---

## Current Features (v0.0.1 - MVP)

### Core Workout Features

#### Session Management
- **Start Workout:** Quick start or select from templates
- **Workout Timer:** Live timer showing session duration
- **End Session:** Save workout with optional notes
- **Resume/Edit:** Re-open past sessions to add or modify exercises

#### Exercise Logging
- **Quick Log:** Select exercise, choose bands, count reps
- **Full & Partial Reps:** Track both complete and partial repetitions
- **Band Selection:** Multi-select bands used in each exercise
- **Previous Data:** Display last performance for progressive overload
- **Exercise Notes:** Optional notes per logged exercise

#### Templates
- **Create Templates:** Pre-define workout routines with exercise lists
- **Template Ordering:** Sort order for template display
- **Quick Start:** Launch workout session from template with pre-populated exercises
- **Suggested Exercises:** Template exercises appear as suggestions during workout

#### History & Stats
- **Recent Sessions:** View last 2 workouts on home screen
- **Full History:** Complete workout log with dates and details
- **Session Cards:** Expandable cards showing exercises, reps, bands
- **Statistics Dashboard:**
  - Total sessions completed
  - This week's sessions
  - Total reps performed
  - Total volume (resistance × reps)
  - Most frequent exercise

### Management Features

#### Band Library
- **Add Bands:** Name, resistance (lbs), and color
- **Doubled Bands:** Automatically create "doubled" version at 2× resistance
- **Edit Bands:** Update name, resistance, or color
- **Delete Bands:** Soft delete if used in historical data, hard delete otherwise
- **Color Coding:** Visual identification of bands

#### Exercise Library
- **Add Exercises:** Simple name-based exercise creation
- **Delete Exercises:** Soft delete if used in history, hard delete otherwise
- **Custom Exercises:** No predefined list—create what you need

#### Settings
- **Weight Units:** Toggle between lbs/kg (default: lbs)
- **Screen Wake Lock:** Keep screen awake during workouts (default: on)

### Technical Features

- **Offline-First:** Full app functionality without internet
- **Local Database:** PGLite (Postgres in-browser) with Drizzle ORM
- **Live Queries:** Real-time UI updates on data changes
- **PWA Support:** Installable, app-like experience
- **Mobile Responsive:** Touch-optimized, mobile-first design
- **Fast Navigation:** Client-side routing with SvelteKit

---

## Technical Architecture

### Technology Stack

**Frontend Framework:**
- **Svelte 5:** Latest version with runes
- **SvelteKit:** Full-stack framework with file-based routing
- **TypeScript:** Type-safe development

**Database & ORM:**
- **PGLite:** PostgreSQL running in WebAssembly (client-side)
- **Drizzle ORM:** Type-safe SQL query builder with relational queries
- **Live Queries:** Custom implementation for reactive data

**Styling & UI:**
- **Tailwind CSS 4:** Utility-first styling
- **Phosphor Icons:** Via unplugin-icons and iconify-tailwind4
- **bits-ui:** Headless component primitives
- **tw-animate-css:** Animation utilities

**Build & Deploy:**
- **Vite:** Fast dev server and bundler
- **Vercel Adapter:** Deployment target (though mostly client-side)

---

## User Flows

### 1. Start New Workout (with Template)

```
Home Screen
  └─> Click "Start Workout" button
      └─> StartWorkoutDialog opens
          ├─> Select template from list
          │   └─> Shows last used date
          └─> Click "Start"
              └─> Navigate to /workout
                  └─> Timer starts
                  └─> Suggested exercises populated
```

### 2. Log Exercise During Workout

```
Workout Screen
  └─> Click exercise from suggested list
      └─> LogExerciseDialog opens
          ├─> Shows previous performance (bands + reps)
          ├─> Select bands (multi-select)
          ├─> Enter full reps (counter UI)
          ├─> Enter partial reps (counter UI)
          ├─> Add notes (optional)
          └─> Click "Log Exercise"
              └─> Exercise appears in session log
              └─> Badge shows completion on suggested list
```

### 3. Create Workout Template

```
Home Screen
  └─> Click "Templates" card
      └─> Templates Page
          └─> Click "Add Template"
              └─> EditTemplateDialog opens
                  ├─> Enter template name
                  ├─> Select exercises (multi-select)
                  ├─> Reorder exercises (drag/drop)
                  └─> Click "Save"
                      └─> Template appears in list
```

### 4. View History & Edit Past Workout

```
Home Screen
  └─> Click "Show All History"
      └─> History Page
          └─> Click session card to expand
              ├─> View exercises, reps, bands
              └─> Click "Edit" button
                  └─> Navigate to /workout?edit={id}
                      ├─> Modify logs
                      ├─> Update notes
                      └─> Click "Save Changes"
```

---

## Future Roadmap

### High Priority (Next Sprint)

**Performance & Reliability:**
- [ ] Fix offline/PWA functionality (service worker issues)
- [ ] Improve app startup time (optimize PGLite initialization)
- [ ] Optimize home page data fetching (reduce queries)

## Design Principles

### Core Principles

**1. Simplicity First**
- Minimal cognitive load—only show what's needed
- One primary action per screen
- Progressive disclosure of advanced features
- No configuration required to get started

**2. Offline First**
- Never depend on network connectivity
- All features work without internet
- Sync is optional, not required
- Local data is source of truth

**3. Performance**
- Target: < 2s first load, < 500ms navigation
- Optimize for mobile devices
- Lazy load non-critical features
- Prioritize perceived performance

**4. Progressive**
- Works as website, enhances as PWA
- Graceful degradation for older browsers
- Mobile-first, desktop-enhanced
- Touch-optimized with keyboard support

### UI/UX Guidelines

**Visual Design:**
- Dark mode optimized (default)
- High contrast for outdoor visibility
- Large touch targets (min 44×44px)
- Clear visual hierarchy

**Interaction:**
- Immediate feedback on all actions
- Undo/redo where destructive
- Confirm destructive actions
- Preserve work in progress

**Content:**
- Concise copy, action-oriented
- Show data, not empty states when possible
- Celebrate progress (completed workouts)
- Use relative dates ("2 days ago")
