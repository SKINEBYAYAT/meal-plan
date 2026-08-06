import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useMeals } from './useMeals';
import { useHabits } from './useHabits';
import { getFromStorage, setToStorage, STREAKS_KEY } from '../lib/storage';
import { Meal, StreakData } from '../types';

const DEFAULT_STREAKS: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: '',
};

interface HeatmapEntry { date: string; intensity: number; pct: number }

export function useProgress(date: string) {
  const { dayPlan } = useMeals(date);
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

  // ── Streak logic (localStorage — unchanged) ─────────────────────────────────
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

  // ── 3-month heatmap — loaded once from Firestore ────────────────────────────
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const q = query(
      collection(db, 'meals'),
      where('date', '>=', startStr),
      where('date', '<=', endStr),
    );

    getDocs(q)
      .then((snapshot) => {
        // Group meals by date
        const byDate: Record<string, Meal[]> = {};
        snapshot.docs.forEach((d) => {
          const meal = d.data() as Meal & { date: string };
          if (!byDate[meal.date]) byDate[meal.date] = [];
          byDate[meal.date].push(meal);
        });

        // Build entries for every day in the window
        const data: HeatmapEntry[] = [];
        const curr = new Date(start);
        while (curr <= end) {
          const dStr = curr.toISOString().split('T')[0];
          const meals = byDate[dStr] ?? [];
          const hLogs = allLogs[dStr] ?? [];
          const tMeals = meals.length;
          const cMeals = meals.filter((m: Meal) => m.completed).length;
          const tTasks = tMeals + activeHabits.length;
          const cTasks = cMeals + hLogs.filter((l) => l.completed).length;
          const pct = tTasks === 0 ? 0 : (cTasks / tTasks) * 100;
          let intensity = 0;
          if (pct > 0) intensity = 1;
          if (pct > 30) intensity = 2;
          if (pct > 70) intensity = 3;
          if (pct === 100) intensity = 4;
          data.push({ date: dStr, intensity, pct });
          curr.setDate(curr.getDate() + 1);
        }
        setHeatmapData(data);
      })
      .catch((err) => console.error('[useProgress] heatmap query failed', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once on mount; heatmap doesn't need to re-query on every change

  return {
    stats: {
      totalMeals,
      completedMeals,
      totalHabits,
      completedHabits,
      totalTasks,
      completedTasks,
      completionPercentage,
    },
    streaks: streakData,
    heatmapData,
  };
}
