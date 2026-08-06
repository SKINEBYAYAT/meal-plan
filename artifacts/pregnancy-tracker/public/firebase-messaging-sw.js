importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD5whIIeNe6BlAX-l9e1y2m5x3NXlNHTrs",
  authDomain: "meal-plan-113f8.firebaseapp.com",
  projectId: "meal-plan-113f8",
  storageBucket: "meal-plan-113f8.firebasestorage.app",
  messagingSenderId: "471128219169",
  appId: "1:471128219169:web:4c6747730ff3d6f7c40d60",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message:", payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Meal Plan Reminder", {
    body: body || "",
    icon: "/icon-192.png",
  });
});
