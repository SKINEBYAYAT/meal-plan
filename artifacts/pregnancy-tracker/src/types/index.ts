export interface Meal {
  id: string;
  type: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'night_snack';
  name: string;
  time: string; // "07:30"
  foods: string[];
  notes: string;
  reminderEnabled: boolean;
  reminderTime: string; // "07:15"
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
