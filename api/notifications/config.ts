import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return response.status(500).json({ success: false, error: 'VAPID_PUBLIC_KEY is not configured.' });
  return response.status(200).json({ success: true, publicKey: key });
}
