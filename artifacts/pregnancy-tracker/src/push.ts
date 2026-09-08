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
  registrationCount: number;
  scriptUrl: string | null;
  scope: string | null;
  installingState: ServiceWorkerState | 'none';
  waitingState: ServiceWorkerState | 'none';
  activeState: ServiceWorkerState | 'none';
  controllerPresent: boolean;
  pushManagerAvailable: boolean;
  vapidPublicKeyLoaded: boolean;
  subscriptionPostStatus: string;
  backendLookupStatus: string;
  lastSetupError: string;
};

const DEVICE_ID_KEY = 'pregnancy-tracker-device-id';
const SERVICE_WORKER_PATH = '/sw.js';
const SERVICE_WORKER_SCOPE = '/';
const SERVICE_WORKER_TIMEOUT_MS = 15_000;
let lastSetupError = '';
let subscriptionPostStatus = 'not attempted';
let backendLookupStatus = 'not attempted';

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

function rememberError(error: unknown): string {
  lastSetupError = error instanceof Error ? error.message : String(error);
  return lastSetupError;
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

function workerState(worker: ServiceWorker | null): ServiceWorkerState | 'none' {
  return worker?.state ?? 'none';
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active?.state === 'activated') return registration;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Service worker did not become active within ${SERVICE_WORKER_TIMEOUT_MS / 1000} seconds`));
    }, SERVICE_WORKER_TIMEOUT_MS);
    let observed = registration.installing ?? registration.waiting ?? registration.active;
    const check = () => {
      if (registration.active?.state === 'activated') {
        cleanup();
        resolve(registration);
      } else if (observed?.state === 'redundant') {
        cleanup();
        reject(new Error('Service worker installation failed and became redundant'));
      }
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      observed?.removeEventListener('statechange', check);
    };
    observed?.addEventListener('statechange', check);
    void navigator.serviceWorker.ready.then((ready) => {
      if (ready.scope === registration.scope && ready.active) {
        cleanup();
        resolve(ready);
      }
    });
    check();
  });
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  let registration = registrations.find((candidate) => location.href.startsWith(candidate.scope));
  if (!registration) {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: SERVICE_WORKER_SCOPE });
  }
  if (!registration.active && !registration.installing && !registration.waiting) {
    await registration.update();
  }
  return waitForActiveWorker(registration);
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
  try {
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`pushManager.subscribe() failed: ${message}`);
  }
}

async function sync(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/notifications/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json() as { success?: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || !result.success) {
    const failure = result.error ?? `Push sync failed (${response.status}).`;
    if (payload.action === 'register' || payload.action === 'setup-all') subscriptionPostStatus = `HTTP ${response.status}: ${failure}`;
    if (payload.action === 'status') backendLookupStatus = `HTTP ${response.status}: ${failure}`;
    throw new Error(failure);
  }
  if (payload.action === 'register' || payload.action === 'setup-all') subscriptionPostStatus = `HTTP ${response.status}`;
  if (payload.action === 'status') backendLookupStatus = `HTTP ${response.status}`;
  return result;
}

export async function requestPushSubscription(): Promise<PushSubscriptionJSON | null> {
  try {
    if (!('Notification' in window)) throw new Error('Notifications are not supported by this browser.');
    if (isIos() && !isStandalonePwa()) throw new Error('Install this app to your Home Screen first to enable notifications.');
    if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') return null;
    const result = subscriptionJson(await getSubscription());
    lastSetupError = '';
    return result;
  } catch (error) {
    rememberError(error);
    throw error;
  }
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
  try {
    const subscription = subscriptionJson(await getSubscription());
    await sync({ action: 'master', deviceId: deviceId(), subscription, enabled });
    lastSetupError = '';
  } catch (error) {
    rememberError(error);
    throw error;
  }
}

export async function setupAllMealReminders(meals: Meal[]): Promise<void> {
  try {
    if (isIos() && !isStandalonePwa()) throw new Error('Install this app to your Home Screen first to enable notifications.');
    if (!('Notification' in window) || Notification.permission !== 'granted') throw new Error('Notification permission is not granted.');
    const subscription = subscriptionJson(await getSubscription());
    await sync({ action: 'setup-all', deviceId: deviceId(), subscription,
      meals: meals.map((meal) => ({ id: meal.id, weekday: meal.day as DayOfWeek, time: meal.time,
        title: meal.name, foods: meal.foods, icon: meal.icon ?? '🥘', enabled: meal.reminderEnabled === true })) });
    lastSetupError = '';
  } catch (error) {
    rememberError(error);
    throw error;
  }
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
    registrationCount: 0, scriptUrl: null, scope: null,
    installingState: 'none', waitingState: 'none', activeState: 'none',
    controllerPresent: Boolean(navigator.serviceWorker?.controller), pushManagerAvailable: false,
    vapidPublicKeyLoaded: false, subscriptionPostStatus, backendLookupStatus, lastSetupError,
  };
  if (!supported) return base;
  const registrations = await navigator.serviceWorker.getRegistrations();
  base.registrationCount = registrations.length;
  const registration = registrations.find((candidate) => location.href.startsWith(candidate.scope)) ?? registrations[0];
  base.scope = registration?.scope ?? null;
  base.installingState = workerState(registration?.installing ?? null);
  base.waitingState = workerState(registration?.waiting ?? null);
  base.activeState = workerState(registration?.active ?? null);
  base.scriptUrl = registration?.active?.scriptURL ?? registration?.waiting?.scriptURL
    ?? registration?.installing?.scriptURL ?? null;
  base.pushManagerAvailable = Boolean(registration?.pushManager);
  base.serviceWorker = registration?.active ? 'active' : 'inactive';
  try {
    await vapidPublicKey();
    base.vapidPublicKeyLoaded = true;
  } catch (error) {
    base.lastSetupError = rememberError(error);
  }
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
  base.backendLookupStatus = backendLookupStatus;
  base.subscriptionPostStatus = subscriptionPostStatus;
  base.lastSetupError = lastSetupError;
  return base;
}
