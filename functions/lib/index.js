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
/**
 * Runs every 5 minutes.
 * Finds any meal whose time falls within the current 5-minute window (Beirut time),
 * has not already been notified today, and sends an FCM push notification to the
 * device token stored in tokens/primary-user.
 */
exports.sendMealNotifications = (0, scheduler_1.onSchedule)({ schedule: 'every 5 minutes', timeZone: TIMEZONE }, async () => {
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
    const { token } = tokenDoc.data();
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
    const sends = [];
    const batch = db.batch();
    for (const mealDoc of mealsSnap.docs) {
        const meal = mealDoc.data();
        // Parse meal time
        const [mealHour, mealMinute] = meal.time.split(':').map(Number);
        const mealTotalMinutes = mealHour * 60 + mealMinute;
        // Is this meal within the current 5-minute window?
        const diff = Math.abs(mealTotalMinutes - currentTotalMinutes);
        if (diff > 4)
            continue;
        // Already notified today?
        if (meal.lastNotifiedDate === todayStr) {
            console.log(`[scheduler] ${meal.name} already notified today — skipping.`);
            continue;
        }
        const body = (meal.foods ?? []).join(', ') || 'Time to eat!';
        console.log(`[scheduler] Sending notification for: ${meal.name} (${meal.time})`);
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
                fcmOptions: { link: `/meals?highlight=${encodeURIComponent(meal.id)}` },
            },
        }));
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
});
//# sourceMappingURL=index.js.map