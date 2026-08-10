import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Lebanon timezone (Asia/Beirut = UTC+2 standard / UTC+3 DST)
const TIMEZONE = 'Asia/Beirut';

type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

function getCurrentDayOfWeek(tz: string): DayOfWeek {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
  }).format(new Date());
  return dayName.toLowerCase() as DayOfWeek;
}

/**
 * Runs every 5 minutes (Beirut time).
 * Finds meals whose `time` falls within the current 5-minute window on today's weekday,
 * not already notified today, and sends an FCM push to the device in tokens/primary-user.
 */
export const sendMealNotifications = onSchedule(
  { schedule: 'every 5 minutes', timeZone: TIMEZONE },
  async () => {
    // ── Current Beirut time ────────────────────────────────────────────────────
    const now = new Date();

    const beirutHHMM = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // yyyy-MM-dd in Beirut — used for lastNotifiedDate deduplication
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
    }).format(now);

    const currentDow = getCurrentDayOfWeek(TIMEZONE);
    const [currentHour, currentMinute] = beirutHHMM.split(':').map(Number);
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    console.log(`[scheduler] ${beirutHHMM} Beirut | day: ${currentDow} | date: ${todayStr}`);

    // ── FCM token ──────────────────────────────────────────────────────────────
    const tokenDoc = await db.collection('tokens').doc('primary-user').get();
    if (!tokenDoc.exists) {
      console.log('[scheduler] No FCM token — skipping.');
      return;
    }
    const { token } = tokenDoc.data() as { token: string };

    // ── Today's weekday meal templates ─────────────────────────────────────────
    const mealsSnap = await db
      .collection('meals')
      .where('day', '==', currentDow)
      .where('reminderEnabled', '==', true)
      .get();

    if (mealsSnap.empty) {
      console.log(`[scheduler] No reminder-enabled meals for ${currentDow}`);
      return;
    }

    const sends: Promise<string>[] = [];
    const batch = db.batch();

    for (const mealDoc of mealsSnap.docs) {
      const meal = mealDoc.data() as {
        id: string;
        name: string;
        time: string;
        foods?: string[];
        lastNotifiedDate?: string | null;
      };

      // Is this meal within the current 5-minute window?
      const [mealHour, mealMinute] = meal.time.split(':').map(Number);
      const mealTotalMinutes = mealHour * 60 + mealMinute;
      if (Math.abs(mealTotalMinutes - currentTotalMinutes) > 4) continue;

      // Already sent today?
      if (meal.lastNotifiedDate === todayStr) {
        console.log(`[scheduler] ${meal.name} already notified today — skipping.`);
        continue;
      }

      const body = (meal.foods ?? []).join(', ') || 'Time to eat!';
      console.log(`[scheduler] Sending for: ${meal.name} at ${meal.time}`);

      sends.push(
        messaging.send({
          token,
          notification: { title: meal.name, body },
          data: { mealId: meal.id },
          webpush: {
            notification: {
              title: meal.name,
              body,
              icon: '/apple-touch-icon.png',
            },
            fcmOptions: {
              link: `/meals?highlight=${encodeURIComponent(meal.id)}`,
            },
          },
        }),
      );

      batch.update(mealDoc.ref, {
        lastNotifiedDate: todayStr,
      });
    }

    if (sends.length === 0) {
      console.log('[scheduler] No meals in this window.');
      return;
    }

    await Promise.all(sends);
    await batch.commit();
    console.log(`[scheduler] Sent ${sends.length} notification(s).`);
  },
);
