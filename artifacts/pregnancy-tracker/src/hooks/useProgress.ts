import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useMeals } from './useMeals';
import { useHabits } from './useHabits';
import { getFromStorage, setToStorage, STREAKS_KEY, COMPLETIONS_KEY } from '../lib/storage';
import { DayOfWeek, Meal, StreakData } from '../types';

const DEFAULT_STREAKS: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: '',
};

interface HeatmapEntry { date: string; intensity: number; pct: number }

/** Convert a yyyy-MM-dd date string to its DayOfWeek. */
function dateToDow(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

/** Get today's DayOfWeek. */
function todayDow(): DayOfWeek {
  const days: DayOfWeek[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];
  return days[new Date().getDay()];
}

export function useProgress(date: string) {
  // Always show today's weekday meals for stats (the plan is recurring)
  const { dayPlan } = useMeals(todayDow());
  const { activeHabits, allLogs } = useHabits(date);

  const [streakData, setStreakData] = useState<StreakData>(() =>
    getFromStorage<StreakData>(STREAKS_KEY, DEFAULT_STREAKS),
  );
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);

  // ── Today's stats ───────────────────────────────────────────────────────────
  const todaysLogs = allLogs[date] || [];
  const totalMeals = dayPlan.meals.length;
  const completedMeals = dayPlan.meals.filter((m: Meal) => m.completed).length;
  const totalHabits = activeHabits.length;
  const completedHabits = todaysLogs.filter((l) => l.completed).length;
  const totalTasks = totalMeals + totalHabits;
  const completedTasks = completedMeals + completedHabits;
  const completionPercentage =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // ── Streak tracking (unchanged — localStorage) ──────────────────────────────
  useEffect(() => {
    const isDayCompleted = totalTasks > 0 && completedTasks === totalTasks;
    if (isDayCompleted && streakData.lastCompletedDate !== date) {
      const todayDate = new Date(date);
      const lastDate = streakData.lastCompletedDate
        ? new Date(streakData.lastCompletedDate)
        : null;
      let newStreak = streakData.currentStreak;
      if (!lastDate) {
        newStreak = 1;
      } else {
        const diffDays = Math.ceil(
          Math.abs(todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        newStreak = diffDays === 1 ? newStreak + 1 : 1;
      }
      const newData: StreakData = {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streakData.longestStreak),
        lastCompletedDate: date,
      };
      setStreakData(newData);
      setToStorage(STREAKS_KEY, newData);
    }
  }, [completedTasks, totalTasks, date, streakData]);

  // ── 3-month heatmap ─────────────────────────────────────────────────────────
  // Strategy: load all meal templates from Firestore once → count per weekday.
  // Then for each calendar date, compare against localStorage completion history.
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    getDocs(collection(db, 'meals'))
      .then((snapshot) => {
        // Count how many template meals exist per day of week
        const countByDow: Partial<Record<DayOfWeek, number>> = {};
        snapshot.docs.forEach((d) => {
          const meal = d.data() as Meal;
          countByDow[meal.day] = (countByDow[meal.day] ?? 0) + 1;
        });

        const completions = getFromStorage<Record<string, string[]>>(COMPLETIONS_KEY, {});

        const data: HeatmapEntry[] = [];
        const curr = new Date(start);
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          const dow = dateToDow(dStr);
          const tMeals = countByDow[dow] ?? 0;
          const cMeals = completions[dStr]?.length ?? 0;
          const hLogs = allLogs[dStr] ?? [];
          const tTasks = tMeals + activeHabits.length;
          const cTasks = cMeals + hLogs.filter((l) => l.completed).length;
          const pct = tTasks === 0 ? 0 : (cTasks / tTasks) * 100;
          let intensity = 0;
          if (pct > 0)   intensity = 1;
          if (pct > 30)  intensity = 2;
          if (pct > 70)  intensity = 3;
          if (pct === 100) intensity = 4;
          data.push({ date: dStr, intensity, pct });
          curr.setDate(curr.getDate() + 1);
        }
        setHeatmapData(data);
      })
      .catch((err) => console.error('[useProgress] heatmap query failed', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once on mount

  return {
    stats: {
      totalMeals, completedMeals, totalHabits, completedHabits,
      totalTasks, completedTasks, completionPercentage,
    },
    streaks: streakData,
    heatmapData,
  };
}
