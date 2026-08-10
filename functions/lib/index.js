"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMealNotifications = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
// Lebanon timezone (Asia/Beirut = UTC+2 standard / UTC+3 DST)
const TIMEZONE = 'Asia/Beirut';
function getCurrentDayOfWeek(tz) {
    const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
    }).format(new Date());
    return dayName.toLowerCase();
}
/**
 * Runs every 5 minutes (Beirut time).
 * Finds meals whose `time` falls within the current 5-minute window on today's weekday,
 * not already notified today, and sends an FCM push to the device in tokens/primary-user.
 */
exports.sendMealNotifications = (0, scheduler_1.onSchedule)({ schedule: 'every 5 minutes', timeZone: TIMEZONE }, async () => {
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
    const { token } = tokenDoc.data();
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
    const sends = [];
    const batch = db.batch();
    for (const mealDoc of mealsSnap.docs) {
        const meal = mealDoc.data();
        // Is this meal within the current 5-minute window?
        const [mealHour, mealMinute] = meal.time.split(':').map(Number);
        const mealTotalMinutes = mealHour * 60 + mealMinute;
        if (Math.abs(mealTotalMinutes - currentTotalMinutes) > 4)
            continue;
        // Already sent today?
        if (meal.lastNotifiedDate === todayStr) {
            console.log(`[scheduler] ${meal.name} already notified today — skipping.`);
            continue;
        }
        const body = (meal.foods ?? []).join(', ') || 'Time to eat!';
        console.log(`[scheduler] Sending for: ${meal.name} at ${meal.time}`);
        sends.push(messaging.send({
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
        }));
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
});
//# sourceMappingURL=index.js.map