import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD5whIIeNe6BlAX-l9e1y2m5x3NXlNHTrs",
  authDomain: "meal-plan-113f8.firebaseapp.com",
  projectId: "meal-plan-113f8",
  storageBucket: "meal-plan-113f8.firebasestorage.app",
  messagingSenderId: "471128219169",
  appId: "1:471128219169:web:4c6747730ff3d6f7c40d60",
};

const VAPID_KEY = 'BAZFsFhWDAnDyY0nHU0Jkp1DaK112_DEesqjQ4B5fN8MFNp7vcWtqdU9Na3wSRzKdQW6RJLv-_L66kjhizTjfGc';

const app = initializeApp(firebaseConfig);

// Firestore is always available — init eagerly.
export const db = getFirestore(app);

// Messaging is only available in browsers that support Service Workers + Push.
// We lazy-load it so a crash here never blocks db or the rest of the app.
let _messagingReady: Promise<import('firebase/messaging').Messaging | null> | null = null;

function getMessagingLazy(): Promise<import('firebase/messaging').Messaging | null> {
  if (_messagingReady) return _messagingReady;
  _messagingReady = (async () => {
    try {
      const { getMessaging, isSupported } = await import('firebase/messaging');
      if (!(await isSupported())) return null;
      return getMessaging(app);
    } catch {
      return null;
    }
  })();
  return _messagingReady;
}

/**
 * Requests notification permission and returns the FCM registration token.
 * Returns null if permission is denied, browser unsupported, or an error occurs.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted:', permission);
      return null;
    }

    const messaging = await getMessagingLazy();
    if (!messaging) {
      console.warn('[FCM] Messaging not supported in this browser.');
      return null;
    }

    const { getToken } = await import('firebase/messaging');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
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
