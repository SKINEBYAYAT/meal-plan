# Pregnancy Nutrition & Daily Routine Tracker PWA

A premium-quality Progressive Web App for tracking pregnancy nutrition and daily routines. It feels like an App Store health app — polished, fast, offline-first, and deeply personal.

## Features

- **Dashboard**: Overview of today's progress, next meal with countdown, and quick habit check-offs.
- **Meal Planner**: Weekly view of 6 daily meals. Check off meals, view nutrition info, and manage your diet.
- **Habit Tracker**: Track daily habits like water intake, prenatal vitamins, walking, and sleep.
- **Progress & Statistics**: View daily/weekly/monthly progress bars, a 90-day contribution calendar, and streak tracking.
- **Settings**: Customize your profile, manage notifications, and backup/restore data locally.
- **Offline-First (PWA)**: Works completely offline. Installable on your home screen.

## Tech Stack

- React
- Vite
- Tailwind CSS
- Framer Motion
- Recharts
- Wouter
- Lucide React

## Project Structure

- `/src`
  - `/components`: Reusable UI components
  - `/hooks`: Custom hooks for state management and local storage
  - `/lib`: Utility functions
  - `/pages`: App pages (Home, Meals, Habits, Progress, Settings)
  - `/types`: TypeScript type definitions
- `/public`: Static assets, icons, and PWA manifest

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Build

```bash
# Build for production
npm run build
```

## Deployment

### Deploy to GitHub

1. `git init`
2. `git add .`
3. `git commit -m "Initial commit"`
4. `git remote add origin <your-repo-url>`
5. `git push -u origin main`

### Deploy to Vercel

1. Log into Vercel and click "Add New Project"
2. Import from your GitHub repository
3. Vercel automatically detects Vite and configures the build settings
4. Click "Deploy"

## Installation on Mobile (iPhone)

1. Open the app URL in Safari
2. Tap the Share icon (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. The app is now installed on your device and works offline!

## Notifications

Enable meal reminders via the Settings tab. Ensure you grant permission when prompted. Notifications will alert you when it's time for a scheduled meal.

## License

MIT
