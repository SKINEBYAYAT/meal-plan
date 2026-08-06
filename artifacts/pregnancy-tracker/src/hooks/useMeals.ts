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
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Meal, DayPlan } from '../types';
import { format, addDays, startOfWeek } from 'date-fns';

// ─── Seed data (same weekly plan as before) ───────────────────────────────────

const DEFAULT_MEALS_SEED = [
  // Monday
  {
    breakfast:        { time: '07:30', foods: ['2 eggs', 'Oatmeal with milk', 'Banana'] },
    morning_snack:    { time: '10:00', foods: ['3-4 fresh rutab (dates)', 'Walnuts'] },
    lunch:            { time: '13:00', foods: ['Grilled chicken', 'Rice', 'Broccoli'] },
    afternoon_snack:  { time: '16:00', foods: ['Greek yogurt'] },
    dinner:           { time: '19:30', foods: ['Salmon', 'Sweet potato', 'Salad'] },
    night_snack:      { time: '21:30', foods: ['Cottage cheese'] },
  },
  // Tuesday
  {
    breakfast:        { time: '07:30', foods: ['Greek yogurt', 'Oats', 'Berries', 'Almonds'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab'] },
    lunch:            { time: '13:00', foods: ['Lean beef', 'Potatoes', 'Green beans'] },
    afternoon_snack:  { time: '16:00', foods: ['Apple with peanut butter'] },
    dinner:           { time: '19:30', foods: ['Lentil soup', 'Whole-grain bread', 'Salad'] },
    night_snack:      { time: '21:30', foods: ['Milk'] },
  },
  // Wednesday
  {
    breakfast:        { time: '07:30', foods: ['Cheese and spinach omelet'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab', 'Almonds'] },
    lunch:            { time: '13:00', foods: ['Chicken', 'Rice', 'Vegetables'] },
    afternoon_snack:  { time: '16:00', foods: ['Greek yogurt'] },
    dinner:           { time: '19:30', foods: ['Salmon', 'Potatoes', 'Carrots'] },
    night_snack:      { time: '21:30', foods: ['Banana'] },
  },
  // Thursday
  {
    breakfast:        { time: '07:30', foods: ['Oatmeal', 'Walnuts', 'Fruit'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab'] },
    lunch:            { time: '13:00', foods: ['Beef stew', 'Potatoes'] },
    afternoon_snack:  { time: '16:00', foods: ['Cottage cheese'] },
    dinner:           { time: '19:30', foods: ['Chicken', 'Rice', 'Vegetables'] },
    night_snack:      { time: '21:30', foods: ['Kiwi'] },
  },
  // Friday
  {
    breakfast:        { time: '07:30', foods: ['Eggs', 'Avocado', 'Whole-grain toast'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab', 'Pistachios'] },
    lunch:            { time: '13:00', foods: ['Salmon', 'Rice'] },
    afternoon_snack:  { time: '16:00', foods: ['Greek yogurt'] },
    dinner:           { time: '19:30', foods: ['Chicken', 'Sweet potato', 'Broccoli'] },
    night_snack:      { time: '21:30', foods: ['Milk'] },
  },
  // Saturday
  {
    breakfast:        { time: '07:30', foods: ['Greek yogurt', 'Oats', 'Berries'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab'] },
    lunch:            { time: '13:00', foods: ['Lean beef', 'Rice', 'Vegetables'] },
    afternoon_snack:  { time: '16:00', foods: ['Orange', 'Walnuts'] },
    dinner:           { time: '19:30', foods: ['Lentils', 'Salad'] },
    night_snack:      { time: '21:30', foods: ['Cottage cheese'] },
  },
  // Sunday
  {
    breakfast:        { time: '07:30', foods: ['Eggs', 'Cheese', 'Fruit'] },
    morning_snack:    { time: '10:00', foods: ['3-4 rutab', 'Almonds'] },
    lunch:            { time: '13:00', foods: ['Roast chicken', 'Potatoes', 'Vegetables'] },
    afternoon_snack:  { time: '16:00', foods: ['Greek yogurt', 'Berries'] },
    dinner:           { time: '19:30', foods: ['Grilled fish', 'Rice', 'Salad'] },
    night_snack:      { time: '21:30', foods: ['Banana'] },
  },
];

const MEAL_TYPES = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'night_snack',
] as const;

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'Breakfast',
  morning_snack: 'Morning Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon Snack',
  dinner: 'Dinner',
  night_snack: 'Night Snack',
};

const REMINDER_OFFSETS: Record<string, string> = {
  breakfast: '07:15', morning_snack: '09:45', lunch: '12:45',
  afternoon_snack: '15:45', dinner: '19:15', night_snack: '21:15',
};

// Module-level flag to avoid re-checking Firestore on every hook mount
let seedChecked = false;

async function seedMealsIfNeeded(): Promise<void> {
  if (seedChecked) return;
  seedChecked = true;

  const snap = await getDocs(collection(db, 'meals'));
  if (!snap.empty) return; // already seeded

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const batch = writeBatch(db);

  DEFAULT_MEALS_SEED.forEach((dayMenu, index) => {
    const d = addDays(weekStart, index);
    const dateStr = format(d, 'yyyy-MM-dd');

    MEAL_TYPES.forEach((type) => {
      const slot = dayMenu[type];
      const id = `${dateStr}-${type}`;
      const meal: Meal & { date: string } = {
        id,
        date: dateStr,
        type,
        name: MEAL_NAMES[type],
        time: slot.time,
        foods: slot.foods,
        notes: '',
        reminderEnabled: false,
        reminderTime: REMINDER_OFFSETS[type],
        completed: false,
        notified: false,
        lastNotifiedDate: null,
      };
      batch.set(doc(db, 'meals', id), meal);
    });
  });

  await batch.commit();
  console.log('[useMeals] Firestore seeded with weekly meal plan');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeals(date: string) {
  const [dayPlan, setDayPlan] = useState<DayPlan>({ date, meals: [] });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    seedMealsIfNeeded()
      .then(() => {
        if (cancelled) return;

        const q = query(collection(db, 'meals'), where('date', '==', date));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const meals: Meal[] = snapshot.docs
            .map((d) => d.data() as Meal)
            .sort((a, b) => a.time.localeCompare(b.time));
          setDayPlan({ date, meals });
        });
      })
      .catch((err) => console.error('[useMeals] seed error', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [date]);

  /** Upsert a meal. Works for both add and edit. */
  const updateMeal = (meal: Meal) => {
    void setDoc(doc(db, 'meals', meal.id), { ...meal, date });
  };

  /** Delete a meal by id. */
  const deleteMeal = (id: string) => {
    void deleteDoc(doc(db, 'meals', id));
  };

  /** Toggle completed flag without overwriting the whole document. */
  const toggleMealCompleted = (id: string, completed: boolean) => {
    void updateDoc(doc(db, 'meals', id), { completed });
  };

  return { dayPlan, updateMeal, deleteMeal, toggleMealCompleted };
}
