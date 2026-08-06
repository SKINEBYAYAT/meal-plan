import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyD5whIIeNe6BlAX-l9e1y2m5x3NXlNHTrs",
  authDomain: "meal-plan-113f8.firebaseapp.com",
  projectId: "meal-plan-113f8",
  storageBucket: "meal-plan-113f8.firebasestorage.app",
  messagingSenderId: "471128219169",
  appId: "1:471128219169:web:4c6747730ff3d6f7c40d60",
};

// TODO: Replace with your VAPID key from Firebase Console →
//       Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = '';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Requests notification permission and returns the FCM registration token.
 * Returns null if permission is denied or an error occurs.
 */
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted:', permission);
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (token) {
      console.log('[FCM] Registration token:', token);
    } else {
      console.warn('[FCM] No token returned — VAPID key may be missing or SW not registered.');
    }

    return token;
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}
