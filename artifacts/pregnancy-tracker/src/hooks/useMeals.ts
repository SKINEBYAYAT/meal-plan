import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Meal, DayOfWeek, DayPlan } from '../types';
import { getFromStorage, setToStorage, COMPLETIONS_KEY } from '../lib/storage';

// ─── Weekday seed data ────────────────────────────────────────────────────────

const SEED: Record<DayOfWeek, Record<string, { time: string; foods: string[] }>> = {
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

// ── Seed: runs once, checks for monday-breakfast as sentinel ─────────────────

let seedChecked = false;

async function seedMealsIfNeeded(): Promise<void> {
  if (seedChecked) return;
  seedChecked = true;

  // Use monday-breakfast as sentinel — if it exists the DB is seeded
  const sentinel = await getDoc(doc(db, 'meals', 'monday-breakfast'));
  if (sentinel.exists()) return;

  const batch = writeBatch(db);
  for (const day of DAYS) {
    for (const type of MEAL_TYPES) {
      const slot = SEED[day][type];
      const id = `${day}-${type}`;
      const meal: Omit<Meal, 'completed'> & { day: DayOfWeek } = {
        id,
        day,
        type,
        name: MEAL_NAMES[type],
        time: slot.time,
        foods: slot.foods,
        notes: '',
        reminderEnabled: false,
        lastNotifiedDate: null,
      };
      batch.set(doc(db, 'meals', id), meal);
    }
  }
  await batch.commit();
  console.log('[useMeals] Firestore seeded with recurring weekly meal plan');
}

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
  const [templateMeals, setTemplateMeals] = useState<Meal[]>([]);
  const [completedIds, setCompletedIdsState] = useState<Set<string>>(
    () => getCompletedIds(todayDateStr()),
  );

  // Subscribe to Firestore for this weekday's template meals
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    seedMealsIfNeeded()
      .then(() => {
        if (cancelled) return;
        const q = query(collection(db, 'meals'), where('day', '==', day));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const meals = snapshot.docs
            .map((d) => d.data() as Meal)
            .sort((a, b) => a.time.localeCompare(b.time));
          setTemplateMeals(meals);
        });
      })
      .catch((err) => console.error('[useMeals] seed error', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [day]);

  // Refresh completions when day changes (always use today's actual date)
  useEffect(() => {
    setCompletedIdsState(getCompletedIds(todayDateStr()));
  }, [day]);

  // Merge completion state into meals for consumers
  const dayPlan: DayPlan = {
    date: String(day),
    meals: templateMeals.map((m) => ({ ...m, completed: completedIds.has(m.id) })),
  };

  /** Upsert a meal in Firestore (add or edit). Completion state is NOT saved here. */
  const updateMeal = (meal: Meal) => {
    const { completed: _completed, ...firestoreData } = meal;
    void setDoc(doc(db, 'meals', meal.id), firestoreData);
  };

  /** Remove a meal from Firestore. */
  const deleteMeal = (id: string) => {
    void deleteDoc(doc(db, 'meals', id));
  };

  /**
   * Toggle today's completion for a meal.
   * Writes to localStorage only — the recurring template is unchanged.
   */
  const toggleMealCompleted = (id: string, completed: boolean) => {
    const today = todayDateStr();
    const ids = getCompletedIds(today);
    if (completed) { ids.add(id); } else { ids.delete(id); }
    setCompletedIds(today, ids);
    setCompletedIdsState(new Set(ids));
    // Optimistically patch the Firestore doc's lastNotifiedDate reset (no-op if not needed)
    if (!completed) {
      void updateDoc(doc(db, 'meals', id), { lastNotifiedDate: null }).catch(() => {/* ok */});
    }
  };

  return { dayPlan, updateMeal, deleteMeal, toggleMealCompleted };
}
