import { useState, useEffect, useCallback } from 'react';
import { notificationScheduler } from '../lib/notifications';
import { DayOfWeek, Meal, NotificationDebugInfo } from '../types';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swStatus, setSwStatus] = useState<string>('checking');
  const [isSupported, setIsSupported] = useState(false);

  // Initialise on mount
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
    notificationScheduler.init().then(() => {
      setSwStatus(notificationScheduler.swStatus);
    });
  }, []);

  /**
   * Request browser notification permission.
   * Only call this in response to a deliberate user action.
   * Returns true if granted.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      await notificationScheduler.init();
      setSwStatus(notificationScheduler.swStatus);
    }
    return perm === 'granted';
  }, []);

  /**
   * Schedule all reminder-enabled meals for a given date.
   * Cancels any previously scheduled timers first.
   */
  const scheduleAll = useCallback((meals: Meal[], day: DayOfWeek, enabled = true): void => {
    if (!enabled) {
      notificationScheduler.cancelAll();
      return;
    }
    if (Notification.permission !== 'granted') return;
    notificationScheduler.scheduleAll(meals, day);
  }, []);

  /**
   * Schedule (or re-schedule) a single meal's reminders.
   */
  const scheduleMeal = useCallback((meal: Meal, day: DayOfWeek): void => {
    if (Notification.permission !== 'granted') return;
    notificationScheduler.scheduleMeal(meal, day);
  }, []);

  /**
   * Cancel reminders for a specific meal (use on delete or toggle-off).
   */
  const cancelMeal = useCallback((mealId: string): void => {
    notificationScheduler.cancelMeal(mealId);
  }, []);

  /** Cancel every scheduled timer. */
  const cancelAll = useCallback((): void => {
    notificationScheduler.cancelAll();
  }, []);

  /** Fire a test notification immediately (requires granted permission). */
  const sendTestNotification = useCallback(async (): Promise<void> => {
    await notificationScheduler.sendTestNotification();
  }, []);

  /** Get a snapshot of the scheduler state for the debug page. */
  const getDebugInfo = useCallback((): NotificationDebugInfo => {
    return notificationScheduler.getDebugInfo();
  }, []);

  return {
    permission,
    swStatus,
    isSupported,
    requestPermission,
    scheduleAll,
    scheduleMeal,
    cancelMeal,
    cancelAll,
    sendTestNotification,
    getDebugInfo,
  };
}
