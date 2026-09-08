import { DayOfWeek, Meal } from './types';

type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushDiagnostic = {
  pwaInstalled: boolean;
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorker: 'active' | 'inactive';
  subscription: 'registered' | 'missing';
  backendDevice: 'registered' | 'missing';
  masterEnabled: boolean;
  reminderCount: number;
  enabledReminderCount: number;
};

const DEVICE_ID_KEY = 'pregnancy-tracker-device-id';

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, value);
  return value;
}

function subscriptionJson(subscription: PushSubscription): PushSubscriptionJSON {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Push subscription is incomplete.');
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export function isStandalonePwa(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function decodeKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0)).buffer;
}

async function vapidPublicKey(): Promise<ArrayBuffer> {
  const response = await fetch('/api/notifications/config', { cache: 'no-store' });
  const result = await response.json() as { publicKey?: string; error?: string };
  if (!response.ok || !result.publicKey) throw new Error(result.error ?? 'VAPID public key is unavailable.');
  return decodeKey(result.publicKey);
}

function keysMatch(left: ArrayBuffer | null, right: ArrayBuffer): boolean {
  if (!left) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const ready = await navigator.serviceWorker.ready;
  if (!ready.active) throw new Error('Service worker inactive');
  return ready;
}

async function getSubscription(): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Standard Web Push is not supported.');
  const registration = await ensureServiceWorker();
  const applicationServerKey = await vapidPublicKey();
  const existing = await registration.pushManager.getSubscription();
  if (existing && keysMatch(existing.options.applicationServerKey, applicationServerKey)) return existing;
  if (existing) {
    console.warn('[push] VAPID public key mismatch; replacing subscription');
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
}

async function sync(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/notifications/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json() as { success?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || !result.success) throw new Error(result.error ?? `Push sync failed (${response.status}).`);
  return result;
}

export async function requestPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!('Notification' in window)) throw new Error('Notifications are not supported by this browser.');
  if (isIos() && !isStandalonePwa()) throw new Error('Install this app to your Home Screen first to enable notifications.');
  if (await Notification.requestPermission() !== 'granted') return null;
  return subscriptionJson(await getSubscription());
}

export function getStoredPushSubscription(): PushSubscriptionJSON | null {
  return null;
}

export async function syncMealReminder(meal: Meal): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'sync', deviceId: deviceId(), subscription, mealId: meal.id,
    weekday: meal.day as DayOfWeek, time: meal.time, title: meal.name, foods: meal.foods,
    icon: meal.icon ?? '🥘', enabled: meal.reminderEnabled });
}

export async function removeMealReminder(mealId: string): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'remove', deviceId: deviceId(), subscription, mealId });
}

export async function setMasterReminder(enabled: boolean): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'master', deviceId: deviceId(), subscription, enabled });
}

export async function setupAllMealReminders(meals: Meal[]): Promise<void> {
  if (isIos() && !isStandalonePwa()) throw new Error('Install this app to your Home Screen first to enable notifications.');
  if (!('Notification' in window) || Notification.permission !== 'granted') throw new Error('Notification permission is not granted.');
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'setup-all', deviceId: deviceId(), subscription,
    meals: meals.map((meal) => ({ id: meal.id, weekday: meal.day as DayOfWeek, time: meal.time,
      title: meal.name, foods: meal.foods, icon: meal.icon ?? '🥘', enabled: meal.reminderEnabled === true })) });
}

export async function sendRemoteTestNotification(): Promise<{ success: true; sent: true; statusCode: number }> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'register', deviceId: deviceId(), subscription });
  const response = await fetch('/api/notifications/test', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: deviceId(), subscription }),
  });
  const result = await response.json() as { success?: boolean; sent?: boolean; statusCode?: number; error?: string };
  if (!response.ok || !result.success || !result.sent) throw new Error(result.error ?? `Test notification failed (${response.status}).`);
  return { success: true, sent: true, statusCode: result.statusCode ?? response.status };
}

export async function getPushDiagnostic(): Promise<PushDiagnostic> {
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const base: PushDiagnostic = {
    pwaInstalled: isStandalonePwa(), supported,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    serviceWorker: 'inactive', subscription: 'missing', backendDevice: 'missing',
    masterEnabled: false, reminderCount: 0, enabledReminderCount: 0,
  };
  if (!supported) return base;
  const registration = await navigator.serviceWorker.getRegistration('/');
  base.serviceWorker = registration?.active ? 'active' : 'inactive';
  if (!registration?.active) return base;
  const current = await registration.pushManager.getSubscription();
  if (!current) return base;
  base.subscription = 'registered';
  const subscription = subscriptionJson(current);
  const result = await sync({ action: 'status', deviceId: deviceId(), subscription }) as {
    registered?: boolean; masterEnabled?: boolean; reminderCount?: number; enabledReminderCount?: number;
  };
  base.backendDevice = result.registered ? 'registered' : 'missing';
  base.masterEnabled = result.masterEnabled === true;
  base.reminderCount = result.reminderCount ?? 0;
  base.enabledReminderCount = result.enabledReminderCount ?? 0;
  return base;
}
