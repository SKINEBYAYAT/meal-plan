/**
 * Core notification scheduler — singleton, framework-agnostic.
 *
 * Scheduling logic per meal (when reminderEnabled = true, today only):
 *   • T-15 min  → "Breakfast in 15 minutes"
 *   • T+0       → "Time to eat!"
 *   • T+30 min  → follow-up if meal not yet completed
 *
 * All timers are in-memory (Map). Scheduled metadata is persisted in
 * localStorage so the debug page can show upcoming reminders across sessions.
 */

import {
  Meal,
  DayPlan,
  NotificationStore,
  ScheduledEntry,
  NotificationDebugInfo,
} from '../types';
import { getFromStorage, setToStorage, MEALS_KEY, NOTIFICATIONS_KEY } from './storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🍳',
  morning_snack: '🍎',
  lunch: '🍗',
  afternoon_snack: '🥑',
  dinner: '🍽️',
  night_snack: '🌙',
  custom: '🥘',
};

const MOTIVATIONAL = [
  "You're doing amazing, mama! 💚",
  "Nourishing yourself is nourishing your baby 🌿",
  "Every healthy meal is a gift to your little one 👶",
  "Strong mama, healthy baby! 💪",
  "Your body is doing incredible things — fuel it well 🌟",
  "One meal at a time, one day at a time 🤍",
  "Your baby is grateful for every bite you take 💚",
  "Taking care of yourself is taking care of your baby 🌸",
];

