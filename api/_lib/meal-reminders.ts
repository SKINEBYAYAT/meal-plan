import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const TIMEZONE = 'Asia/Beirut';
export const REMINDERS_COLLECTION = 'reminders';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type Reminder = {
  deviceId: string;
  token: string;
  mealId: string;
  weekday: DayOfWeek;
  time: string;
  title: string;
  foods: string[];
  icon?: string;
  enabled: boolean;
  lastSentDate?: string;
  lastSentTime?: string;
  processingKey?: string;
};

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Firebase Admin configuration is missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.');
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function currentBeirut(): { weekday: DayOfWeek; date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: values.weekday.toLowerCase() as DayOfWeek,
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour === '24' ? '00' : values.hour}:${values.minute}`,
  };
}

function isDue(reminder: Reminder, time: string): boolean {
  const [hour, minute] = reminder.time.split(':').map(Number);
  const [currentHour, currentMinute] = time.split(':').map(Number);
  return Math.abs(hour * 60 + minute - currentHour * 60 - currentMinute) <= 1;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function assertCronSecret(authorization: string | undefined): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || authorization !== `Bearer ${expected}`) throw new Error('Unauthorized');
}

export async function processDueReminders(): Promise<number> {
  const app = getAdminApp();
  const db = getFirestore(app);
  const messaging = getMessaging(app);
  const current = currentBeirut();
  const snapshot = await db.collection(REMINDERS_COLLECTION)
    .where('enabled', '==', true)
    .where('weekday', '==', current.weekday)
    .get();
  let processed = 0;

  for (const reminderDoc of snapshot.docs) {
    const reminder = reminderDoc.data() as Reminder;
    const device = await db.collection('devices').doc(reminder.deviceId).get();
    if (device.data()?.masterEnabled !== true || !isDue(reminder, current.time)) continue;

    const claimed = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(reminderDoc.ref);
      const latest = fresh.data() as Reminder | undefined;
      const processingKey = `${current.date}__${latest?.time}`;
      if (!fresh.exists || !latest?.enabled || latest.lastSentDate === current.date && latest.lastSentTime === latest.time || latest.processingKey === processingKey) return false;
      transaction.update(reminderDoc.ref, {
        processingKey,
        lastAttemptedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!claimed) continue;

    const title = `${reminder.icon ?? '🥘'} ${reminder.title}`;
    const body = ["Today's meal:", ...reminder.foods.map((food) => `• ${food}`)].join('\n');
    try {
      await messaging.send({
        token: reminder.token,
        data: { mealId: reminder.mealId, title, body },
        webpush: { fcmOptions: { link: `/meals?highlight=${encodeURIComponent(reminder.mealId)}` } },
      });
      await reminderDoc.ref.update({
        lastSentDate: current.date,
        lastSentTime: reminder.time,
        lastSentAt: FieldValue.serverTimestamp(),
        lastError: FieldValue.delete(),
        processingKey: FieldValue.delete(),
      });
      processed += 1;
    } catch (error) {
      const message = errorCode(error);
      await reminderDoc.ref.update({ lastError: message, processingKey: FieldValue.delete() });
      if (message.includes('registration-token-not-registered') || message.includes('invalid-registration-token')) {
        await reminderDoc.ref.delete();
      }
    }
  }
  return processed;
}

export async function sendTestPush(token: string): Promise<void> {
  const messaging = getMessaging(getAdminApp());
  await messaging.send({
    token,
    data: { mealId: 'test', title: 'Meal Plan Reminder', body: 'Your server push notifications are working.' },
    webpush: { fcmOptions: { link: '/meals' } },
  });
}

export function describeError(error: unknown): string {
  const message = errorCode(error);
  if (message.includes('registration-token-not-registered') || message.includes('invalid-registration-token')) return 'FCM token is invalid or expired. Enable reminders again to register a new token.';
  if (message.includes('Unauthorized')) return 'Unauthorized cron request.';
  return message;
}

export async function removeStaleToken(token: string): Promise<void> {
  const db = getFirestore(getAdminApp());
  const stale = await db.collection(REMINDERS_COLLECTION).where('token', '==', token).get();
  const batch = db.batch();
  stale.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}