import type { DayOfWeek } from '../types';

export type DinnerOption = Readonly<{
  id: string;
  name: string;
  foods: readonly string[];
}>;

export const DINNER_ROTATION_STORAGE_KEY = 'pregnancy-dinner-rotation-v1';
export const DINNER_REMINDER_SYNC_STORAGE_KEY = 'pregnancy-dinner-reminder-sync-v1';

const POOL_VERSION = 1;
const DINNER_DAYS: readonly DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export const DINNER_POOL: readonly DinnerOption[] = [
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
];

type DinnerRotationState = {
  version: number;
  weekKey: string;
  currentDinnerIds: string[];
  remainingDinnerIds: string[];
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

  while (selected.length < DINNER_DAYS.length) {
    if (remaining.length === 0) remaining = shuffle(allIds);
    let nextIndex = remaining.findIndex((id) => !selected.includes(id) && !previousWeek.has(id));
    if (nextIndex < 0) {
      nextIndex = remaining.findIndex((id) => !selected.includes(id));
    }
    const [nextId] = remaining.splice(nextIndex, 1);
    selected.push(nextId);
  }

  return { selected, remaining };
}

function getDinnerIdsForWeek(now = new Date()): { weekKey: string; dinnerIds: string[] } {
  const weekKey = getBeirutWeekKey(now);
  const saved = readRotationState();
  if (saved?.weekKey === weekKey) return { weekKey, dinnerIds: saved.currentDinnerIds };

  const allIds = DINNER_POOL.map((dinner) => dinner.id);
  const drawn = drawWeek(saved?.remainingDinnerIds ?? shuffle(allIds), saved?.currentDinnerIds);
  writeRotationState({
    version: POOL_VERSION,
    weekKey,
    currentDinnerIds: drawn.selected,
    remainingDinnerIds: drawn.remaining,
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

if (DINNER_POOL.length !== 50 || dinnerById.size !== DINNER_POOL.length) {
  throw new Error('Dinner pool must contain exactly 50 uniquely identified meals.');
}
