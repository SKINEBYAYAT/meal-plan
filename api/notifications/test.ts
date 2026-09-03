import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError, removeStaleToken, sendTestPush } from '../_lib/meal-reminders';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POST required' });
  const token = typeof request.body?.token === 'string' ? request.body.token : '';
  if (!token) return response.status(400).json({ success: false, error: 'FCM token is required.' });
  try {
    await sendTestPush(token);
    return response.status(200).json({ success: true });
  } catch (error) {
    const message = describeError(error);
    if (message.includes('invalid') || message.includes('expired') || message.includes('not-registered')) {
      await removeStaleToken(token);
    }
    return response.status(500).json({ success: false, error: message });
  }
}