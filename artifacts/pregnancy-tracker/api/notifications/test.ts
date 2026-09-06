import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError, removeStaleSubscription, sendTestPush } from '../_lib/meal-reminders.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POST required' });
  const subscription = request.body?.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) return response.status(400).json({ success: false, error: 'Push subscription is required.' });
  try {
    await sendTestPush(subscription);
    return response.status(200).json({ success: true });
  } catch (error) {
    const message = describeError(error);
    if (message.includes('invalid') || message.includes('expired') || message.includes('not-registered')) {
      await removeStaleSubscription(subscription.endpoint);
    }
    return response.status(500).json({ success: false, error: message });
  }
}
