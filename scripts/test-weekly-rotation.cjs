const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual meal modules with a controlled clock and persistent browser storage.
const sourceRoot = path.resolve(__dirname, '../artifacts/pregnancy-tracker/src');
const storage = new Map();
let now = '2026-09-13T20:59:59Z'; // Sunday 23:59:59 in Beirut.
const planKey = 'pregnancy-meal-plan';
const weekKey = `${planKey}-week`;
const completionKey = 'pregnancy-meal-completions';
const preferenceKey = 'pregnancy-weekly-reminder-preferences-v1';
const read = key => JSON.parse(storage.get(key));
const plain = value => JSON.parse(JSON.stringify(value));

function openApp() {
  const modules = new Map();
  const states = [];
  const dependencies = [];
  const cleanups = [];
  const effects = [];
  let cursor = 0;
  const window = new EventTarget();
  const document = new EventTarget();
  const timers = new Set();
  window.setInterval = callback => { timers.add(callback); return callback; };
  window.clearInterval = callback => timers.delete(callback);
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        dependencies[index] = deps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); });
      }
    },
    useCallback(callback) { return callback; },
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  const context = vm.createContext({
    console, Date: Clock, Intl, Event, window, document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
  });
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const source = fs.readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireModule = name => name === 'react' ? react : load(path.resolve(path.dirname(file), `${name}.ts`));
    vm.runInContext(`(function(require, module, exports) { ${compiled}\n})`, context, { filename: file })(requireModule, module, module.exports);
    return module.exports;
  }
  const api = load(path.join(sourceRoot, 'hooks/useMeals.ts'));
  const pool = load(path.join(sourceRoot, 'data/dinnerPool.ts'));
  return {
    api, pool,
    render(day = 'sunday') {
      cursor = 0;
      const value = api.useMeals(day);
      effects.splice(0).forEach(run => run());
      return value;
    },
    refresh() { window.dispatchEvent(new Event('focus')); },
    close() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

let app = openApp();
assert.equal(app.pool.DINNER_POOL.length, 50);
assert.equal(app.pool.getBeirutWeekKey(), '2026-09-07');
let hook = app.render();
hook.toggleMealCompleted('sunday-dinner', true);
assert.equal(app.render().dayPlan.meals.find(meal => meal.id === 'sunday-dinner').completed, true);
const sunday = plain(app.api.getAllMealsByDay());
assert.equal(read(weekKey), '2026-09-07');

// Preserve both legacy per-meal choices and separately stored reminder preferences.
const saved = read(planKey);
for (const meal of Object.values(saved)) {
  meal.reminderEnabled = meal.type !== 'dinner';
  meal.time = meal.type === 'dinner' ? '20:15' : meal.time;
}
saved['monday-breakfast'].name = 'Previous week generated name';
saved['monday-breakfast'].foods = ['Previous week generated foods'];
storage.set(planKey, JSON.stringify(saved));
storage.set(preferenceKey, JSON.stringify({ dinner: { enabled: false, time: '20:15' }, breakfast: { enabled: true, time: '07:30' } }));
storage.set('pregnancy_tracker_settings', JSON.stringify({ notificationsEnabled: false }));
const settingsBefore = storage.get('pregnancy_tracker_settings');
const preferencesBefore = storage.get(preferenceKey);
const sundayStorage = new Map(storage);

now = '2026-09-13T21:00:00Z'; // Monday in Beirut, still Sunday in UTC.
app.refresh();
assert.ok(app.render().dayPlan.meals.every(meal => !meal.completed));
const monday = plain(app.api.getAllMealsByDay());
assert.equal(read(weekKey), '2026-09-14');
assert.notDeepEqual(monday, sunday);
assert.notEqual(monday.monday[0].name, 'Previous week generated name');
for (const meal of Object.values(monday).flat()) {
  assert.deepEqual(read(planKey)[meal.id], meal);
  assert.equal(meal.reminderEnabled, meal.type !== 'dinner');
  if (meal.type === 'dinner') assert.equal(meal.time, '20:15');
}
hook = app.render('monday');
hook.toggleMealCompleted('monday-dinner', true);
assert.ok(read(completionKey)['2026-09-14'].includes('monday-dinner'));
const mondayStorage = new Map(storage);
const dinnerIds = meals => Object.values(meals).flat().filter(meal => meal.type === 'dinner').map(meal => meal.name);
assert.ok(dinnerIds(monday).every(name => !dinnerIds(sunday).includes(name)));
app.close();
console.log('PASS: Sunday to Beirut Monday rotates, saves the new plan, and clears visible checkmarks.');

// Simulate not opening at all on Monday, starting from Sunday's saved state.
const tuesdayTime = '2026-09-15T09:00:00Z';
now = tuesdayTime;
storage.clear();
for (const [key, value] of sundayStorage) storage.set(key, value);
app = openApp();
const tuesday = plain(app.api.getAllMealsByDay());
assert.equal(read(weekKey), '2026-09-14');
assert.ok(dinnerIds(tuesday).every(name => !dinnerIds(sunday).includes(name)));
assert.notEqual(tuesday.monday[0].name, 'Previous week generated name');
app.close();
console.log('PASS: Opening Tuesday uses the current Monday key and cannot restore the old saved plan.');

storage.clear();
for (const [key, value] of mondayStorage) storage.set(key, value);
for (let reload = 0; reload < 5; reload++) {
  app = openApp();
  assert.deepEqual(plain(app.api.getAllMealsByDay()), monday);
  app.close();
}
console.log('PASS: Five full module reloads retain identical meals during the same week.');

now = '2026-09-20T21:00:00Z';
app = openApp();
const nextMonday = plain(app.api.getAllMealsByDay());
assert.equal(read(weekKey), '2026-09-21');
assert.ok(dinnerIds(nextMonday).every(name => !dinnerIds(monday).includes(name)));
assert.ok(app.render('monday').dayPlan.meals.every(meal => !meal.completed));
assert.equal(storage.get(preferenceKey), preferencesBefore);
assert.equal(storage.get('pregnancy_tracker_settings'), settingsBefore);
for (const meal of Object.values(nextMonday).flat()) {
  assert.equal(meal.reminderEnabled, meal.type !== 'dinner');
  if (meal.type === 'dinner') assert.equal(meal.time, '20:15');
}
app.close();
console.log('PASS: Next Monday rotates again; reminder ON/OFF settings and times survive.');

// Exercise a full pool cycle: all 50 entries must be consumed before reuse.
storage.clear();
app = openApp();
const seen = [];
let previous = [];
for (let week = 0; week < 10; week++) {
  const date = new Date(Date.UTC(2026, 8, 7 + week * 7, 12));
  const ids = Object.values(app.pool.getCurrentWeeklyDinners(date)).map(meal => meal.id);
  assert.equal(new Set(ids).size, 7);
  assert.ok(ids.every(id => !previous.includes(id)));
  seen.push(...ids);
  previous = ids;
}
assert.equal(new Set(seen.slice(0, 50)).size, 50);
assert.equal(app.pool.getBeirutWeekKey(new Date('2026-01-04T22:00:00Z')), '2026-01-05');
assert.equal(app.pool.getBeirutWeekKey(new Date('2026-10-25T22:00:00Z')), '2026-10-26');
console.log('PASS: Pool exhaustion avoids unnecessary repeats; winter and DST week keys are correct.');
