import { useState, useEffect } from 'react';
import { Meal } from '../types';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    return perm === 'granted';
  };

  const scheduleMealNotification = (meal: Meal) => {
    if (permission !== 'granted' || !meal.reminderEnabled) return;

    const [hours, minutes] = meal.reminderTime.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    const delay = target.getTime() - now.getTime();
    
    // Only schedule if it's in the future and today
    if (delay > 0) {
      setTimeout(() => {
        new Notification(meal.name, {
          body: meal.foods.join(' • ') + '\nTime for a nourishing meal!',
          icon: '/icons/icon-192.svg'
        });
      }, delay);
    }
  };

  return { permission, requestPermission, scheduleMealNotification };
}
