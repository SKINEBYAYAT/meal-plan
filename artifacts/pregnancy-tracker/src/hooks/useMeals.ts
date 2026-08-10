import { useState, useEffect, useCallback } from 'react';
import { Meal, DayOfWeek, DayPlan } from '../types';
import { getFromStorage, setToStorage, COMPLETIONS_KEY } from '../lib/storage';

// ─── Storage key ──────────────────────────────────────────────────────────────
export const MEALS_STORE_KEY = 'pregnancy_tracker_meals_v2';

// ─── Weekday seed data ────────────────────────────────────────────────────────

const SEED_DATA: Record<DayOfWeek, Record<string, { time: string; foods: string[] }>> = {
  monday: {
    breakfast:       { time: '07:30', foods: ['2 eggs', 'Oatmeal with milk', 'Banana'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab', 'Handful of walnuts'] },
    lunch:           { time: '13:00', foods: ['Grilled chicken', 'Rice', 'Broccoli'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt'] },
    dinner:          { time: '19:00', foods: ['Salmon', 'Sweet potato', 'Salad'] },
    night_snack:     { time: '21:00', foods: ['Cottage cheese'] },
  },
  tuesday: {
    breakfast:       { time: '07:30', foods: ['Greek yogurt', 'Berries', 'Oats', 'Almonds'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab'] },
    lunch:           { time: '13:00', foods: ['Beef', 'Potatoes', 'Green beans'] },
    afternoon_snack: { time: '16:00', foods: ['Apple with peanut butter'] },
    dinner:          { time: '19:00', foods: ['Lentil soup', 'Whole-grain bread', 'Salad'] },
    night_snack:     { time: '21:00', foods: ['Milk'] },
  },
  wednesday: {
    breakfast:       { time: '07:30', foods: ['Omelet with cheese and spinach'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab', 'Almonds'] },
    lunch:           { time: '13:00', foods: ['Turkey or chicken', 'Rice', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Yogurt'] },
    dinner:          { time: '19:00', foods: ['Baked salmon', 'Potatoes', 'Carrots'] },
    night_snack:     { time: '21:00', foods: ['Banana'] },
  },
  thursday: {
    breakfast:       { time: '07:30', foods: ['Oatmeal with walnuts and fruit'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab'] },
    lunch:           { time: '13:00', foods: ['Beef stew with potatoes'] },
    afternoon_snack: { time: '16:00', foods: ['Cottage cheese'] },
    dinner:          { time: '19:00', foods: ['Chicken with rice and vegetables'] },
    night_snack:     { time: '21:00', foods: ['Kiwi'] },
  },
  friday: {
    breakfast:       { time: '07:30', foods: ['Eggs with avocado and toast'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab', 'Pistachios'] },
    lunch:           { time: '13:00', foods: ['Salmon with quinoa or rice'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt'] },
    dinner:          { time: '19:00', foods: ['Chicken', 'Sweet potato', 'Broccoli'] },
    night_snack:     { time: '21:00', foods: ['Milk'] },
  },
  saturday: {
    breakfast:       { time: '07:30', foods: ['Yogurt', 'Oats', 'Berries'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab'] },
    lunch:           { time: '13:00', foods: ['Beef', 'Rice', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Orange', 'Walnuts'] },
    dinner:          { time: '19:00', foods: ['Lentils', 'Salad'] },
    night_snack:     { time: '21:00', foods: ['Cottage cheese'] },
  },
  sunday: {
    breakfast:       { time: '07:30', foods: ['Eggs', 'Cheese', 'Fruit'] },
    morning_snack:   { time: '10:30', foods: ['3–4 fresh rutab', 'Almonds'] },
    lunch:           { time: '13:00', foods: ['Roast chicken', 'Potatoes', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Yogurt', 'Berries'] },
    dinner:          { time: '19:00', foods: ['Grilled fish', 'Rice', 'Salad'] },
    night_snack:     { time: '21:00', foods: ['Banana'] },
  },
};

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'Breakfast',
  morning_snack: 'Morning Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon Snack',
  dinner: 'Dinner',
  night_snack: 'Evening Snack',
};

const DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];
const MEAL_TYPES = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'night_snack',
] as const;

// ─── In-memory store + cross-component reactivity ─────────────────────────────
// One source of truth: Record<mealId, Meal> kept in localStorage and mirrored here.

const MEALS_CHANGED = 'meals-store-changed';

function loadAllMeals(): Record<string, Meal> {
  return getFromStorage<Record<string, Meal>>(MEALS_STORE_KEY, {});
}

function saveAllMeals(meals: Record<string, Meal>): void {
  setToStorage(MEALS_STORE_KEY, meals);
  // Notify all useMeals() hook instances to re-render
  window.dispatchEvent(new Event(MEALS_CHANGED));
}

// ─── Seed (idempotent — only writes missing docs) ─────────────────────────────
function seedIfNeeded(): void {
  const existing = loadAllMeals();
  const updated = { ...existing };
  let added = 0;

  for (const day of DAYS) {
    for (const type of MEAL_TYPES) {
      const id = `${day}-${type}`;
      if (updated[id]) continue; // already exists — don't overwrite
      const slot = SEED_DATA[day][type];
      updated[id] = {
        id,
        day,
        type,
        name: MEAL_NAMES[type],
        time: slot.time,
        foods: slot.foods,
        notes: '',
        reminderEnabled: false,
      };
      added++;
    }
  }

  if (added > 0) {
    saveAllMeals(updated);
    console.log(`[useMeals] Seeded ${added} missing meals into localStorage.`);
  } else {
    console.log('[useMeals] All 42 seed meals already present.');
  }
}

// Run seed immediately when this module loads (synchronous — no async wait needed)
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
  // All meals for the requested weekday, derived synchronously from localStorage
  const [allMeals, setAllMeals] = useState<Record<string, Meal>>(loadAllMeals);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  // Re-read meals when another component writes (cross-component reactivity)
  useEffect(() => {
    const handler = () => setAllMeals(loadAllMeals());
    window.addEventListener(MEALS_CHANGED, handler);
    return () => window.removeEventListener(MEALS_CHANGED, handler);
  }, []);

  // Refresh completions when the selected day changes
  useEffect(() => {
    setCompletedIdsState(getCompletedIds(todayDateStr()));
  }, [day]);

  // Filter + sort meals for the requested weekday
  const templateMeals: Meal[] = Object.values(allMeals)
    .filter((m) => m.day === day)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Merge completion state
  const dayPlan: DayPlan = {
    date: String(day),
    meals: templateMeals.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
  };

  /** Upsert a meal (add or edit). */
  const updateMeal = useCallback((meal: Meal) => {
    const { completed: _completed, ...data } = meal;
    const all = loadAllMeals();
    all[meal.id] = data as Meal;
    saveAllMeals(all);
  }, []);

  /** Remove a meal. */
  const deleteMeal = useCallback((id: string) => {
    const all = loadAllMeals();
    delete all[id];
    saveAllMeals(all);
  }, []);

  /**
   * Toggle today's completion for a meal.
   * Only touches localStorage completion history — the recurring template is unchanged.
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

// ─── Utility exports (used by useProgress) ────────────────────────────────────

/** Returns all meals grouped by day. */
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

/** Returns a count of meals per day-of-week. */
export function getMealCountByDay(): Partial<Record<DayOfWeek, number>> {
  const byDay = getAllMealsByDay();
  const counts: Partial<Record<DayOfWeek, number>> = {};
  for (const [day, meals] of Object.entries(byDay)) {
    if (meals.length > 0) counts[day as DayOfWeek] = meals.length;
  }
  return counts;
}
