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

// ─── In-memory store + cross-component reactivity ─────────────────────────────

const MEALS_CHANGED = 'meals-store-changed';

function loadAllMeals(): Record<string, Meal> {
  return getFromStorage<Record<string, Meal>>(MEAL_PLAN_KEY, {});
}

function saveAllMeals(meals: Record<string, Meal>): void {
  setToStorage(MEAL_PLAN_KEY, meals);
  window.dispatchEvent(new Event(MEALS_CHANGED));
}

// ─── Tombstone helpers ────────────────────────────────────────────────────────
// Tombstones track which default meal IDs the user has permanently deleted.
// The seed skips tombstoned IDs so deletions survive page reload.

function loadTombstones(): Set<string> {
  return new Set(getFromStorage<string[]>(MEAL_DELETIONS_KEY, []));
}

function saveTombstones(set: Set<string>): void {
  setToStorage(MEAL_DELETIONS_KEY, Array.from(set));
}

// ─── One-time migrations ──────────────────────────────────────────────────────

/** Migrate meal template data from old keys → MEAL_PLAN_KEY. */
function migrateMealPlan(): void {
  if (localStorage.getItem(MEAL_PLAN_KEY)) return; // already on new key
  const legacyKeys = ['pregnancy_tracker_meals_v2', 'pregnancy_tracker_meals'];
  for (const key of legacyKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        localStorage.setItem(MEAL_PLAN_KEY, raw);
        localStorage.removeItem(key);
        console.log(`[useMeals] Migrated meals '${key}' → '${MEAL_PLAN_KEY}'`);
      }
    } catch { /* corrupt — let seed run */ }
    break;
  }
}

/** Migrate completion history from old key → COMPLETIONS_KEY. */
function migrateCompletions(): void {
  if (localStorage.getItem(COMPLETIONS_KEY)) return; // already on new key
  const raw = localStorage.getItem('pregnancy_tracker_completions');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      localStorage.setItem(COMPLETIONS_KEY, raw);
      localStorage.removeItem('pregnancy_tracker_completions');
      console.log(`[useMeals] Migrated completions → '${COMPLETIONS_KEY}'`);
    }
  } catch { /* corrupt — discard */ }
}

// ─── Seed (idempotent) ────────────────────────────────────────────────────────
// Only writes default meals that are absent AND not tombstoned (i.e. not deleted
// by the user). This makes deletions of built-in meals durable across reloads.

function seedIfNeeded(): void {
  const existing = loadAllMeals();
  const tombstones = loadTombstones();
  const updated = { ...existing };
  let added = 0;

  for (const [id, meal] of Object.entries(DEFAULT_WEEKLY_MEALS)) {
    if (updated[id]) continue;       // already present — keep user's version
    if (tombstones.has(id)) continue; // user deleted this default meal — respect it
    updated[id] = meal as Meal;
    added++;
  }

  if (added > 0) {
    saveAllMeals(updated);
    console.log(`[useMeals] Seeded ${added} default meals into localStorage.`);
  }
}

// Module init: migrate then seed
migrateMealPlan();
migrateCompletions();
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
  const [allMeals, setAllMeals] = useState<Record<string, Meal>>(loadAllMeals);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  useEffect(() => {
    const handler = () => setAllMeals(loadAllMeals());
    window.addEventListener(MEALS_CHANGED, handler);
    return () => window.removeEventListener(MEALS_CHANGED, handler);
  }, []);

  useEffect(() => {
    setCompletedIdsState(getCompletedIds(todayDateStr()));
  }, [day]);

  const templateMeals: Meal[] = Object.values(allMeals)
    .filter((m) => m.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));

  const dayPlan: DayPlan = {
    date: String(day),
    meals: templateMeals.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
  };

  /** Upsert a meal (add or edit). Completion state is never stored on the template. */
  const updateMeal = useCallback((meal: Meal) => {
    const { completed: _completed, ...data } = meal;
    const all = loadAllMeals();
    all[meal.id] = data as Meal;
    // If a tombstoned default meal is being re-added (e.g. via duplicate), un-tombstone it.
    if (meal.id in DEFAULT_WEEKLY_MEALS) {
      const ts = loadTombstones();
      ts.delete(meal.id);
      saveTombstones(ts);
    }
    saveAllMeals(all);
  }, []);

  /**
   * Remove a meal permanently from the weekly template.
   * For built-in default meals, also records a tombstone so the meal is not
   * re-seeded on the next page load.
   */
  const deleteMeal = useCallback((id: string) => {
    const all = loadAllMeals();
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

export function getMealCountByDay(): Partial<Record<DayOfWeek, number>> {
  const byDay = getAllMealsByDay();
  const counts: Partial<Record<DayOfWeek, number>> = {};
  for (const [day, meals] of Object.entries(byDay)) {
    if (meals.length > 0) counts[day as DayOfWeek] = meals.length;
  }
  return counts;
}
