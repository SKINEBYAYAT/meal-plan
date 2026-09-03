/**
 * The bundled 42-meal Lebanese pregnancy meal plan.
 *
 * This is the local source of truth for the recurring MON-SUN plan. It is
 * intentionally independent of network services so the plan works offline.
 */

import { DayOfWeek, Meal, MealType } from '../types';

type DefaultMeal = Omit<Meal, 'completed'>;
type BuiltInMealType = Exclude<MealType, 'custom'>;

const TIMES: Record<BuiltInMealType, string> = {
  breakfast: '07:30',
  morning_snack: '10:30',
  lunch: '13:00',
  afternoon_snack: '16:00',
  dinner: '19:00',
  night_snack: '21:00',
};

const NAMES: Record<BuiltInMealType, string> = {
  breakfast: 'Breakfast',
  morning_snack: 'Morning Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon Snack',
  dinner: 'Dinner',
  night_snack: 'Evening Snack',
};

function meal(day: DayOfWeek, type: BuiltInMealType, foods: string[]): DefaultMeal {
  return {
    id: `${day}-${type.replace('_', '-')}`,
    day,
    type,
    name: NAMES[type],
    time: TIMES[type],
    foods,
    notes: '',
    reminderEnabled: false,
  };
}

const weeklyFoods: Record<DayOfWeek, Record<BuiltInMealType, string[]>> = {
  monday: {
    breakfast: ['2 fully cooked eggs', 'Labneh', 'Whole-wheat pita', 'Cucumber and tomato'],
    morning_snack: ['3-4 rutab', 'Handful of walnuts'],
    lunch: ['Grilled chicken', 'Rice', 'Yogurt', 'Lebanese salad with lemon'],
    afternoon_snack: ['Banana', 'Full-fat yogurt'],
    dinner: ['Beef kafta', 'Potato', 'Fattoush'],
    night_snack: ['Milk', 'Seasonal fruit'],
  },
  tuesday: {
    breakfast: ['Labneh', '2 boiled eggs', 'Olives', 'Pita', 'Tomato and cucumber'],
    morning_snack: ['3-4 rutab', 'Almonds'],
    lunch: ['Mujaddara', 'Yogurt', 'Tomato/cucumber salad with lemon'],
    afternoon_snack: ['Apple', 'Peanut butter'],
    dinner: ['Chicken tawook', 'Rice', 'Cooked vegetables'],
    night_snack: ['Yogurt', 'Banana'],
  },
  wednesday: {
    breakfast: ['Egg and cheese omelet', 'Pita', 'Tomato'],
    morning_snack: ['3-4 rutab', 'Walnuts'],
    lunch: ['Beef and potato stew', 'Rice', 'Salad with lemon'],
    afternoon_snack: ['Full-fat yogurt', 'Seasonal fruit'],
    dinner: ['Chicken', 'Hummus', 'Pita', 'Salad'],
    night_snack: ['Milk', 'Fruit'],
  },
  thursday: {
    breakfast: ['Labneh', '2 eggs', 'Pita', 'Cucumber and tomato'],
    morning_snack: ['3-4 rutab', 'Almonds'],
    lunch: ['Molokhia with chicken', 'Rice', 'Lemon'],
    afternoon_snack: ['Banana', 'Yogurt'],
    dinner: ['Beef kafta', 'Hummus', 'Pita', 'Vegetables'],
    night_snack: ['Cheese', 'Seasonal fruit'],
  },
  friday: {
    breakfast: ['2 eggs', 'Cheese', 'Pita', 'Cucumber and tomato'],
    morning_snack: ['3-4 rutab', 'Walnuts'],
    lunch: ['Chicken', 'Baked potatoes', 'Salad', 'Yogurt'],
    afternoon_snack: ['Orange', 'Nuts'],
    dinner: ['Beef', 'Rice', 'Peas and carrots'],
    night_snack: ['Milk', 'Banana'],
  },
  saturday: {
    breakfast: ['Foul', 'Boiled egg', 'Pita', 'Tomato and cucumber'],
    morning_snack: ['3-4 rutab', 'Almonds'],
    lunch: ['Lebanese chicken and rice', 'Yogurt with cucumber'],
    afternoon_snack: ['Yogurt', 'Banana'],
    dinner: ['Lentil soup', 'Cheese', 'Pita', 'Salad with lemon'],
    night_snack: ['Milk', 'Seasonal fruit'],
  },
  sunday: {
    breakfast: ['Eggs', 'Labneh', 'Cheese', 'Pita', 'Vegetables'],
    morning_snack: ['3-4 rutab', 'Walnuts'],
    lunch: ['Beef kafta or cooked beef', 'Rice or potatoes', 'Lebanese salad with lemon'],
    afternoon_snack: ['Yogurt', 'Seasonal fruit'],
    dinner: ['Chicken tawook', 'Hummus', 'Pita', 'Salad'],
    night_snack: ['Milk', 'Banana'],
  },
};

const DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];
const TYPES: BuiltInMealType[] = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'night_snack',
];

export const DEFAULT_WEEKLY_MEALS: Record<string, DefaultMeal> = Object.fromEntries(
  DAYS.flatMap((day) => TYPES.map((type) => {
    const item = meal(day, type, weeklyFoods[day][type]);
    return [item.id, item];
  })),
);

export const DEFAULT_MEAL_COUNT = Object.keys(DEFAULT_WEEKLY_MEALS).length;
