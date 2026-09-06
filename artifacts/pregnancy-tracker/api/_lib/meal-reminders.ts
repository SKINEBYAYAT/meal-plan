import { Pool } from 'pg';
import webpush from 'web-push';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
type Reminder = {
  id: string; device_id: string; meal_id: string; weekday: DayOfWeek; time: string;
  title: string; foods: string; icon: string; enabled: boolean;
  last_sent_date: string | null; last_sent_time: string | null;
  endpoint: string; p256dh: string; auth: string;
};

function normalizeDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let url = value.trim().replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  const wrapper = url[0];
  if ((wrapper === '"' || wrapper === "'" || wrapper === '`') && url.at(-1) === wrapper) {
    url = url.slice(1, -1).trim();
  }
  if (/\[YOUR-PASSWORD\]/i.test(url)) throw new Error('DATABASE_URL still contains the [YOUR-PASSWORD] placeholder.');

  const schemeEnd = url.indexOf('://');
  const credentialsEnd = url.lastIndexOf('@');
  if (schemeEnd < 0 || credentialsEnd < schemeEnd) return url;

  const scheme = url.slice(0, schemeEnd);
  const credentials = url.slice(schemeEnd + 3, credentialsEnd);
  const passwordStart = credentials.indexOf(':');
  if (passwordStart < 0) return url;

  const username = credentials.slice(0, passwordStart);
  const password = credentials.slice(passwordStart + 1);
  let decodedPassword = password;
  try {
    decodedPassword = decodeURIComponent(password);
  } catch {
    // Treat malformed percent escapes as literal password characters.
  }

  return `${scheme}://${username}:${encodeURIComponent(decodedPassword)}@${url.slice(credentialsEnd + 1)}`;
}

const pool = new Pool({ connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL), max: 1 });
let tablesReady: Promise<void> | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function ensureTables(): Promise<void> {
  if (!tablesReady) tablesReady = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS push_devices (
      device_id text PRIMARY KEY, endpoint text NOT NULL UNIQUE, p256dh text NOT NULL,
      auth text NOT NULL, master_enabled boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS meal_reminders (
      id text PRIMARY KEY, device_id text NOT NULL REFERENCES push_devices(device_id) ON DELETE CASCADE,
      meal_id text NOT NULL, weekday text NOT NULL, time text NOT NULL, title text NOT NULL,
      foods text NOT NULL, icon text NOT NULL DEFAULT '🥘', enabled boolean NOT NULL DEFAULT false,
      last_sent_date text, last_sent_time text, updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(device_id, meal_id)
    )`);
  })();
  await tablesReady;
}

function configurePush(): void {
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
}

export function assertCronSecret(authorization: string | undefined): void {
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new Error('Unauthorized');
}

export function describeError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]');
  if (message === 'Unauthorized') return 'Unauthorized cron request.';
  if (message.includes('410') || message.includes('404')) return 'Push subscription is expired or no longer registered.';
  return message;
}

export async function syncReminder(input: {
  deviceId: string; subscription: Subscription; mealId: string; weekday: DayOfWeek; time: string;
  title: string; foods: string[]; icon?: string; enabled: boolean;
}): Promise<void> {
  await ensureTables();
  await pool.query(`INSERT INTO push_devices (device_id, endpoint, p256dh, auth, updated_at)
    VALUES ($1, $2, $3, $4, now()) ON CONFLICT (device_id) DO UPDATE SET
    endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = now()`,
    [input.deviceId, input.subscription.endpoint, input.subscription.keys.p256dh, input.subscription.keys.auth]);
  await pool.query(`INSERT INTO meal_reminders
    (id, device_id, meal_id, weekday, time, title, foods, icon, enabled, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) ON CONFLICT (id) DO UPDATE SET
    weekday = EXCLUDED.weekday, time = EXCLUDED.time, title = EXCLUDED.title, foods = EXCLUDED.foods,
    icon = EXCLUDED.icon, enabled = EXCLUDED.enabled, updated_at = now()`,
    [`${input.deviceId}__${input.mealId}`, input.deviceId, input.mealId, input.weekday, input.time,
      input.title, JSON.stringify(input.foods), input.icon ?? '🥘', input.enabled]);
}

export async function removeReminder(deviceId: string, mealId: string): Promise<void> {
  await ensureTables();
  await pool.query('DELETE FROM meal_reminders WHERE device_id = $1 AND meal_id = $2', [deviceId, mealId]);
}

export async function setMaster(deviceId: string, subscription: Subscription, enabled: boolean): Promise<void> {
  await ensureTables();
  await pool.query(`INSERT INTO push_devices (device_id, endpoint, p256dh, auth, master_enabled, updated_at)
    VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (device_id) DO UPDATE SET
    endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
    master_enabled = EXCLUDED.master_enabled, updated_at = now()`,
    [deviceId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, enabled]);
}

function currentBeirut(): { weekday: DayOfWeek; date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Beirut', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { weekday: values.weekday.toLowerCase() as DayOfWeek, date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour === '24' ? '00' : values.hour}:${values.minute}` };
}

