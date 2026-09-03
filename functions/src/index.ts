import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();

const db = admin.firestore();
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





