import { DayPlan, HabitDefinition, HabitLog, AppSettings, StreakData } from '../types';

export const MEALS_KEY = 'pregnancy_tracker_meals';
export const HABITS_KEY = 'pregnancy_tracker_habits';
export const HABIT_LOGS_KEY = 'pregnancy_tracker_habit_logs';
export const SETTINGS_KEY = 'pregnancy_tracker_settings';
export const STREAKS_KEY = 'pregnancy_tracker_streaks';
export const NOTIFICATIONS_KEY = 'pregnancy_tracker_notifications';

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item) as T;
    }
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
  }
  return defaultValue;
}

export function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

// Re-export types to satisfy import consumers
export type { DayPlan, HabitDefinition, HabitLog, AppSettings, StreakData };