function due(reminder: Reminder, now: string): boolean {
  const [h, m] = reminder.time.split(':').map(Number);
  const [nh, nm] = now.split(':').map(Number);
  return Math.abs(h * 60 + m - nh * 60 - nm) <= 1;
}

export async function setupAllReminders(deviceId: string, subscription: Subscription, meals: Array<{
  id: string; weekday: DayOfWeek; time: string; title: string; foods: string[]; icon?: string;
}>): Promise<void> {
  await ensureTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO push_devices (device_id, endpoint, p256dh, auth, master_enabled, updated_at)
      VALUES ($1, $2, $3, $4, true, now()) ON CONFLICT (device_id) DO UPDATE SET
      endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
      master_enabled = true, updated_at = now()`,
      [deviceId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
    for (const meal of meals) {
      await client.query(`INSERT INTO meal_reminders
        (id, device_id, meal_id, weekday, time, title, foods, icon, enabled, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now()) ON CONFLICT (id) DO UPDATE SET
        weekday = EXCLUDED.weekday, time = EXCLUDED.time, title = EXCLUDED.title,
        foods = EXCLUDED.foods, icon = EXCLUDED.icon, enabled = true, updated_at = now()`,
        [`${deviceId}__${meal.id}`, deviceId, meal.id, meal.weekday, meal.time,
          meal.title, JSON.stringify(meal.foods), meal.icon ?? '🥘']);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function parseFoods(value: string): string[] {
  try {
    const foods: unknown = JSON.parse(value);
    return Array.isArray(foods) && foods.every((food) => typeof food === 'string') ? foods : [];
  } catch {
    return [];
  }
}

export async function processDueReminders(): Promise<number> {
  await ensureTables();
  configurePush();
  const current = currentBeirut();
  const { rows } = await pool.query<Reminder>(`SELECT r.*, d.endpoint, d.p256dh, d.auth
    FROM meal_reminders r JOIN push_devices d ON d.device_id = r.device_id
    WHERE r.enabled = true AND d.master_enabled = true AND r.weekday = $1`, [current.weekday]);
  let processed = 0;
  for (const reminder of rows) {
    if (!due(reminder, current.time) || (reminder.last_sent_date === current.date && reminder.last_sent_time === reminder.time)) continue;
    const claim = await pool.query(`UPDATE meal_reminders SET last_sent_date = $1, last_sent_time = $2
      WHERE id = $3 AND NOT (last_sent_date = $1 AND last_sent_time = $2) RETURNING id`, [current.date, reminder.time, reminder.id]);
    if (!claim.rowCount) continue;
    const body = ["Today's meal:", ...parseFoods(reminder.foods).map((food) => `• ${food}`)].join('\n');
    try {
      await webpush.sendNotification({ endpoint: reminder.endpoint, keys: { p256dh: reminder.p256dh, auth: reminder.auth } }, JSON.stringify({
        title: `${reminder.icon} ${reminder.title}`, body, mealId: reminder.meal_id,
      }));
      await pool.query('UPDATE meal_reminders SET updated_at = now() WHERE id = $1', [reminder.id]);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('410') || message.includes('404')) await pool.query('DELETE FROM push_devices WHERE device_id = $1', [reminder.device_id]);
      else await pool.query('UPDATE meal_reminders SET last_sent_date = NULL, last_sent_time = NULL WHERE id = $1', [reminder.id]);
    }
  }
  return processed;
}

export async function sendTestPush(subscription: Subscription): Promise<void> {
  configurePush();
  await webpush.sendNotification(subscription, JSON.stringify({ title: 'Meal Plan Reminder', body: 'Your standard Web Push notifications are working.', mealId: 'test' }));
}

export async function removeStaleSubscription(endpoint: string): Promise<void> {
  await ensureTables();
  await pool.query('DELETE FROM push_devices WHERE endpoint = $1', [endpoint]);
}
