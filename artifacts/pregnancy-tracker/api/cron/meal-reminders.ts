import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertCronSecret, describeError, processDueReminders } from '../_lib/meal-reminders.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POST required' });
  try {
    assertCronSecret(request.headers.authorization);
    const processed = await processDueReminders();
    return response.status(200).json({ success: true, processed });
  } catch (error) {
    const message = describeError(error);
    return response.status(message === 'Unauthorized cron request.' ? 401 : 500).json({ success: false, error: message });
  }
}
