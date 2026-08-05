import { useState, useEffect } from 'react';
import { Meal, DayPlan } from '../types';
import { getFromStorage, setToStorage, MEALS_KEY } from '../lib/storage';
import { format, addDays, startOfWeek } from 'date-fns';

const DEFAULT_MEALS_SEED = [
  // Monday
  {
    breakfast: { time: '07:30', foods: ['2 eggs', 'Oatmeal with milk', 'Banana'] },
    morning_snack: { time: '10:00', foods: ['3-4 fresh rutab (dates)', 'Walnuts'] },
    lunch: { time: '13:00', foods: ['Grilled chicken', 'Rice', 'Broccoli'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt'] },
    dinner: { time: '19:30', foods: ['Salmon', 'Sweet potato', 'Salad'] },
    night_snack: { time: '21:30', foods: ['Cottage cheese'] }
  },
  // Tuesday
  {
    breakfast: { time: '07:30', foods: ['Greek yogurt', 'Oats', 'Berries', 'Almonds'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab'] },
    lunch: { time: '13:00', foods: ['Lean beef', 'Potatoes', 'Green beans'] },
    afternoon_snack: { time: '16:00', foods: ['Apple with peanut butter'] },
    dinner: { time: '19:30', foods: ['Lentil soup', 'Whole-grain bread', 'Salad'] },
    night_snack: { time: '21:30', foods: ['Milk'] }
  },
  // Wednesday
  {
    breakfast: { time: '07:30', foods: ['Cheese and spinach omelet'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab', 'Almonds'] },
    lunch: { time: '13:00', foods: ['Chicken', 'Rice', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt'] },
    dinner: { time: '19:30', foods: ['Salmon', 'Potatoes', 'Carrots'] },
    night_snack: { time: '21:30', foods: ['Banana'] }
  },
  // Thursday
  {
    breakfast: { time: '07:30', foods: ['Oatmeal', 'Walnuts', 'Fruit'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab'] },
    lunch: { time: '13:00', foods: ['Beef stew', 'Potatoes'] },
    afternoon_snack: { time: '16:00', foods: ['Cottage cheese'] },
    dinner: { time: '19:30', foods: ['Chicken', 'Rice', 'Vegetables'] },
    night_snack: { time: '21:30', foods: ['Kiwi'] }
  },
  // Friday
  {
    breakfast: { time: '07:30', foods: ['Eggs', 'Avocado', 'Whole-grain toast'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab', 'Pistachios'] },
    lunch: { time: '13:00', foods: ['Salmon', 'Rice'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt'] },
    dinner: { time: '19:30', foods: ['Chicken', 'Sweet potato', 'Broccoli'] },
    night_snack: { time: '21:30', foods: ['Milk'] }
  },
  // Saturday
  {
    breakfast: { time: '07:30', foods: ['Greek yogurt', 'Oats', 'Berries'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab'] },
    lunch: { time: '13:00', foods: ['Lean beef', 'Rice', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Orange', 'Walnuts'] },
    dinner: { time: '19:30', foods: ['Lentils', 'Salad'] },
    night_snack: { time: '21:30', foods: ['Cottage cheese'] }
  },
  // Sunday
  {
    breakfast: { time: '07:30', foods: ['Eggs', 'Cheese', 'Fruit'] },
    morning_snack: { time: '10:00', foods: ['3-4 rutab', 'Almonds'] },
    lunch: { time: '13:00', foods: ['Roast chicken', 'Potatoes', 'Vegetables'] },
    afternoon_snack: { time: '16:00', foods: ['Greek yogurt', 'Berries'] },
    dinner: { time: '19:30', foods: ['Grilled fish', 'Rice', 'Salad'] },
    night_snack: { time: '21:30', foods: ['Banana'] }
  }
];

function seedMealsIfNeeded() {
  const current = getFromStorage<Record<string, DayPlan>>(MEALS_KEY, {});
  if (Object.keys(current).length > 0) return current;

  const seeded: Record<string, DayPlan> = {};
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday start

  DEFAULT_MEALS_SEED.forEach((dayMenu, index) => {
    const d = addDays(start, index);
    const dateStr = format(d, 'yyyy-MM-dd');
    
    const meals: Meal[] = [
      { id: `${dateStr}-breakfast`, type: 'breakfast', name: 'Breakfast', time: dayMenu.breakfast.time, foods: dayMenu.breakfast.foods, notes: '', reminderEnabled: false, reminderTime: '07:15', completed: false },
      { id: `${dateStr}-morning_snack`, type: 'morning_snack', name: 'Morning Snack', time: dayMenu.morning_snack.time, foods: dayMenu.morning_snack.foods, notes: '', reminderEnabled: false, reminderTime: '09:45', completed: false },
      { id: `${dateStr}-lunch`, type: 'lunch', name: 'Lunch', time: dayMenu.lunch.time, foods: dayMenu.lunch.foods, notes: '', reminderEnabled: false, reminderTime: '12:45', completed: false },
      { id: `${dateStr}-afternoon_snack`, type: 'afternoon_snack', name: 'Afternoon Snack', time: dayMenu.afternoon_snack.time, foods: dayMenu.afternoon_snack.foods, notes: '', reminderEnabled: false, reminderTime: '15:45', completed: false },
      { id: `${dateStr}-dinner`, type: 'dinner', name: 'Dinner', time: dayMenu.dinner.time, foods: dayMenu.dinner.foods, notes: '', reminderEnabled: false, reminderTime: '19:15', completed: false },
      { id: `${dateStr}-night_snack`, type: 'night_snack', name: 'Night Snack', time: dayMenu.night_snack.time, foods: dayMenu.night_snack.foods, notes: '', reminderEnabled: false, reminderTime: '21:15', completed: false }
    ];

    seeded[dateStr] = { date: dateStr, meals };
  });

  setToStorage(MEALS_KEY, seeded);
  return seeded;
}

export function useMeals(date: string) {
  const [allMeals, setAllMeals] = useState<Record<string, DayPlan>>(() => seedMealsIfNeeded());

  const dayMeals = allMeals[date] || { date, meals: [] };

  const updateMeal = (updatedMeal: Meal) => {
    setAllMeals(prev => {
      const plan = prev[date] || { date, meals: [] };
      const newPlan = {
        ...plan,
        meals: plan.meals.map(m => m.id === updatedMeal.id ? updatedMeal : m)
      };
      // If meal doesn't exist, it's an add
      if (!plan.meals.find(m => m.id === updatedMeal.id)) {
        newPlan.meals = [...plan.meals, updatedMeal];
      }
      
      const newAllMeals = { ...prev, [date]: newPlan };
      setToStorage(MEALS_KEY, newAllMeals);
      return newAllMeals;
    });
  };

  const deleteMeal = (id: string) => {
    setAllMeals(prev => {
      const plan = prev[date] || { date, meals: [] };
      const newPlan = {
        ...plan,
        meals: plan.meals.filter(m => m.id !== id)
      };
      const newAllMeals = { ...prev, [date]: newPlan };
      setToStorage(MEALS_KEY, newAllMeals);
      return newAllMeals;
    });
  };
  
  const toggleMealCompleted = (id: string, completed: boolean) => {
    setAllMeals(prev => {
      const plan = prev[date] || { date, meals: [] };
      const newPlan = {
        ...plan,
        meals: plan.meals.map(m => m.id === id ? { ...m, completed } : m)
      };
      const newAllMeals = { ...prev, [date]: newPlan };
      setToStorage(MEALS_KEY, newAllMeals);
      return newAllMeals;
    });
  }

  return { dayPlan: dayMeals, updateMeal, deleteMeal, toggleMealCompleted, allMeals };
}
