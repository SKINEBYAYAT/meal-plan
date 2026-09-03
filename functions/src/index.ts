import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();
const TIMEZONE = 'Asia/Beirut';
const REMINDERS_COLLECTION = 'reminders';

type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

type ReminderData = {
  deviceId: string;
  token: string;
  mealId: string;
  weekday: DayOfWeek;
  time: string;
  title: string;
  foods: string[];
  icon: string;
  enabled: boolean;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  return value.trim();
}

function reminderFromData(data: Record<string, unknown>): ReminderData {
  const weekday = requireString(data.weekday, 'weekday') as DayOfWeek;
  const time = requireString(data.time, 'time');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new HttpsError('invalid-argument', 'time must be HH:mm.');
  }
  if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(weekday)) {
    throw new HttpsError('invalid-argument', 'weekday is invalid.');
  }
  if (!Array.isArray(data.foods) || !data.foods.every((food) => typeof food === 'string')) {
    throw new HttpsError('invalid-argument', 'foods must be an array of strings.');
  }
  return {
    deviceId: requireString(data.deviceId, 'deviceId'),
    token: requireString(data.token, 'token'),
    mealId: requireString(data.mealId, 'mealId'),
    weekday,
    time,
    title: requireString(data.title, 'title'),
    foods: data.foods as string[],
    icon: typeof data.icon === 'string' && data.icon ? data.icon : '🥘',
    enabled: data.enabled === true,
  };
}

function reminderId(deviceId: string, mealId: string): string {
  return `${deviceId}__${mealId}`;
}

export const syncMealReminder = onCall(async (request) => {
  const data = reminderFromData(request.data as Record<string, unknown>);
  const id = reminderId(data.deviceId, data.mealId);
  await db.collection(REMINDERS_COLLECTION).doc(id).set({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const removeMealReminder = onCall(async (request) => {
  const deviceId = requireString(request.data?.deviceId, 'deviceId');
  const mealId = requireString(request.data?.mealId, 'mealId');
  await db.collection(REMINDERS_COLLECTION).doc(reminderId(deviceId, mealId)).delete();
  return { ok: true };
});

export const setMasterReminder = onCall(async (request) => {
  const deviceId = requireString(request.data?.deviceId, 'deviceId');
  await db.collection('devices').doc(deviceId).set({
    masterEnabled: request.data?.enabled === true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const sendTestNotification = onCall(async (request) => {
  const token = requireString(request.data?.token, 'token');
  try {
    await messaging.send({
      token,
      data: {
        mealId: 'test',
        title: 'Meal Plan Reminder',
        body: 'Your server push notifications are working.',
      },
      webpush: { fcmOptions: { link: '/meals' } },
    });
    return { ok: true };
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      const deviceId = requireString(request.data?.deviceId, 'deviceId');
      const stale = await db.collection(REMINDERS_COLLECTION).where('deviceId', '==', deviceId).get();
      const batch = db.batch();
      stale.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    throw new HttpsError('internal', `FCM test delivery failed: ${code}`);
  }
});

function getBeirutNow(): { weekday: DayOfWeek; date: string; time: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: values.weekday.toLowerCase() as DayOfWeek,
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour === '24' ? '00' : values.hour}:${values.minute}`,
  };
}

function isDue(reminder: ReminderData, currentTime: string): boolean {
  const [hour, minute] = reminder.time.split(':').map(Number);
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  return Math.abs((hour * 60 + minute) - (currentHour * 60 + currentMinute)) <= 4;
}

async function processDueReminders(): Promise<number> {
    const current = getBeirutNow();
    const snapshot = await db.collection(REMINDERS_COLLECTION)
      .where('enabled', '==', true)
      .where('weekday', '==', current.weekday)
      .get();

    let sent = 0;
    for (const reminderDoc of snapshot.docs) {
      const reminder = reminderDoc.data() as ReminderData & {
        lastSentDate?: string;
        lastSentTime?: string;
      };
      const device = await db.collection('devices').doc(reminder.deviceId).get();
      if (device.data()?.masterEnabled !== true) continue;
      if (!isDue(reminder, current.time)) continue;
      if (reminder.lastSentDate === current.date && reminder.lastSentTime === reminder.time) continue;

      const claim = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(reminderDoc.ref);
        const latest = fresh.data() as typeof reminder | undefined;
        if (!fresh.exists || !latest?.enabled ||
            (latest.lastSentDate === current.date && latest.lastSentTime === latest.time)) {
          return false;
        }
        transaction.update(reminderDoc.ref, {
          lastSentDate: current.date,
          lastSentTime: latest.time,
          lastAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!claim) continue;

      const body = ['Today\'s meal:', ...reminder.foods.map((food) => `• ${food}`)].join('\n');
      try {
        await messaging.send({
          token: reminder.token,
          data: {
            mealId: reminder.mealId,
            title: `${reminder.icon} ${reminder.title}`,
            body,
          },
          webpush: {
            fcmOptions: { link: `/meals?highlight=${encodeURIComponent(reminder.mealId)}` },
          },
        });
        await reminderDoc.ref.update({ lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
        sent += 1;
      } catch (error) {
        console.error(`[scheduler] Failed to send ${reminderDoc.id}`, error);
        await reminderDoc.ref.update({ lastError: String(error) });
      }
    }
    return sent;
}

export const mealRemindersCron = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'POST required' });
    return;
  }
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  if (!expected || authorization !== `Bearer ${expected}`) {
    response.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  try {
    const sent = await processDueReminders();
    response.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error('[cron] Reminder processing failed', error);
    response.status(500).json({ ok: false, error: 'Reminder processing failed' });
  }
});
