export type MealType =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'night_snack'
  | 'custom';

export interface Meal {
  id: string;
  type: MealType;
  name: string;
  icon?: string;           // emoji override, e.g. "🍕"
  time: string;            // "07:30"
  foods: string[];
  notes: string;
  reminderEnabled: boolean;
  reminderTime: string;    // "07:15" – kept for backward-compat; scheduling uses meal.time
  completed: boolean;
  calories?: number;
  protein?: number;
  fats?: number;
  carbs?: number;
}

export interface DayPlan {
  date: string;
  meals: Meal[];
}

export interface HabitDefinition {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  order: number;
}

export interface HabitLog {
  habitId: string;
  date: string;
  completed: boolean;
  completedAt?: string;
}

export interface AppSettings {
  userName: string;
  notificationsEnabled: boolean;
  motivationalMessages: boolean;
  accentColor: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
}

// ─── Notification types ───────────────────────────────────────────────────────

export type NotificationTrigger = 'before' | 'exact' | 'after';

export interface ScheduledEntry {
  mealId: string;
  mealName: string;
  timestamp: number;        // Unix ms
  type: NotificationTrigger;
}

export interface LastNotification {
  title: string;
  body: string;
  mealId: string;
  firedAt: string;          // ISO
}

export interface NotificationError {
  message: string;
  at: string;               // ISO
}

export interface NotificationStore {
  scheduled: Record<string, ScheduledEntry>;
  lastNotification: LastNotification | null;
  errors: NotificationError[];
}

export interface NotificationDebugInfo {
  scheduledCount: number;
  upcoming: ScheduledEntry | null;
  lastNotification: LastNotification | null;
  errors: NotificationError[];
}
