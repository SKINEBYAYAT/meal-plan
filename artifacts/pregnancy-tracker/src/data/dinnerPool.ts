import type { DayOfWeek } from '../types';
import { MEAL_PLAN_KEY } from '../lib/storage';

export type MealNutritionProfile = Readonly<{
  protein: 'high' | 'moderate' | 'plant';
  heaviness: 'light' | 'medium' | 'heavy';
  ironRich: boolean;
  hasVegetables: boolean;
  carbBase: 'rice' | 'potato' | 'bread' | 'pasta' | 'bulgur' | 'mixed';
  category: 'lebanese' | 'chicken' | 'beef' | 'pasta' | 'burger' | 'fajita' | 'wrap' | 'sausage' | 'vegetarian';
}>;

export type DinnerOption = Readonly<{
  id: string;
  name: string;
  foods: readonly string[];
  nutrition: MealNutritionProfile;
}>;

type DinnerSeed = Omit<DinnerOption, 'nutrition'>;

export const DINNER_ROTATION_STORAGE_KEY = 'pregnancy-dinner-rotation-v1';
export const DINNER_REMINDER_SYNC_STORAGE_KEY = 'pregnancy-dinner-reminder-sync-v1';

const POOL_VERSION = 4;
const FRESH_START_VERSION = 4;
// One-time recovery for the stale week; never force a reset in later weeks.
const STALE_WEEK_RECOVERY = '2026-09-14';
const DINNER_DAYS: readonly DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const DINNER_SEEDS: readonly DinnerSeed[] = [
  { id: 'chicken-tawook-rice', name: 'Chicken Tawook with Rice', foods: ['Fully cooked chicken tawook', 'Rice', 'Cooked vegetables', 'Pasteurized yogurt'] },
  { id: 'chicken-potato-tray', name: 'Lebanese Chicken and Potato Tray', foods: ['Fully cooked chicken', 'Roasted potatoes', 'Garlic and lemon', 'Well-washed Lebanese salad'] },
  { id: 'molokhia-chicken', name: 'Molokhia with Chicken', foods: ['Molokhia', 'Fully cooked chicken', 'Rice', 'Lemon'] },
  { id: 'chicken-moghrabieh', name: 'Chicken Moghrabieh', foods: ['Fully cooked chicken', 'Moghrabieh pearls', 'Chickpeas', 'Cooked onions'] },
  { id: 'chicken-freekeh', name: 'Chicken Freekeh Pilaf', foods: ['Fully cooked chicken', 'Freekeh', 'Cooked carrots', 'Pasteurized yogurt'] },
  { id: 'chicken-shawarma-bowl', name: 'Chicken Shawarma Rice Bowl', foods: ['Fully cooked chicken shawarma', 'Rice', 'Hummus', 'Well-washed tomato and cucumber'] },
  { id: 'chicken-kafta-vegetables', name: 'Chicken Kafta with Roasted Vegetables', foods: ['Fully cooked chicken kafta', 'Roasted zucchini', 'Roasted peppers', 'Whole-wheat pita'] },
  { id: 'chicken-pea-stew', name: 'Chicken and Pea Stew with Rice', foods: ['Fully cooked chicken', 'Peas and carrots', 'Tomato sauce', 'Rice'] },
  { id: 'chicken-green-bean-stew', name: 'Chicken and Green Bean Stew', foods: ['Fully cooked chicken', 'Green beans', 'Tomato sauce', 'Bulgur'] },
  { id: 'lemon-chicken-potatoes', name: 'Lemon Garlic Chicken with Potatoes', foods: ['Fully cooked chicken', 'Baked potatoes', 'Garlic and lemon', 'Cooked spinach'] },
  { id: 'beef-kafta-potatoes', name: 'Beef Kafta with Potatoes', foods: ['Fully cooked beef kafta', 'Baked potatoes', 'Tomato', 'Pasteurized yogurt'] },
  { id: 'beef-kafta-rice', name: 'Beef Kafta with Rice and Yogurt', foods: ['Fully cooked beef kafta', 'Rice', 'Cooked vegetables', 'Pasteurized yogurt'] },
  { id: 'beef-potato-stew', name: 'Lebanese Beef and Potato Stew', foods: ['Fully cooked beef', 'Potatoes', 'Tomato sauce', 'Rice'] },
  { id: 'bazella-riz-beef', name: 'Bazella w Riz with Beef', foods: ['Fully cooked beef', 'Peas and carrots', 'Tomato sauce', 'Rice'] },
  { id: 'loubieh-bi-lahme', name: 'Loubieh bi Lahme', foods: ['Fully cooked beef', 'Green beans', 'Tomato sauce', 'Rice'] },
  { id: 'fasolia-bi-lahme', name: 'Fasolia bi Lahme', foods: ['Fully cooked beef', 'White beans', 'Tomato sauce', 'Rice'] },
  { id: 'bamieh-bi-lahme', name: 'Bamieh bi Lahme', foods: ['Fully cooked beef', 'Okra', 'Tomato sauce', 'Rice'] },
  { id: 'dawood-basha', name: 'Dawood Basha with Rice', foods: ['Fully cooked beef meatballs', 'Tomato and onion sauce', 'Rice', 'Cooked vegetables'] },
  { id: 'beef-rice-pilaf', name: 'Lebanese Beef and Rice Pilaf', foods: ['Fully cooked lean beef', 'Rice', 'Peas', 'Pasteurized yogurt'] },
  { id: 'baked-beef-kibbeh', name: 'Baked Beef Kibbeh Tray', foods: ['Fully baked beef kibbeh', 'Bulgur', 'Pasteurized yogurt', 'Well-washed salad'] },
  { id: 'kibbeh-labanieh', name: 'Kibbeh Labanieh', foods: ['Fully cooked kibbeh', 'Pasteurized yogurt sauce', 'Rice', 'Cooked spinach'] },
  { id: 'shish-barak', name: 'Shish Barak with Rice', foods: ['Fully cooked beef dumplings', 'Pasteurized yogurt sauce', 'Rice', 'Cooked vegetables'] },
  { id: 'kousa-mahshi', name: 'Kousa Mahshi', foods: ['Zucchini stuffed with fully cooked beef and rice', 'Tomato broth', 'Pasteurized yogurt'] },
  { id: 'kousa-bil-laban', name: 'Kousa bil Laban', foods: ['Zucchini stuffed with fully cooked beef and rice', 'Pasteurized yogurt sauce', 'Cooked mint'] },
  { id: 'stuffed-cabbage', name: 'Stuffed Cabbage Rolls', foods: ['Cabbage', 'Fully cooked beef and rice filling', 'Garlic and lemon', 'Pasteurized yogurt'] },
  { id: 'stuffed-grape-leaves-beef', name: 'Stuffed Grape Leaves with Beef', foods: ['Fully cooked grape leaves', 'Fully cooked beef and rice filling', 'Lemon', 'Pasteurized yogurt'] },
  { id: 'sheikh-el-mahshi', name: 'Sheikh el Mahshi', foods: ['Baked eggplant', 'Fully cooked beef', 'Tomato sauce', 'Rice'] },
  { id: 'eggplant-moussaka-beef', name: 'Eggplant Moussaka with Beef', foods: ['Baked eggplant', 'Fully cooked beef', 'Tomato and chickpeas', 'Rice'] },
  { id: 'beef-shawarma-plate', name: 'Beef Shawarma Plate', foods: ['Fully cooked beef shawarma', 'Hummus', 'Roasted potatoes', 'Well-washed fattoush'] },
  { id: 'meatballs-potatoes', name: 'Lebanese Meatballs with Potatoes', foods: ['Fully cooked beef meatballs', 'Potatoes', 'Tomato sauce', 'Cooked carrots'] },
  { id: 'mujaddara-yogurt', name: 'Mujaddara with Yogurt', foods: ['Lentils', 'Rice', 'Cooked onions', 'Pasteurized yogurt'] },
  { id: 'mdardara-cabbage', name: 'Mdardara with Cabbage Salad', foods: ['Lentils', 'Bulgur', 'Cooked onions', 'Well-washed cabbage salad'] },
  { id: 'red-lentil-soup', name: 'Red Lentil Soup with Toasted Pita', foods: ['Red lentils', 'Carrots and potatoes', 'Toasted whole-wheat pita', 'Pasteurized labneh'] },
  { id: 'lentil-spinach-stew', name: 'Lentil and Spinach Stew', foods: ['Lentils', 'Cooked spinach', 'Potatoes', 'Whole-wheat pita'] },
  { id: 'red-lentil-potato-stew', name: 'Red Lentil and Potato Stew', foods: ['Red lentils', 'Potatoes', 'Carrots', 'Pasteurized yogurt'] },
  { id: 'chickpea-spinach-stew', name: 'Chickpea and Spinach Stew', foods: ['Chickpeas', 'Cooked spinach', 'Tomato', 'Rice'] },
  { id: 'chickpea-rice-pilaf', name: 'Chickpea Rice Pilaf', foods: ['Chickpeas', 'Rice', 'Cooked carrots and peas', 'Pasteurized yogurt'] },
  { id: 'hummus-fatteh', name: 'Hummus Fatteh', foods: ['Chickpeas', 'Toasted pita', 'Pasteurized yogurt and tahini', 'Cooked pine nuts'] },
  { id: 'baked-falafel-plate', name: 'Baked Falafel Plate', foods: ['Baked falafel', 'Hummus', 'Whole-wheat pita', 'Well-washed tomato and cucumber'] },
  { id: 'bulgur-chickpea-pilaf', name: 'Bulgur and Chickpea Pilaf', foods: ['Bulgur', 'Chickpeas', 'Cooked tomatoes', 'Pasteurized yogurt'] },
  { id: 'vegetarian-kousa', name: 'Vegetarian Kousa Mahshi', foods: ['Zucchini stuffed with rice and chickpeas', 'Tomato broth', 'Pasteurized yogurt'] },
  { id: 'vegetarian-grape-leaves', name: 'Vegetarian Stuffed Grape Leaves', foods: ['Fully cooked grape leaves', 'Rice and chickpea filling', 'Tomato', 'Pasteurized yogurt'] },
  { id: 'maghmour', name: 'Maghmour', foods: ['Eggplant', 'Chickpeas', 'Tomato and onion', 'Bulgur'] },
  { id: 'loubieh-bi-zeit', name: 'Loubieh bi Zeit with Bulgur', foods: ['Green beans', 'Tomato and onion', 'Bulgur', 'Pasteurized yogurt'] },
  { id: 'fasolia-bi-zeit', name: 'Fasolia bi Zeit with Rice', foods: ['White beans', 'Tomato and carrots', 'Rice', 'Lemon'] },
  { id: 'potato-kibbeh', name: 'Potato Kibbeh Tray', foods: ['Baked potato kibbeh', 'Bulgur', 'Cooked spinach', 'Pasteurized yogurt'] },
  { id: 'cauliflower-tahini', name: 'Cauliflower Tahini with Lentil Rice', foods: ['Roasted cauliflower', 'Tahini sauce', 'Lentil rice', 'Well-washed salad'] },
  { id: 'spinach-rice-chickpeas', name: 'Spinach Rice with Chickpeas', foods: ['Cooked spinach', 'Rice', 'Chickpeas', 'Pasteurized yogurt'] },
  { id: 'vegetable-stew-rice', name: 'Lebanese Vegetable Stew with Rice', foods: ['Zucchini and potatoes', 'Carrots and peas', 'Tomato sauce', 'Rice'] },
  { id: 'roasted-vegetable-hummus', name: 'Roasted Vegetable Hummus Plate', foods: ['Hummus', 'Roasted seasonal vegetables', 'Whole-wheat pita', 'Pasteurized labneh'] },
  { id: 'spaghetti-bolognese', name: 'Spaghetti Bolognese', foods: ['Whole-wheat spaghetti', 'Fully cooked lean beef', 'Tomato sauce', 'Cooked carrots and peppers'] },
  { id: 'penne-chicken-tomato', name: 'Chicken Penne in Tomato Sauce', foods: ['Penne pasta', 'Fully cooked chicken', 'Tomato sauce', 'Cooked zucchini'] },
  { id: 'chicken-creamy-pasta', name: 'Creamy Chicken Pasta', foods: ['Pasta', 'Fully cooked chicken', 'Pasteurized light cream', 'Cooked mushrooms and spinach'] },
  { id: 'beef-lasagna', name: 'Beef Lasagna', foods: ['Fully cooked lean beef', 'Pasta sheets', 'Tomato sauce', 'Pasteurized cheese', 'Well-washed salad'] },
  { id: 'chicken-lasagna', name: 'Chicken and Spinach Lasagna', foods: ['Fully cooked chicken', 'Pasta sheets', 'Cooked spinach', 'Pasteurized cheese'] },
  { id: 'beef-macaroni', name: 'Beef Macaroni with Tomato', foods: ['Macaroni', 'Fully cooked lean beef', 'Tomato sauce', 'Cooked vegetables'] },
  { id: 'chicken-pesto-pasta', name: 'Chicken Pesto Pasta', foods: ['Pasta', 'Fully cooked chicken', 'Pasteurized pesto ingredients', 'Cooked broccoli'] },
  { id: 'tuna-pasta', name: 'Tuna and Tomato Pasta', foods: ['Pasta', 'Canned light tuna', 'Tomato sauce', 'Cooked vegetables'] },
  { id: 'lentil-bolognese', name: 'Lentil Bolognese Pasta', foods: ['Whole-wheat pasta', 'Lentils', 'Tomato sauce', 'Cooked carrots and zucchini'] },
  { id: 'chicken-mushroom-pasta', name: 'Chicken Mushroom Pasta', foods: ['Pasta', 'Fully cooked chicken', 'Cooked mushrooms', 'Pasteurized yogurt-based sauce'] },
  { id: 'homemade-beef-burger', name: 'Homemade Beef Burger', foods: ['Fully cooked lean beef patty', 'Whole-wheat bun', 'Pasteurized cheese', 'Well-washed lettuce and tomato', 'Baked potato wedges'] },
  { id: 'homemade-chicken-burger', name: 'Homemade Chicken Burger', foods: ['Fully cooked chicken patty', 'Whole-wheat bun', 'Pasteurized cheese', 'Well-washed lettuce and tomato', 'Baked potatoes'] },
  { id: 'beef-burger-avocado', name: 'Beef Burger with Avocado', foods: ['Fully cooked lean beef patty', 'Whole-wheat bun', 'Avocado', 'Well-washed tomato', 'Baked sweet potato'] },
  { id: 'chicken-burger-yogurt', name: 'Chicken Burger with Yogurt Slaw', foods: ['Fully cooked chicken patty', 'Whole-wheat bun', 'Pasteurized yogurt slaw', 'Baked potato wedges'] },
  { id: 'mini-kafta-burgers', name: 'Lebanese Kafta Burgers', foods: ['Fully cooked beef kafta patties', 'Whole-wheat buns', 'Hummus', 'Well-washed tomato and parsley', 'Baked potatoes'] },
  { id: 'chicken-fajitas', name: 'Chicken Fajitas', foods: ['Fully cooked chicken strips', 'Cooked peppers and onions', 'Whole-wheat tortillas', 'Avocado', 'Pasteurized yogurt'] },
  { id: 'beef-fajitas', name: 'Beef Fajitas', foods: ['Fully cooked beef strips', 'Cooked peppers and onions', 'Whole-wheat tortillas', 'Tomato salsa'] },
  { id: 'chicken-fajita-rice', name: 'Chicken Fajita Rice Bowl', foods: ['Fully cooked chicken', 'Rice', 'Cooked peppers and onions', 'Corn', 'Avocado'] },
  { id: 'beef-fajita-rice', name: 'Beef Fajita Rice Bowl', foods: ['Fully cooked beef', 'Rice', 'Cooked peppers and onions', 'Beans', 'Tomato'] },
  { id: 'bean-fajitas', name: 'Bean and Cheese Fajitas', foods: ['Black or kidney beans', 'Cooked peppers and onions', 'Whole-wheat tortillas', 'Pasteurized cheese', 'Avocado'] },
  { id: 'makanek-potatoes', name: 'Makanek with Potatoes and Vegetables', foods: ['Fully cooked makanek sausage', 'Baked potatoes', 'Cooked peppers and zucchini', 'Lemon'] },
  { id: 'makanek-rice', name: 'Makanek Rice Bowl', foods: ['Fully cooked makanek sausage', 'Rice', 'Cooked peas and carrots', 'Pasteurized yogurt'] },
  { id: 'soujouk-vegetables', name: 'Soujouk with Roasted Vegetables', foods: ['Fully cooked soujouk', 'Roasted peppers and zucchini', 'Baked potatoes', 'Pasteurized yogurt'] },
  { id: 'soujouk-eggs', name: 'Soujouk and Eggs Plate', foods: ['Fully cooked soujouk', 'Fully cooked eggs', 'Whole-wheat pita', 'Well-washed tomato and cucumber'] },
  { id: 'makanek-tomato', name: 'Makanek in Tomato Sauce', foods: ['Fully cooked makanek sausage', 'Tomato sauce', 'Cooked peppers', 'Rice'] },
  { id: 'chicken-shawarma-wrap', name: 'Chicken Shawarma Wrap', foods: ['Fully cooked chicken shawarma', 'Whole-wheat wrap', 'Hummus', 'Well-washed lettuce and tomato', 'Baked potatoes'] },
  { id: 'beef-shawarma-wrap', name: 'Beef Shawarma Wrap', foods: ['Fully cooked beef shawarma', 'Whole-wheat wrap', 'Tahini', 'Well-washed tomato and parsley'] },
  { id: 'tawook-wrap', name: 'Chicken Tawook Wrap', foods: ['Fully cooked chicken tawook', 'Whole-wheat wrap', 'Hummus', 'Well-washed vegetables'] },
  { id: 'kafta-wrap', name: 'Kafta Wrap', foods: ['Fully cooked beef kafta', 'Whole-wheat wrap', 'Pasteurized yogurt sauce', 'Well-washed tomato and parsley'] },
  { id: 'chicken-avocado-wrap', name: 'Chicken Avocado Wrap', foods: ['Fully cooked chicken', 'Whole-wheat wrap', 'Avocado', 'Well-washed lettuce and tomato'] },
  { id: 'chicken-burrito-bowl', name: 'Chicken Burrito Bowl', foods: ['Fully cooked chicken', 'Rice', 'Beans', 'Corn', 'Avocado', 'Tomato'] },
  { id: 'beef-burrito-bowl', name: 'Beef Burrito Bowl', foods: ['Fully cooked lean beef', 'Rice', 'Beans', 'Cooked peppers', 'Tomato'] },
  { id: 'chicken-quesadilla', name: 'Chicken and Cheese Quesadilla', foods: ['Fully cooked chicken', 'Whole-wheat tortilla', 'Pasteurized cheese', 'Cooked peppers', 'Tomato salsa'] },
  { id: 'beef-quesadilla', name: 'Beef and Vegetable Quesadilla', foods: ['Fully cooked beef', 'Whole-wheat tortilla', 'Pasteurized cheese', 'Cooked peppers and onions'] },
  { id: 'bean-quesadilla', name: 'Bean and Cheese Quesadilla', foods: ['Beans', 'Whole-wheat tortilla', 'Pasteurized cheese', 'Cooked peppers', 'Avocado'] },
  { id: 'chicken-stir-fry-rice', name: 'Chicken Vegetable Stir-Fry with Rice', foods: ['Fully cooked chicken', 'Rice', 'Cooked broccoli', 'Carrots and peppers'] },
  { id: 'beef-stir-fry-rice', name: 'Beef Vegetable Stir-Fry with Rice', foods: ['Fully cooked beef', 'Rice', 'Cooked broccoli', 'Carrots and peppers'] },
  { id: 'chicken-sweet-potato', name: 'Chicken with Sweet Potato and Spinach', foods: ['Fully cooked chicken', 'Baked sweet potato', 'Cooked spinach', 'Pasteurized yogurt'] },
  { id: 'beef-sweet-potato', name: 'Beef with Sweet Potato and Vegetables', foods: ['Fully cooked lean beef', 'Baked sweet potato', 'Cooked zucchini and carrots'] },
  { id: 'chicken-rice-beans', name: 'Chicken Rice and Beans', foods: ['Fully cooked chicken', 'Rice', 'Beans', 'Cooked tomato and peppers'] },
  { id: 'beef-kofta-bulgur', name: 'Beef Kofta with Bulgur', foods: ['Fully cooked beef kofta', 'Bulgur', 'Cooked vegetables', 'Pasteurized yogurt'] },
  { id: 'chicken-kofta-bulgur', name: 'Chicken Kofta with Bulgur', foods: ['Fully cooked chicken kofta', 'Bulgur', 'Cooked vegetables', 'Pasteurized yogurt'] },
  { id: 'baked-chicken-parmesan', name: 'Baked Chicken Parmesan', foods: ['Fully cooked baked chicken', 'Tomato sauce', 'Pasteurized cheese', 'Pasta', 'Cooked vegetables'] },
  { id: 'beef-meatball-pasta', name: 'Beef Meatball Pasta', foods: ['Fully cooked beef meatballs', 'Pasta', 'Tomato sauce', 'Cooked zucchini'] },
  { id: 'chicken-meatball-rice', name: 'Chicken Meatballs with Rice', foods: ['Fully cooked chicken meatballs', 'Rice', 'Tomato sauce', 'Cooked peas and carrots'] },
  { id: 'turkey-meatball-pasta', name: 'Turkey Meatball Pasta', foods: ['Fully cooked turkey meatballs', 'Whole-wheat pasta', 'Tomato sauce', 'Cooked vegetables'] },
  { id: 'chickpea-pasta-bowl', name: 'Chickpea Pasta Bowl', foods: ['Whole-wheat pasta', 'Chickpeas', 'Tomato', 'Cooked spinach', 'Pasteurized cheese'] },
  { id: 'white-bean-pasta', name: 'White Bean Tomato Pasta', foods: ['Pasta', 'White beans', 'Tomato sauce', 'Cooked spinach'] },
  { id: 'chicken-flatbread', name: 'Chicken Vegetable Flatbread', foods: ['Whole-wheat flatbread', 'Fully cooked chicken', 'Pasteurized cheese', 'Cooked peppers and mushrooms'] },
  { id: 'beef-flatbread', name: 'Beef and Vegetable Flatbread', foods: ['Whole-wheat flatbread', 'Fully cooked lean beef', 'Pasteurized cheese', 'Cooked peppers and tomato'] },

];


