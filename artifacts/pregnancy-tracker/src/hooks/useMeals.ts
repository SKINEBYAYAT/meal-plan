import { useState, useEffect, useCallback } from 'react';
import { Meal, DayOfWeek, DayPlan } from '../types';
import { getFromStorage, setToStorage, MEAL_PLAN_KEY, COMPLETIONS_KEY } from '../lib/storage';
import { DEFAULT_WEEKLY_MEALS } from '../data/defaultMeals';

// ─── In-memory store + cross-component reactivity ─────────────────────────────
// Single source of truth: Record<mealId, Meal> in localStorage key `pregnancy-meal-plan`.
// All useMeals() instances listen for MEALS_CHANGED and re-read synchronously.

const MEALS_CHANGED = 'meals-store-changed';

function loadAllMeals(): Record<string, Meal> {
  return getFromStorage<Record<string, Meal>>(MEAL_PLAN_KEY, {});
}

function saveAllMeals(meals: Record<string, Meal>): void {
  setToStorage(MEAL_PLAN_KEY, meals);
  window.dispatchEvent(new Event(MEALS_CHANGED));
}

// ─── Seed (idempotent — only writes entries that are missing) ─────────────────
// Runs synchronously at module load. Skips any meal that is already present so
// user edits are never overwritten.
function seedIfNeeded(): void {
  const existing = loadAllMeals();
  const updated = { ...existing };
  let added = 0;

  for (const [id, meal] of Object.entries(DEFAULT_WEEKLY_MEALS)) {
    if (updated[id]) continue; // already present — preserve user's version
    updated[id] = meal as Meal;
    added++;
  }

  if (added > 0) {
    saveAllMeals(updated);
    console.log(`[useMeals] Seeded ${added} default meals into localStorage (pregnancy-meal-plan).`);
  }
}

// ─── One-time migration from previous storage keys ────────────────────────────
// If an earlier session stored meals under the old key, carry those over so
// custom edits are not lost on upgrade. Runs only when the new key is empty.
function migrateFromLegacyKey(): void {
  const LEGACY_KEYS = [
    'pregnancy_tracker_meals_v2', // key used before Task #7
    'pregnancy_tracker_meals',    // even older key
  ];
  // Only migrate if the new key has no data yet
  if (localStorage.getItem(MEAL_PLAN_KEY)) return;
  for (const legacyKey of LEGACY_KEYS) {
    const raw = localStorage.getItem(legacyKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        localStorage.setItem(MEAL_PLAN_KEY, raw);
        localStorage.removeItem(legacyKey);
        console.log(`[useMeals] Migrated meal data from '${legacyKey}' → '${MEAL_PLAN_KEY}'.`);
      }
    } catch {
      // corrupt data — skip, let the seed run
    }
    break; // only migrate from the first non-empty legacy key found
  }
}

// Runs once when the module is first imported — migrate first, then seed
migrateFromLegacyKey();
seedIfNeeded();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCompletedIds(date: string): Set<string> {
  const completions = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});
  return new Set(completions[date] ?? []);
}

function setCompletedIds(date: string, ids: Set<string>): void {
  const completions = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});
  completions[date] = Array.from(ids);
  setToStorage(COMPLETIONS_KEY, completions);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeals(day: DayOfWeek | string) {
  // Read synchronously from localStorage on first render — meals appear immediately
  const [allMeals, setAllMeals] = useState<Record<string, Meal>>(loadAllMeals);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  // Keep in sync when another component writes (add / edit / delete)
  useEffect(() => {
    const handler = () => setAllMeals(loadAllMeals());
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
    const all = loadAllMeals();
    all[meal.id] = data as Meal;
    saveAllMeals(all);
  }, []);

  /** Remove a meal permanently from the weekly template. */
  const deleteMeal = useCallback((id: string) => {
    const all = loadAllMeals();
    delete all[id];
    saveAllMeals(all);
  }, []);

  /**
   * Toggle today's completion for a meal.
   * Writes to the completions store only — the recurring template is never modified.
   * Next week the meal starts fresh (unchecked).
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

/** Returns all meals grouped by day-of-week. */
export function getAllMealsByDay(): Record<DayOfWeek, Meal[]> {
  const all = loadAllMeals();
  const result: Record<DayOfWeek, Meal[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  };
  for (const meal of Object.values(all)) {
    if (meal.day in result) result[meal.day].push(meal);
  }
  return result;
}

/** Returns a count of meals per day-of-week (used by useProgress for heatmap). */
export function getMealCountByDay(): Partial<Record<DayOfWeek, number>> {
  const byDay = getAllMealsByDay();
  const counts: Partial<Record<DayOfWeek, number>> = {};
  for (const [day, meals] of Object.entries(byDay)) {
    if (meals.length > 0) counts[day as DayOfWeek] = meals.length;
  }
  return counts;
}
