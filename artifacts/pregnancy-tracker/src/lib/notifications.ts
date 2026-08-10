/**
 * Core notification scheduler — singleton, framework-agnostic.
 *
 * Scheduling logic per meal (when reminderEnabled = true, TODAY's weekday only):
 *   • T-15 min  → "Breakfast in 15 minutes"
 *   • T+0       → "Time to eat!"
 *   • T+30 min  → follow-up if meal not yet completed (checked via localStorage)
 *
 * Meals are weekday-based (DayOfWeek). Timers only fire when the selected
 * day matches today's weekday.
 */

import {
  DayOfWeek,
  Meal,
  NotificationStore,
  ScheduledEntry,
  NotificationDebugInfo,
} from '../types';
import { getFromStorage, setToStorage, COMPLETIONS_KEY, NOTIFICATIONS_KEY } from './storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_ICONS: Record<string, string> = {
  breakfast:       '🍳',
  morning_snack:   '🍎',
  lunch:           '🍗',
  afternoon_snack: '🥑',
  dinner:          '🍽️',
  night_snack:     '🌙',
  custom:          '🥘',
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

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayDayOfWeek(): DayOfWeek {
  const days: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday',
  ];
  return days[new Date().getDay()];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Scheduler class ──────────────────────────────────────────────────────────

class NotificationScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private swReg: ServiceWorkerRegistration | null = null;
  private _swStatus: 'checking' | 'registered' | 'unavailable' = 'checking';

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

  /**
   * (Re-)schedule all reminder-enabled meals for a given weekday.
   * Only fires timers when `day` equals today's actual weekday.
   */
  scheduleAll(meals: Meal[], day: DayOfWeek): void {
    this.cancelAll();
    if (day !== todayDayOfWeek()) return;
    for (const meal of meals) {
      if (meal.reminderEnabled) this.scheduleMeal(meal, day);
    }
  }

  /** Schedule the three triggers for a single meal. No-ops if not today's weekday. */
  scheduleMeal(meal: Meal, day: DayOfWeek): void {
    if (!meal.reminderEnabled) return;
    if (day !== todayDayOfWeek()) return;

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

    // T+30 — only if meal still incomplete today
    this.scheduleTimer(meal, 'after', mealTs + 30 * 60_000, now, () => {
      const completions = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});
      const isCompleted = (completions[todayDateStr()] ?? []).includes(meal.id);
      if (!isCompleted) {
        void this.fire(
          `${icon} Don't forget ${meal.name}`,
          `You haven't logged your ${meal.name.toLowerCase()} yet.\n${randomItem(MOTIVATIONAL)}`,
          meal.id,
        );
      }
    });
  }

  cancelMeal(mealId: string): void {
    for (const type of ['before', 'exact', 'after'] as const) {
      this.clearTimer(this.key(mealId, type));
    }
  }

  cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.mutateStore((s) => ({ ...s, scheduled: {} }));
  }

  async sendTestNotification(): Promise<void> {
    await this.fire(
      '🔔 Test Notification',
      "Your pregnancy tracker notifications are working! 💚\nYou're doing amazing, mama!",
      'test',
    );
  }

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
    this.addEntry(k, { mealId: meal.id, mealName: meal.name, timestamp: targetTs, type });
  }

  private clearTimer(k: string): void {
    const t = this.timers.get(k);
    if (t !== undefined) { clearTimeout(t); this.timers.delete(k); }
    this.removeEntry(k);
  }

  private async fire(title: string, body: string, mealId: string): Promise<void> {
    if (Notification.permission !== 'granted') return;
    if (!this.swReg) await this.init();
    if (!this.swReg) {
      this.logError(new Error('Service Worker not available'));
      return;
    }
    try {
      await this.swReg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
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

export const notificationScheduler = new NotificationScheduler();
