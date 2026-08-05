import { useState, useEffect } from 'react';

export function useCountdown(targetTimeStr: string | null) { // "HH:MM"
  const [timeLeft, setTimeLeft] = useState<{ hours: number, minutes: number, seconds: number } | null>(null);

  useEffect(() => {
    if (!targetTimeStr) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const [hours, minutes] = targetTimeStr.split(':').map(Number);
      
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, no countdown or set to 0
      if (now > target) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const diff = target.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours: h, minutes: m, seconds: s });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTimeStr]);

  return timeLeft;
}
