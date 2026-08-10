/**
 * Seed 42 weekday recurring meals into Firestore via REST API.
 * Uses the Firebase Web API key (works when Firestore rules allow read/write).
 * Run: node scripts/seed-firestore.mjs
 */

const PROJECT_ID = 'meal-plan-113f8';
const API_KEY = 'AIzaSyD5whIIeNe6BlAX-l9e1y2m5x3NXlNHTrs';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'night_snack'];
const MEAL_NAMES = {
  breakfast: 'Breakfast',
  morning_snack: 'Morning Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon Snack',
  dinner: 'Dinner',
  night_snack: 'Evening Snack',
};

const SEED = {
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

// Convert a JS value to Firestore REST API field format
function toField(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toField) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = toField(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function buildDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toField(v);
  return { fields };
}

async function upsertDoc(docId, data) {
  const url = `${BASE}/meals/${docId}?key=${API_KEY}`;
  const body = buildDoc(data);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${docId} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function listExisting() {
  // List all docs in the meals collection
  const url = `${BASE}/meals?key=${API_KEY}&pageSize=200`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LIST failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const docs = json.documents ?? [];
  return new Set(docs.map(d => d.name.split('/').pop()));
}

async function main() {
  console.log('🔍 Fetching existing meals from Firestore...');
  let existing;
  try {
    existing = await listExisting();
    console.log(`  Found ${existing.size} existing docs: ${[...existing].join(', ')}`);
  } catch (err) {
    console.error('  ❌ Could not list existing docs:', err.message);
    console.log('  Proceeding to write all 42 docs anyway (idempotent PATCH)...');
    existing = new Set();
  }

  let written = 0;
  let skipped = 0;
  const errors = [];

  for (const day of DAYS) {
    for (const type of MEAL_TYPES) {
      const id = `${day}-${type}`;
      if (existing.has(id)) {
        console.log(`  ✓ ${id} already exists — skipping`);
        skipped++;
        continue;
      }
      const slot = SEED[day][type];
      const data = {
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
      try {
        await upsertDoc(id, data);
        console.log(`  ✅ Wrote ${id}`);
        written++;
      } catch (err) {
        console.error(`  ❌ Failed ${id}: ${err.message}`);
        errors.push(id);
      }
    }
  }

  console.log(`\n📊 Summary: ${written} written, ${skipped} skipped, ${errors.length} errors`);
  if (errors.length > 0) {
    console.error('  Failed docs:', errors);
    process.exit(1);
  }

  // Verify by listing again
  console.log('\n🔍 Verifying — re-listing Firestore meals collection...');
  try {
    const after = await listExisting();
    const seedIds = [];
    for (const day of DAYS) for (const type of MEAL_TYPES) seedIds.push(`${day}-${type}`);
    const missing = seedIds.filter(id => !after.has(id));
    if (missing.length === 0) {
      console.log(`✅ All 42 seed docs confirmed in Firestore!`);
      for (const day of DAYS) {
        const dayDocs = seedIds.filter(id => id.startsWith(day) && after.has(id));
        console.log(`  ${day}: ${dayDocs.length}/6 meals`);
      }
    } else {
      console.error('❌ Still missing:', missing);
      process.exit(1);
    }
  } catch (err) {
    console.error('Could not verify:', err.message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
