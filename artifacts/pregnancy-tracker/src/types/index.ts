export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type MealType =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'night_snack'
  | 'custom';

export interface Meal {
  id: string;              // e.g. "monday-breakfast" or "thursday-1700000000000"
  day: DayOfWeek;
  type: MealType;
  name: string;
  icon?: string;
  time: string;            // "07:30" (24h)
  foods: string[];
  notes: string;
  reminderEnabled: boolean;
  // Computed from localStorage at read time — NOT stored in Firestore
  completed?: boolean;
  // Written by Cloud Function only
  lastNotifiedDate?: string | null;
}

export interface DayPlan {
  date: string;  // holds DayOfWeek string ("monday") for meal plan, or yyyy-MM-dd for compat
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
  timestamp: number;
  type: NotificationTrigger;
}

export interface LastNotification {
  title: string;
  body: string;
  mealId: string;
  firedAt: string;
}

export interface NotificationError {
  message: string;
  at: string;
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
