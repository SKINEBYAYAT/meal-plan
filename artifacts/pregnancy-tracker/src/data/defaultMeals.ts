/**
 * The bundled 42-meal Lebanese pregnancy meal plan.
 *
 * This is the local source of truth for the recurring MON-SUN plan. It is
 * intentionally independent of network services so the plan works offline.
 */

import { DayOfWeek, Meal, MealType } from '../types';
import { getCurrentWeeklyDinners } from './dinnerPool';

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
    reminderEnabled: true,
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


type SupportingMeals = Pick<Record<BuiltInMealType, string[]>, 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'night_snack'>;

function balancedSupportingMeals(day: DayOfWeek, mainMeal: ReturnType<typeof getCurrentWeeklyDinners>[DayOfWeek]): SupportingMeals {
  const profile = mainMeal.nutrition;

  // Keep six eating occasions and adjust the rest of the day around dinner.
  // This is food-planning logic, not a calorie prescription.
  const breakfast = profile.heaviness === 'heavy'
    ? ['2 fully cooked eggs', 'Whole-wheat pita', 'Well-washed cucumber and tomato', 'Seasonal fruit']
    : ['2 fully cooked eggs', 'Pasteurized labneh', 'Whole-wheat pita', 'Well-washed cucumber and tomato'];

  const morning_snack = profile.heaviness === 'heavy'
    ? ['Seasonal fruit', 'Handful of unsalted nuts']
    : ['3-4 rutab', 'Handful of walnuts or almonds'];

  let lunch: string[];
  if (profile.protein === 'plant') {
    lunch = ['Fully cooked chicken', 'Rice or bulgur', 'Cooked vegetables', 'Lemon'];
  } else if (!profile.ironRich) {
    lunch = ['Fully cooked lean beef', 'Rice or potato', 'Well-washed salad with lemon'];
  } else if (profile.heaviness === 'heavy') {
    lunch = ['Lentil and vegetable soup', 'Whole-wheat pita', 'Well-washed salad with lemon'];
  } else {
    lunch = ['Fully cooked chicken', 'Rice or bulgur', 'Cooked vegetables', 'Pasteurized yogurt'];
  }

  const afternoon_snack = profile.heaviness === 'heavy'
    ? ['Seasonal fruit', 'Pasteurized yogurt']
    : ['Banana or seasonal fruit', 'Full-fat pasteurized yogurt'];

  // If dinner lacks vegetables, deliberately add produce earlier in the day.
  if (!profile.hasVegetables) {
    lunch = [...lunch, 'Extra cooked or well-washed vegetables'];
  }

  // Keep the late snack lighter after heavy dinners; otherwise include dairy + fruit
  // to support energy/protein intake across the day.
  const night_snack = profile.heaviness === 'heavy'
    ? ['Pasteurized milk or yogurt', 'Seasonal fruit']
    : ['Pasteurized milk', 'Banana or seasonal fruit'];

  return { breakfast, morning_snack, lunch, afternoon_snack, night_snack };
}

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

export function getCurrentDefaultWeeklyMeals(): Record<string, DefaultMeal> {
  const result: Record<string, DefaultMeal> = Object.fromEntries(
    Object.entries(DEFAULT_WEEKLY_MEALS).map(([id, item]) => [
      id,
      { ...item, foods: [...item.foods] },
    ]),
  );
  const weeklyDinners = getCurrentWeeklyDinners();
  for (const day of DAYS) {
    // The rotating 100-meal option is the day's main meal and belongs at LUNCH.
    // Dinner remains a lighter supporting meal so we never show both a generated
    // lunch and a second rotating main meal on the same day.
    const mainMeal = weeklyDinners[day];
    const supporting = balancedSupportingMeals(day, mainMeal);

    for (const type of ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'night_snack'] as const) {
      const id = `${day}-${type.replace('_', '-')}`;
      result[id] = { ...result[id], foods: [...supporting[type]] };
    }

    const lunchId = `${day}-lunch`;
    result[lunchId] = { ...result[lunchId], name: mainMeal.name, foods: [...mainMeal.foods] };

    const dinnerId = `${day}-dinner`;
    const lightDinner = mainMeal.nutrition.heaviness === 'heavy'
      ? ['Pasteurized labneh or cheese', 'Whole-wheat pita', 'Well-washed cucumber and tomato']
      : ['Lentil or vegetable soup', 'Whole-wheat pita', 'Pasteurized yogurt'];
    result[dinnerId] = { ...result[dinnerId], name: 'Dinner', foods: lightDinner };
  }
  return result;
}

export const DEFAULT_MEAL_COUNT = Object.keys(DEFAULT_WEEKLY_MEALS).length;
