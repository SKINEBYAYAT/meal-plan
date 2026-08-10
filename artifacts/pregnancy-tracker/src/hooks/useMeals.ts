import { useState, useEffect, useCallback } from 'react';
import { Meal, DayOfWeek, DayPlan } from '../types';
import {
  getFromStorage,
  setToStorage,
  MEAL_PLAN_KEY,
  COMPLETIONS_KEY,
  MEAL_DELETIONS_KEY,
} from '../lib/storage';
import { DEFAULT_WEEKLY_MEALS } from '../data/defaultMeals';

// ─── Cross-component reactivity ───────────────────────────────────────────────

const MEALS_CHANGED = 'meals-store-changed';

function saveAllMeals(meals: Record<string, Meal>): void {
  setToStorage(MEAL_PLAN_KEY, meals);
  window.dispatchEvent(new Event(MEALS_CHANGED));
}

// ─── Tombstone helpers ────────────────────────────────────────────────────────
// Tombstones track default meal IDs the user has permanently deleted.
// The seed skips tombstoned IDs so deletions survive page reload.

function loadTombstones(): Set<string> {
  return new Set(getFromStorage<string[]>(MEAL_DELETIONS_KEY, []));
}

function saveTombstones(set: Set<string>): void {
  setToStorage(MEAL_DELETIONS_KEY, Array.from(set));
}

// ─── One-time completions migration ──────────────────────────────────────────

function migrateCompletions(): void {
  if (localStorage.getItem(COMPLETIONS_KEY)) return;
  const raw = localStorage.getItem('pregnancy_tracker_completions');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      localStorage.setItem(COMPLETIONS_KEY, raw);
      localStorage.removeItem('pregnancy_tracker_completions');
      console.log(`[useMeals] Migrated completions → '${COMPLETIONS_KEY}'`);
    }
  } catch { /* corrupt — discard */ }
}

// ─── Canonical initial meals — ALWAYS starts from bundled defaults ────────────
//
// This is used as the React useState lazy initializer, so the UI ALWAYS has
// the 42 default meals available on first render — no localStorage dependency.
//
// Strategy:
//  1. Start from DEFAULT_WEEKLY_MEALS (guaranteed non-empty, bundled in the app)
//  2. Merge any valid stored data on top (user edits / custom meals)
//  3. Skip tombstoned IDs (meals the user explicitly deleted)
//  4. Write the merged result back to localStorage so future reads are clean
//
// Handles gracefully: missing key, empty `{}`, old `[]` array format, corrupt JSON.

function getInitialMeals(): Record<string, Meal> {
  const tombstones = loadTombstones();

  // Also migrate from old legacy keys before building initial state
  const LEGACY_KEYS = ['pregnancy_tracker_meals_v2', 'pregnancy_tracker_meals'];
  let legacyRaw: string | null = null;
  if (!localStorage.getItem(MEAL_PLAN_KEY)) {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        legacyRaw = raw;
        localStorage.removeItem(key);
        console.log(`[useMeals] Found legacy data under '${key}', merging.`);
        break;
      }
    }
  }

  // 1. Start with all bundled defaults (guaranteed 42 meals)
  const result: Record<string, Meal> = {};
  for (const [id, meal] of Object.entries(DEFAULT_WEEKLY_MEALS)) {
    if (!tombstones.has(id)) result[id] = meal as Meal;
  }

  // 2. Helper to merge a raw JSON string on top of defaults
  const mergeRaw = (raw: string) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      // Accept objects only — reject arrays (old format), null, primitives
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return;
      for (const [id, meal] of Object.entries(parsed as Record<string, unknown>)) {
        if (
          meal &&
          typeof meal === 'object' &&
          !Array.isArray(meal) &&
          'day' in meal &&
          'name' in meal &&
          !tombstones.has(id)
        ) {
          result[id] = meal as Meal;
        }
      }
    } catch { /* corrupt JSON — ignore */ }
  };

  // 3. Merge legacy data first, then current stored data (current wins if both exist)
  if (legacyRaw) mergeRaw(legacyRaw);
  const storedRaw = localStorage.getItem(MEAL_PLAN_KEY);
  if (storedRaw) mergeRaw(storedRaw);

  // 4. Persist the clean merged result (fixes corrupt/empty/old-format storage)
  setToStorage(MEAL_PLAN_KEY, result);

  console.log(`[useMeals] Initial meals: ${Object.keys(result).length} total`);
  return result;
}

// Run completions migration at module load (meal data handled inside getInitialMeals)
migrateCompletions();

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
  // Lazy initializer: always starts with defaults + user data merged.
  // The UI will never show "No meals planned" due to an empty/missing localStorage.
  const [allMeals, setAllMeals] = useState<Record<string, Meal>>(getInitialMeals);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  // Keep in sync when another component writes (add / edit / delete)
  useEffect(() => {
    const handler = () => setAllMeals(getInitialMeals());
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

  // DEBUG: verify meal counts (remove once confirmed working)
  console.log('MEAL DEBUG', {
    totalMeals: Object.keys(allMeals).length,
    selectedDay: day,
    matchingMeals: templateMeals.length,
  });

  // Merge today's completion state into each meal
  const dayPlan: DayPlan = {
    date: String(day),
    meals: templateMeals.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
  };

  /** Upsert a meal (add or edit). Completion state is never stored on the template. */
  const updateMeal = useCallback((meal: Meal) => {
    const { completed: _completed, ...data } = meal;
    const all = getInitialMeals();
    all[meal.id] = data as Meal;
    // Un-tombstone if a default meal is being restored/edited
    if (meal.id in DEFAULT_WEEKLY_MEALS) {
      const ts = loadTombstones();
      ts.delete(meal.id);
      saveTombstones(ts);
    }
    saveAllMeals(all);
  }, []);

  /**
   * Remove a meal permanently from the weekly template.
   * For built-in default meals, records a tombstone so the meal is not
   * re-seeded on the next page load.
   */
  const deleteMeal = useCallback((id: string) => {
    const all = getInitialMeals();
    delete all[id];
    saveAllMeals(all);
    // Tombstone default meals so they don't resurface after reload
    if (id in DEFAULT_WEEKLY_MEALS) {
      const ts = loadTombstones();
      ts.add(id);
      saveTombstones(ts);
    }
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
  // Use getInitialMeals to guarantee defaults are always included
  const all = getInitialMeals();
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
