import type { VercelRequest, VercelResponse } from '@vercel/node';
import { removeReminder, setMaster, setupAllReminders, syncReminder } from '../_lib/meal-reminders.js';

type Body = {
  action: 'sync' | 'remove' | 'master' | 'setup-all';
  deviceId: string;
  subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
  mealId?: string;
  weekday?: string;
  time?: string;
  title?: string;
  foods?: string[];
  icon?: string;
  enabled?: boolean;
  meals?: Array<{ id: string; weekday: string; time: string; title: string; foods: string[]; icon?: string }>;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POST required' });
  const body = request.body as Body;
  try {
    if (!body?.deviceId || !body.subscription) return response.status(400).json({ success: false, error: 'Device ID and push subscription are required.' });
    if (body.action === 'setup-all' && Array.isArray(body.meals) && body.meals.length > 0) {
      const valid = body.meals.every((meal) => meal?.id && meal.weekday && meal.time && meal.title && Array.isArray(meal.foods));
      if (!valid) return response.status(400).json({ success: false, error: 'Invalid meal reminder list.' });
      await setupAllReminders(body.deviceId, body.subscription, body.meals.map((meal) => ({ ...meal, weekday: meal.weekday as never })));
    } else if (body.action === 'remove' && body.mealId) await removeReminder(body.deviceId, body.mealId);
    else if (body.action === 'master') await setMaster(body.deviceId, body.subscription, body.enabled === true);
    else if (body.action === 'sync' && body.mealId && body.weekday && body.time && body.title && Array.isArray(body.foods)) {
      await syncReminder({ deviceId: body.deviceId, subscription: body.subscription, mealId: body.mealId, weekday: body.weekday as never, time: body.time, title: body.title, foods: body.foods, icon: body.icon, enabled: body.enabled === true });
    } else return response.status(400).json({ success: false, error: 'Invalid reminder payload.' });
    return response.status(200).json({ success: true });
  } catch (error) {
    return response.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
}
