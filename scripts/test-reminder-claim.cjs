const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');

// Execute the production claim statement against an in-memory SQL database.
// SQLite and PostgreSQL share the NULL semantics exercised here.
const source = readFileSync(resolve(__dirname, '../artifacts/pregnancy-tracker/api/_lib/meal-reminders.ts'), 'utf8');
const sql = source.match(/const claim = await pool\.query\(`([^`]+)`/)[1];

for (const [name, date, time, expected] of [
  ['first delivery', null, null, 1],
  ['already sent at this time today', '2026-09-09', '12:00', 0],
  ['previous day', '2026-09-08', '12:00', 1],
  ['changed reminder time', '2026-09-09', '11:00', 1],
  ['missing date', null, '12:00', 1],
  ['missing time', '2026-09-09', null, 1],
]) {
  test(name, () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE meal_reminders (id TEXT PRIMARY KEY, last_sent_date TEXT, last_sent_time TEXT)');
      db.prepare('INSERT INTO meal_reminders VALUES (?, ?, ?)').run('meal', date, time);
      const claim = db.prepare(sql);
      const args = { '1': '2026-09-09', '2': '12:00', '3': 'meal' };
      assert.equal(claim.all(args).length, expected);
      assert.equal(claim.all(args).length, 0, 'a repeated claim must not send twice');
      db.exec('UPDATE meal_reminders SET last_sent_date = NULL, last_sent_time = NULL');
      assert.equal(claim.all(args).length, 1, 'failed delivery can be retried');
    } finally {
      db.close();
    }
  });
}
