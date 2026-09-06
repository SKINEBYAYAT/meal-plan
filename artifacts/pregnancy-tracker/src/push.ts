import { DayOfWeek, Meal } from './types';

type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };
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

async function getSubscription(): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Standard Web Push is not supported.');
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const configResponse = await fetch('/api/notifications/config');
  const config = await configResponse.json() as { publicKey?: string; error?: string };
  if (!configResponse.ok || !config.publicKey) throw new Error(config.error ?? 'VAPID public key is unavailable.');
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) });
}

function decodeKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0)).buffer;
}

async function sync(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/notifications/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json() as { success?: boolean; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? `Push sync failed (${response.status}).`);
}

export async function requestPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!('Notification' in window)) return null;
  if (await Notification.requestPermission() !== 'granted') return null;
  return subscriptionJson(await getSubscription());
}

export function getStoredPushSubscription(): PushSubscriptionJSON | null {
  return null;
}

export async function syncMealReminder(meal: Meal): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'sync', deviceId: deviceId(), subscription, mealId: meal.id, weekday: meal.day as DayOfWeek, time: meal.time, title: meal.name, foods: meal.foods, icon: meal.icon ?? '🥘', enabled: meal.reminderEnabled });
}

export async function removeMealReminder(mealId: string): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'remove', deviceId: deviceId(), subscription, mealId });
}

export async function setMasterReminder(enabled: boolean): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  await sync({ action: 'master', deviceId: deviceId(), subscription, enabled });
}

export async function sendRemoteTestNotification(): Promise<void> {
  const subscription = subscriptionJson(await getSubscription());
  const response = await fetch('/api/notifications/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription }),
  });
  const result = await response.json() as { success?: boolean; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? `Test notification failed (${response.status}).`);
}