function profileDinner(seed: DinnerSeed): MealNutritionProfile {
  const text = `${seed.name} ${seed.foods.join(' ')}`.toLowerCase();
  const beef = /beef|kafta|kofta|meatball|shawarma|kibbeh|makanek|soujouk/.test(text);
  const chicken = /chicken|turkey/.test(text);
  const plant = !beef && !chicken && !/tuna/.test(text);
  const category: MealNutritionProfile['category'] =
    /pasta|spaghetti|penne|lasagna|macaroni/.test(text) ? 'pasta' :
    /burger/.test(text) ? 'burger' :
    /fajita/.test(text) ? 'fajita' :
    /wrap|quesadilla|flatbread/.test(text) ? 'wrap' :
    /makanek|soujouk|sausage/.test(text) ? 'sausage' :
    chicken ? 'chicken' : beef ? 'beef' : plant ? 'vegetarian' : 'lebanese';
  const carbBase: MealNutritionProfile['carbBase'] =
    /pasta|spaghetti|penne|lasagna|macaroni/.test(text) ? 'pasta' :
    /rice/.test(text) ? 'rice' :
    /potato/.test(text) ? 'potato' :
    /pita|bread|bun|tortilla|wrap|flatbread/.test(text) ? 'bread' :
    /bulgur|freekeh|moghrabieh/.test(text) ? 'bulgur' : 'mixed';
  const heaviness: MealNutritionProfile['heaviness'] =
    /burger|lasagna|creamy|makanek|soujouk|fatteh|kibbeh labanieh|shish barak/.test(text) ? 'heavy' :
    /soup|salad|vegetable stew|roasted vegetable/.test(text) ? 'light' : 'medium';
  return {
    protein: plant ? 'plant' : 'high',
    heaviness,
    ironRich: beef || /lentil|bean|chickpea|spinach/.test(text),
    hasVegetables: /vegetable|tomato|pepper|spinach|zucchini|carrot|salad|lettuce|broccoli|okra|green bean|eggplant|cabbage|pea/.test(text),
    carbBase,
    category,
  };
}

