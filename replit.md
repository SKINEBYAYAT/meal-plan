# Pregnancy Nutrition & Daily Routine Tracker

A premium offline-first PWA that helps pregnant women track daily meals, habits, nutrition progress, and streaks — installable from Safari as a home screen app.

## Run & Operate

- `pnpm --filter @workspace/pregnancy-tracker run dev` — run the PWA frontend (the only app)
- `pnpm --filter @workspace/pregnancy-tracker run build` — production build → `artifacts/pregnancy-tracker/dist/public`
- `pnpm --filter @workspace/pregnancy-tracker run typecheck` — TypeScript check (zero errors expected)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark mode only)
- Routing: wouter
- Charts: recharts
- Animations: framer-motion
- PWA: vite-plugin-pwa (manifest, service worker, icons)
- State: localStorage only — no backend, no database

## Where things live

- `artifacts/pregnancy-tracker/src/pages/` — Home, Meals, Habits, Progress, Settings
- `artifacts/pregnancy-tracker/src/hooks/` — useMeals, useHabits, useProgress, useSettings, useNotifications, useCountdown
- `artifacts/pregnancy-tracker/src/types/index.ts` — all TypeScript interfaces
- `artifacts/pregnancy-tracker/public/` — manifest.json, icons, favicon
- `artifacts/pregnancy-tracker/vercel.json` — Vercel deployment config (outputDirectory: dist/public)
- `artifacts/pregnancy-tracker/README.md` — full user-facing docs

## Architecture decisions

- **LocalStorage only**: All data (meals, habits, streaks, settings) lives in the browser — no backend needed, works fully offline after PWA install.
- **Dark mode only**: The `dark` class is applied to `<html>` on mount unconditionally. No light mode toggle.
- **Default seed data**: The current week's meal plan is seeded into localStorage on first launch if no data exists.
- **Notifications via Web Notifications API**: Scheduled with setTimeout/setInterval, not push/service-worker push — works without a server but requires the app to be open/focused.
- **Vercel deployment**: Build output is `dist/public`; SPA routing handled by rewrites in `vercel.json`.

## Product

- **Home**: Greeting, today's date, animated progress circle, next meal countdown, daily habits quick-complete, motivational quote
- **Meals**: 7-day planner with 6 meals/day, full CRUD (add/edit/delete/duplicate), macros, per-meal reminder toggles
- **Habits**: 11 default habits with streaks, add/edit/delete/reorder
- **Progress**: Completion %, 7-day bar chart, 90-day heatmap, streak tracking
- **Settings**: Profile name, notification controls, data export/import/reset, accent color picker

## Gotchas

- PWA icons are currently SVG placeholders — Safari requires PNG for proper Add to Home Screen icons; replace with real PNGs for production.
- `npm run build` must be run from inside `artifacts/pregnancy-tracker/` for standalone builds (Vercel does this automatically).
- The API server artifact exists in the monorepo but is not used by this app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
