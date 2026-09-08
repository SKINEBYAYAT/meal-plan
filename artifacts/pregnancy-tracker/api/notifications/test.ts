import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError, sendTestPushForDevice } from '../_lib/meal-reminders.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POST required' });
  const deviceId = request.body?.deviceId;
  const subscription = request.body?.subscription;
  if (!deviceId || typeof deviceId !== 'string') return response.status(400).json({ success: false, error: 'Device ID is required.' });
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return response.status(400).json({ success: false, error: 'Current push subscription is required.' });
  }
  try {
    const statusCode = await sendTestPushForDevice(deviceId, subscription);
    return response.status(200).json({ success: true, sent: true, statusCode });
  } catch (error) {
    const message = describeError(error);
    return response.status(500).json({ success: false, error: message });
  }
}
