import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD5whIIeNe6BlAX-l9e1y2m5x3NXlNHTrs",
  authDomain: "meal-plan-113f8.firebaseapp.com",
  projectId: "meal-plan-113f8",
  storageBucket: "meal-plan-113f8.firebasestorage.app",
  messagingSenderId: "471128219169",
  appId: "1:471128219169:web:4c6747730ff3d6f7c40d60",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const VAPID_KEY = "BAZFsFhWDAnDyY0nHU0Jkp1DaK112_DEesqjQ4B5fN8MFNp7vcWtqdU9Na3wSRzKdQW6RJLv-_L66kjhizTjfGc";

export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("FCM token:", token);
    return token;
  } catch (err) {
    console.error("Error getting notification permission/token:", err);
    return null;
  }
}

// Foreground message handler (when app is open/focused)
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}

export { messaging };
