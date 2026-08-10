import { useState, useEffect, useCallback } from 'react';
import { Meal, DayOfWeek, DayPlan } from '../types';
import {
  getFromStorage,
  setToStorage,
  MEAL_PLAN_KEY,
  COMPLETIONS_KEY,
} from '../lib/storage';
import { DEFAULT_WEEKLY_MEALS } from '../data/defaultMeals';

// ─── Cross-component reactivity ───────────────────────────────────────────────

const MEALS_CHANGED = 'meals-store-changed';

const VALID_DAYS = new Set<string>([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

function saveAllMeals(meals: Record<string, Meal>): void {
  setToStorage(MEAL_PLAN_KEY, meals);
  window.dispatchEvent(new Event(MEALS_CHANGED));
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** A stored value qualifies as a renderable meal only if all required fields exist. */
function isValidMeal(value: unknown): value is Meal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.day === 'string' && VALID_DAYS.has(m.day) &&
    typeof m.name === 'string' && m.name.length > 0 &&
    typeof m.time === 'string' &&
    Array.isArray(m.foods)
  );
}

// ─── Canonical meals — the bundled 42 defaults are ALWAYS present ─────────────
//
// The 42 default meals are authoritative and always render. Stored data can:
//  • customize a default meal (same ID, must keep the same day)
//  • add custom meals (any valid meal with a non-default ID)
// It can never remove a default meal or move it off its weekday, so every
// default day always shows its 6 meals. No seed system, no migrations needed.

function getCanonicalMeals(): Record<string, Meal> {
  // 1. Start with all bundled defaults — guaranteed 42 meals
  const result: Record<string, Meal> = {};
  for (const [id, meal] of Object.entries(DEFAULT_WEEKLY_MEALS)) {
    result[id] = meal as Meal;
  }

  // 2. Overlay valid stored data (user edits of defaults + custom meals)
  try {
    const raw = localStorage.getItem(MEAL_PLAN_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (!isValidMeal(value)) continue;
          const isDefault = id in DEFAULT_WEEKLY_MEALS;
          if (isDefault) {
            // Default IDs may be customized but must stay on their weekday
            const canonical = DEFAULT_WEEKLY_MEALS[id];
            if (value.day === canonical.day) {
              result[id] = { ...value, id, day: canonical.day };
            }
          } else {
            result[id] = value;
          }
        }
      }
    }
  } catch {
    // corrupt JSON — defaults only
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCompletedIds(date: string): Set<string> {
  const completions = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});
  const list = completions?.[date];
  return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
}

function setCompletedIds(date: string, ids: Set<string>): void {
  const stored = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});
  const completions =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  completions[date] = Array.from(ids);
  setToStorage(COMPLETIONS_KEY, completions);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeals(day: DayOfWeek | string) {
  // Synchronous lazy initializer — defaults are bundled, so the very first
  // render always has all 42 meals. No storage dependency for visibility.
  const [allMeals, setAllMeals] = useState<Record<string, Meal>>(getCanonicalMeals);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  // Keep in sync when another component writes (add / edit / delete)
  useEffect(() => {
    const handler = () => setAllMeals(getCanonicalMeals());
    window.addEventListener(MEALS_CHANGED, handler);
    return () => window.removeEventListener(MEALS_CHANGED, handler);
  }, []);

  // Refresh completion flags when the selected weekday changes
  useEffect(() => {
    setCompletedIdsState(getCompletedIds(todayDateStr()));
  }, [day]);

  // Filter + sort meals for the requested weekday
  const templateMeals: Meal[] = Object.values(allMeals)
    .filter((m) => m.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Merge today's completion state into each meal
  const dayPlan: DayPlan = {
    date: String(day),
    meals: templateMeals.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
  };

  /** Upsert a meal (add or edit). Completion state is never stored on the template. */
  const updateMeal = useCallback((meal: Meal) => {
    const { completed: _completed, ...data } = meal;
    const all = getCanonicalMeals();
    all[meal.id] = data as Meal;
    saveAllMeals(all);
  }, []);

  /**
   * Remove a meal from the weekly plan.
   * Custom meals are removed permanently. Built-in default meals are restored
   * to their original bundled version (they always remain part of the plan).
   */
  const deleteMeal = useCallback((id: string) => {
    const all = getCanonicalMeals();
    if (id in DEFAULT_WEEKLY_MEALS) {
      all[id] = DEFAULT_WEEKLY_MEALS[id] as Meal; // reset to bundled version
    } else {
      delete all[id];
    }
    saveAllMeals(all);
  }, []);

  /**
   * Toggle today's completion for a meal.
   * Writes to the completions store only — the recurring template is unchanged.
   * Next week the same meal starts fresh (unchecked).
   */
  const toggleMealCompleted = useCallback((id: string, completed: boolean) => {
    const today = todayDateStr();
    const ids = getCompletedIds(today);
    if (completed) { ids.add(id); } else { ids.delete(id); }
    setCompletedIds(today, ids);
    setCompletedIdsState(new Set(ids));
  }, []);

  return { dayPlan, updateMeal, deleteMeal, toggleMealCompleted };
}

// ─── Utility exports ──────────────────────────────────────────────────────────

export function getAllMealsByDay(): Record<DayOfWeek, Meal[]> {
  const all = getCanonicalMeals();
  const result: Record<DayOfWeek, Meal[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  };
  for (const meal of Object.values(all)) {
    if (meal.day in result) result[meal.day].push(meal);
  }
  return result;
}

export function getMealCountByDay(): Partial<Record<DayOfWeek, number>> {
  const byDay = getAllMealsByDay();
  const counts: Partial<Record<DayOfWeek, number>> = {};
  for (const [day, meals] of Object.entries(byDay)) {
    if (meals.length > 0) counts[day as DayOfWeek] = meals.length;
  }
  return counts;
}