const DEFAULT_STORE: NotificationStore = {
  scheduled: {},
  lastNotification: null,
  errors: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Scheduler class ──────────────────────────────────────────────────────────

class NotificationScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private swReg: ServiceWorkerRegistration | null = null;
  private _swStatus: 'checking' | 'registered' | 'unavailable' = 'checking';

  // ── Initialisation ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this._swStatus = 'unavailable';
      return;
    }
    try {
      this.swReg = await navigator.serviceWorker.ready;
      this._swStatus = 'registered';
    } catch (e) {
      this._swStatus = 'unavailable';
      this.logError(e);
    }
  }

  get swStatus(): string {
    return this._swStatus;
  }

  // ── Public scheduling API ───────────────────────────────────────────────────

  /** Schedule (or re-schedule) all reminder-enabled meals for a given date. */
  scheduleAll(meals: Meal[], date: string): void {
    this.cancelAll();
    if (date !== todayStr()) return; // Only today's meals get timers
    for (const meal of meals) {
      if (meal.reminderEnabled) this.scheduleMeal(meal, date);
    }
  }

  /** Schedule the three triggers for a single meal. No-ops if not today. */
  scheduleMeal(meal: Meal, date: string): void {
    if (!meal.reminderEnabled) return;
    if (date !== todayStr()) return;

    const [h, m] = meal.time.split(':').map(Number);
    const mealTime = new Date();
    mealTime.setHours(h, m, 0, 0);
    const mealTs = mealTime.getTime();
    const now = Date.now();
    const icon = MEAL_ICONS[meal.type] ?? '🥘';

    // T-15
    this.scheduleTimer(meal, 'before', mealTs - 15 * 60_000, now, () => {
      const body = [
        meal.foods.slice(0, 3).join(' • '),
        randomItem(MOTIVATIONAL),
      ].filter(Boolean).join('\n');
      void this.fire(`${icon} ${meal.name} in 15 minutes`, body, meal.id);
    });

    // T+0
    this.scheduleTimer(meal, 'exact', mealTs, now, () => {
      const body = [
        meal.foods.slice(0, 3).join(' • '),
        meal.notes || '',
        randomItem(MOTIVATIONAL),
      ].filter(Boolean).join('\n');
      void this.fire(`${icon} ${meal.name} — Time to eat!`, body, meal.id);
    });

    // T+30 — only if meal still incomplete
    this.scheduleTimer(meal, 'after', mealTs + 30 * 60_000, now, () => {
      const allMeals = getFromStorage<Record<string, DayPlan>>(MEALS_KEY, {});
      const current = allMeals[todayStr()]?.meals.find((mx) => mx.id === meal.id);
      if (!current?.completed) {
        void this.fire(
          `${icon} Don't forget ${meal.name}`,
          `You haven't logged your ${meal.name.toLowerCase()} yet.\n${randomItem(MOTIVATIONAL)}`,
          meal.id,
        );
      }
    });
  }

  /** Cancel all three timers for a meal (call on delete or toggle-off). */
  cancelMeal(mealId: string): void {
    for (const type of ['before', 'exact', 'after'] as const) {
      this.clearTimer(this.key(mealId, type));
    }
  }

  /** Cancel every scheduled timer (e.g. when notifications are disabled). */
  cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.mutateStore((s) => ({ ...s, scheduled: {} }));
  }

  /** Fire a test notification immediately. */
  async sendTestNotification(): Promise<void> {
    await this.fire(
      '🔔 Test Notification',
      "Your pregnancy tracker notifications are working! 💚\nYou're doing amazing, mama!",
      'test',
    );
  }

  // ── Debug info ──────────────────────────────────────────────────────────────

  getDebugInfo(): NotificationDebugInfo {
    const store = this.readStore();
    const entries = Object.values(store.scheduled) as ScheduledEntry[];
    const now = Date.now();
    const upcoming =
      entries
        .filter((e) => e.timestamp > now)
        .sort((a, b) => a.timestamp - b.timestamp)[0] ?? null;
    return {
      scheduledCount: this.timers.size,
      upcoming,
      lastNotification: store.lastNotification,
      errors: store.errors,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private key(mealId: string, type: string): string {
    return `${mealId}__${type}`;
  }

  private scheduleTimer(
    meal: Meal,
    type: 'before' | 'exact' | 'after',
    targetTs: number,
    now: number,
    cb: () => void,
  ): void {
    if (targetTs <= now) return;
    const k = this.key(meal.id, type);
    this.clearTimer(k);
    const delay = targetTs - now;
    const t = setTimeout(() => {
      this.timers.delete(k);
      this.removeEntry(k);
      cb();
    }, delay);
    this.timers.set(k, t);
    this.addEntry(k, {
      mealId: meal.id,
      mealName: meal.name,
      timestamp: targetTs,
      type,
    });
  }

  private clearTimer(k: string): void {
    const t = this.timers.get(k);
    if (t !== undefined) {
      clearTimeout(t);
      this.timers.delete(k);
    }
    this.removeEntry(k);
  }

  private async fire(title: string, body: string, mealId: string): Promise<void> {
    if (Notification.permission !== 'granted') return;
    if (!this.swReg) {
      // Re-try init (e.g. permission was granted after init)
      await this.init();
    }
    if (!this.swReg) {
      this.logError(new Error('Service Worker not available'));
      return;
    }
    try {
      await this.swReg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // Unique tag prevents duplicate banners for the same trigger
        tag: `pnt-${mealId}-${Date.now()}`,
        data: { mealId },
        requireInteraction: false,
      });
      this.mutateStore((s) => ({
        ...s,
        lastNotification: { title, body, mealId, firedAt: new Date().toISOString() },
      }));
    } catch (e) {
      this.logError(e);
    }
  }

  // ── Storage ─────────────────────────────────────────────────────────────────

  private readStore(): NotificationStore {
    return getFromStorage<NotificationStore>(NOTIFICATIONS_KEY, DEFAULT_STORE);
  }

  private mutateStore(fn: (s: NotificationStore) => NotificationStore): void {
    setToStorage(NOTIFICATIONS_KEY, fn(this.readStore()));
  }

  private addEntry(k: string, entry: ScheduledEntry): void {
    this.mutateStore((s) => ({ ...s, scheduled: { ...s.scheduled, [k]: entry } }));
  }

  private removeEntry(k: string): void {
    this.mutateStore((s) => {
      const { [k]: _removed, ...rest } = s.scheduled;
      return { ...s, scheduled: rest };
    });
  }

  private logError(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e);
    this.mutateStore((s) => ({
      ...s,
      errors: [{ message, at: new Date().toISOString() }, ...s.errors].slice(0, 10),
    }));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const notificationScheduler = new NotificationScheduler();
