import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Lebanon timezone (Asia/Beirut = UTC+2 standard / UTC+3 DST)
const TIMEZONE = 'Asia/Beirut';

/**
 * Runs every 5 minutes.
 * Finds any meal whose time falls within the current 5-minute window (Beirut time),
 * has not already been notified today, and sends an FCM push notification to the
 * device token stored in tokens/primary-user.
 */
export const sendMealNotifications = onSchedule(
  { schedule: 'every 5 minutes', timeZone: TIMEZONE },
  async () => {
    // ── 1. Current time in Beirut ──────────────────────────────────────────────
    const now = new Date();

    const beirutHHMM = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // 'en-CA' gives yyyy-MM-dd which matches the app's date keys
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
    }).format(now);

    const [currentHour, currentMinute] = beirutHHMM.split(':').map(Number);
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    console.log(`[scheduler] Running at ${beirutHHMM} Beirut (${todayStr})`);

    // ── 2. Fetch FCM token ─────────────────────────────────────────────────────
    const tokenDoc = await db.collection('tokens').doc('primary-user').get();
    if (!tokenDoc.exists) {
      console.log('[scheduler] No FCM token found — skipping.');
      return;
    }
    const { token } = tokenDoc.data() as { token: string };

    // ── 3. Query today's meals ─────────────────────────────────────────────────
    const mealsSnap = await db
      .collection('meals')
      .where('date', '==', todayStr)
      .get();

    if (mealsSnap.empty) {
      console.log(`[scheduler] No meals found for ${todayStr}`);
      return;
    }

    // ── 4. Check each meal ─────────────────────────────────────────────────────
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

      // Parse meal time
      const [mealHour, mealMinute] = meal.time.split(':').map(Number);
      const mealTotalMinutes = mealHour * 60 + mealMinute;

      // Is this meal within the current 5-minute window?
      const diff = Math.abs(mealTotalMinutes - currentTotalMinutes);
      if (diff > 4) continue;

      // Already notified today?
      if (meal.lastNotifiedDate === todayStr) {
        console.log(`[scheduler] ${meal.name} already notified today — skipping.`);
        continue;
      }

      const body = (meal.foods ?? []).join(', ') || 'Time to eat!';
      console.log(`[scheduler] Sending notification for: ${meal.name} (${meal.time})`);

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
            fcmOptions: { link: `/meals?highlight=${encodeURIComponent(meal.id)}` },
          },
        }),
      );

      batch.update(mealDoc.ref, {
        lastNotifiedDate: todayStr,
        notified: true,
      });
    }

    if (sends.length === 0) {
      console.log('[scheduler] No meals to notify at this time.');
      return;
    }

    await Promise.all(sends);
    await batch.commit();
    console.log(`[scheduler] Sent ${sends.length} notification(s).`);
  },
);
