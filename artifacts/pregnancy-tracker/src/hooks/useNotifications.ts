import { useCallback, useEffect, useState } from 'react';
import { requestPushSubscription, sendRemoteTestNotification } from '../push';
import { DayOfWeek, Meal, NotificationDebugInfo } from '../types';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swStatus, setSwStatus] = useState('checking');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
    navigator.serviceWorker?.ready.then(() => setSwStatus('registered')).catch(() => setSwStatus('unavailable'));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const subscription = await requestPushSubscription();
    setPermission(Notification.permission);
    return Boolean(subscription);
  }, []);

  const scheduleAll = useCallback((_meals: Meal[], _day: DayOfWeek, _enabled = true): void => {}, []);
  const scheduleMeal = useCallback((_meal: Meal, _day: DayOfWeek): void => {}, []);
  const cancelMeal = useCallback((_mealId: string): void => {}, []);
  const cancelAll = useCallback((): void => {}, []);
  const sendTestNotification = useCallback(async (): Promise<void> => { await sendRemoteTestNotification(); }, []);
  const getDebugInfo = useCallback((): NotificationDebugInfo => ({ scheduledCount: 0, upcoming: null, lastNotification: null, errors: [] }), []);

  return { permission, swStatus, isSupported, requestPermission, scheduleAll, scheduleMeal, cancelMeal, cancelAll, sendTestNotification, getDebugInfo };
}
