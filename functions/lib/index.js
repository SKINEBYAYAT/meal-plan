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
exports.setMasterReminder = exports.removeMealReminder = exports.syncMealReminder = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const db = admin.firestore();
const REMINDERS_COLLECTION = 'reminders';
function requireString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new https_1.HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim();
}
function reminderFromData(data) {
    const weekday = requireString(data.weekday, 'weekday');
    const time = requireString(data.time, 'time');
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw new https_1.HttpsError('invalid-argument', 'time must be HH:mm.');
    }
    if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(weekday)) {
        throw new https_1.HttpsError('invalid-argument', 'weekday is invalid.');
    }
    if (!Array.isArray(data.foods) || !data.foods.every((food) => typeof food === 'string')) {
        throw new https_1.HttpsError('invalid-argument', 'foods must be an array of strings.');
    }
    return {
        deviceId: requireString(data.deviceId, 'deviceId'),
        token: requireString(data.token, 'token'),
        mealId: requireString(data.mealId, 'mealId'),
        weekday,
        time,
        title: requireString(data.title, 'title'),
        foods: data.foods,
        icon: typeof data.icon === 'string' && data.icon ? data.icon : '🥘',
        enabled: data.enabled === true,
    };
}
function reminderId(deviceId, mealId) {
    return `${deviceId}__${mealId}`;
}
exports.syncMealReminder = (0, https_1.onCall)(async (request) => {
    const data = reminderFromData(request.data);
    const id = reminderId(data.deviceId, data.mealId);
    await db.collection(REMINDERS_COLLECTION).doc(id).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
exports.removeMealReminder = (0, https_1.onCall)(async (request) => {
    const deviceId = requireString(request.data?.deviceId, 'deviceId');
    const mealId = requireString(request.data?.mealId, 'mealId');
    await db.collection(REMINDERS_COLLECTION).doc(reminderId(deviceId, mealId)).delete();
    return { ok: true };
});
exports.setMasterReminder = (0, https_1.onCall)(async (request) => {
    const deviceId = requireString(request.data?.deviceId, 'deviceId');
    await db.collection('devices').doc(deviceId).set({
        masterEnabled: request.data?.enabled === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
//# sourceMappingURL=index.js.map