export const DINNER_POOL: readonly DinnerOption[] = DINNER_SEEDS.map((seed) => ({
  ...seed,
  nutrition: profileDinner(seed),
}));

type DinnerRotationState = {
  version: number;
  weekKey: string;
  currentDinnerIds: string[];
  remainingDinnerIds: string[];
  recoveredStaleWeek?: string;
};

const dinnerById = new Map(DINNER_POOL.map((dinner) => [dinner.id, dinner]));
let memoryRotationState: DinnerRotationState | null = null;

function randomIndex(maxExclusive: number): number {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return Math.floor((value[0] / 0x1_0000_0000) * maxExclusive);
  }
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle(ids: readonly string[]): string[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function validUniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((id): id is string => {
    if (typeof id !== 'string' || !dinnerById.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function readRotationState(): DinnerRotationState | null {
  try {
    const raw = localStorage.getItem(DINNER_ROTATION_STORAGE_KEY);
    if (!raw) return memoryRotationState;
    const parsed = JSON.parse(raw) as Partial<DinnerRotationState>;
    const currentDinnerIds = validUniqueIds(parsed.currentDinnerIds);
    if (parsed.version !== POOL_VERSION || typeof parsed.weekKey !== 'string'
      || currentDinnerIds.length !== DINNER_DAYS.length) return null;
    memoryRotationState = {
      version: POOL_VERSION,
      weekKey: parsed.weekKey,
      currentDinnerIds,
      remainingDinnerIds: validUniqueIds(parsed.remainingDinnerIds),
      recoveredStaleWeek: parsed.recoveredStaleWeek === STALE_WEEK_RECOVERY
        ? STALE_WEEK_RECOVERY : undefined,
    };
    return memoryRotationState;
  } catch {
    return memoryRotationState;
  }
}

function writeRotationState(state: DinnerRotationState): void {
  memoryRotationState = state;
  try {
    localStorage.setItem(DINNER_ROTATION_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[Dinner rotation] Failed to save weekly dinners:', error);
  }
}

export function getBeirutWeekKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const beirutDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const daysSinceMonday = (beirutDate.getUTCDay() + 6) % 7;
  beirutDate.setUTCDate(beirutDate.getUTCDate() - daysSinceMonday);
  return beirutDate.toISOString().slice(0, 10);
}

function drawWeek(queue: string[], previousWeekIds: readonly string[] = []): { selected: string[]; remaining: string[] } {
  const selected: string[] = [];
  let remaining = [...queue];
  const allIds = DINNER_POOL.map((dinner) => dinner.id);
  const previousWeek = new Set(previousWeekIds);
  const categoryCounts = new Map<MealNutritionProfile['category'], number>();
  const carbCounts = new Map<MealNutritionProfile['carbBase'], number>();

  const scoreCandidate = (id: string, index: number): number => {
    const dinner = dinnerById.get(id)!;
    const categoryCount = categoryCounts.get(dinner.nutrition.category) ?? 0;
    const carbCount = carbCounts.get(dinner.nutrition.carbBase) ?? 0;
    const previous = previousWeek.has(id) ? 1000 : 0;
    const duplicate = selected.includes(id) ? 1000 : 0;
    const adjacentCategory = selected.length > 0
      && dinnerById.get(selected[selected.length - 1])?.nutrition.category === dinner.nutrition.category ? 20 : 0;
    const heavyPenalty = dinner.nutrition.heaviness === 'heavy'
      && selected.some((selectedId) => dinnerById.get(selectedId)?.nutrition.heaviness === 'heavy') ? 8 : 0;
    // Prefer the existing shuffled queue, but strongly favor weekly variety.
    return previous + duplicate + (categoryCount * 12) + (carbCount * 4)
      + adjacentCategory + heavyPenalty + (index / Math.max(remaining.length, 1));
  };

  while (selected.length < DINNER_DAYS.length) {
    if (remaining.length === 0) {
      // Start a new 100-meal cycle only after the current queue is exhausted.
      // Put the just-used/previous meals at the back so cycle boundaries do not
      // immediately repeat last week's dinners.
      remaining = shuffle(allIds.filter((id) => !previousWeek.has(id) && !selected.includes(id)))
        .concat(shuffle(allIds.filter((id) => previousWeek.has(id) || selected.includes(id))));
    }

    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const score = scoreCandidate(remaining[index], index);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    // The queue can contain only excluded IDs at a cycle boundary; rebuild once
    // rather than allowing an accidental duplicate inside the same week.
    if (bestIndex < 0 || selected.includes(remaining[bestIndex])) {
      remaining = shuffle(allIds.filter((id) => !selected.includes(id)));
      continue;
    }

    const [nextId] = remaining.splice(bestIndex, 1);
    selected.push(nextId);
    const nutrition = dinnerById.get(nextId)!.nutrition;
    categoryCounts.set(nutrition.category, (categoryCounts.get(nutrition.category) ?? 0) + 1);
    carbCounts.set(nutrition.carbBase, (carbCounts.get(nutrition.carbBase) ?? 0) + 1);
  }

  return { selected, remaining };
}

function getDinnerIdsForWeek(now = new Date()): { weekKey: string; dinnerIds: string[] } {
  const weekKey = getBeirutWeekKey(now);
  let saved = readRotationState();

  // v4 is an intentional fresh start for the new 100-meal system. Older saved
  // rotations are discarded once so users who were stuck on months-old meals
  // immediately receive a newly generated current week. After this, the same
  // Beirut week remains stable and every new Monday rotates normally.
  try {
    const freshStartKey = `${DINNER_ROTATION_STORAGE_KEY}-fresh-start`;
    if (localStorage.getItem(freshStartKey) !== String(FRESH_START_VERSION)) {
      localStorage.removeItem(DINNER_ROTATION_STORAGE_KEY);
      localStorage.removeItem(MEAL_PLAN_KEY);
      memoryRotationState = null;
      saved = null;
      localStorage.setItem(freshStartKey, String(FRESH_START_VERSION));
    }
  } catch {
    // Storage restrictions should not prevent generating the current week.
  }

  const recoverStaleWeek = weekKey === STALE_WEEK_RECOVERY
    && saved?.recoveredStaleWeek !== STALE_WEEK_RECOVERY;
  if (saved?.weekKey === weekKey && !recoverStaleWeek) {
    return { weekKey, dinnerIds: saved.currentDinnerIds };
  }

  const allIds = DINNER_POOL.map((dinner) => dinner.id);
  const previousIds = new Set(saved?.currentDinnerIds ?? []);
  if (recoverStaleWeek) {
    // The visible snapshot may predate the rotation state. Count both as used,
    // while ignoring custom meals and retaining the existing unconsumed queue.
    try {
      const plan = JSON.parse(localStorage.getItem(MEAL_PLAN_KEY) ?? '{}');
      for (const day of DINNER_DAYS) {
        const visible = plan?.[`${day}-dinner`];
        const dinner = DINNER_POOL.find((option) => option.name === visible?.name);
        if (dinner) previousIds.add(dinner.id);
      }
    } catch {
      // The saved rotation still supplies the previously used dinner IDs.
    }
  }
  const queue = saved?.remainingDinnerIds ?? shuffle(allIds);
  const drawn = drawWeek(
    recoverStaleWeek ? queue.filter((id) => !previousIds.has(id)) : queue,
    [...previousIds],
  );
  writeRotationState({
    version: POOL_VERSION,
    weekKey,
    currentDinnerIds: drawn.selected,
    remainingDinnerIds: drawn.remaining,
    // Store the marker and selection atomically, including on a first install.
    recoveredStaleWeek: recoverStaleWeek ? STALE_WEEK_RECOVERY : saved?.recoveredStaleWeek,
  });
  return { weekKey, dinnerIds: drawn.selected };
}

export function getCurrentWeeklyDinners(now = new Date()): Record<DayOfWeek, DinnerOption> {
  const { dinnerIds } = getDinnerIdsForWeek(now);
  return Object.fromEntries(
    DINNER_DAYS.map((day, index) => [day, dinnerById.get(dinnerIds[index])!]),
  ) as Record<DayOfWeek, DinnerOption>;
}

export function getCurrentDinnerRotationSignature(now = new Date()): string {
  const { weekKey, dinnerIds } = getDinnerIdsForWeek(now);
  return `${weekKey}:${dinnerIds.join(',')}`;
}

if (DINNER_POOL.length !== 100 || dinnerById.size !== DINNER_POOL.length) {
  throw new Error('Dinner pool must contain exactly 100 uniquely identified meals.');
}
