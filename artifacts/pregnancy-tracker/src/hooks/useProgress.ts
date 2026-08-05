import { useMeals } from './useMeals';
import { useHabits } from './useHabits';
import { getFromStorage, setToStorage, STREAKS_KEY } from '../lib/storage';
import { StreakData } from '../types';
import { useState, useEffect } from 'react';

const DEFAULT_STREAKS: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: ''
};

export function useProgress(date: string) {
  const { allMeals } = useMeals(date);
  const { activeHabits, allLogs } = useHabits(date);
  
  const [streakData, setStreakData] = useState<StreakData>(() => 
    getFromStorage<StreakData>(STREAKS_KEY, DEFAULT_STREAKS)
  );

  // Compute stats for current date
  const dayPlan = allMeals[date] || { date, meals: [] };
  const todaysLogs = allLogs[date] || [];

  const totalMeals = dayPlan.meals.length;
  const completedMeals = dayPlan.meals.filter(m => m.completed).length;
  
  const totalHabits = activeHabits.length;
  const completedHabits = todaysLogs.filter(l => l.completed).length;

  const totalTasks = totalMeals + totalHabits;
  const completedTasks = completedMeals + completedHabits;
  
  const completionPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Update streak logic
  useEffect(() => {
    // Only count as completed if everything is done and there are tasks
    const isDayCompleted = totalTasks > 0 && completedTasks === totalTasks;
    
    if (isDayCompleted && streakData.lastCompletedDate !== date) {
      // Is it consecutive?
      const todayDate = new Date(date);
      const lastDate = streakData.lastCompletedDate ? new Date(streakData.lastCompletedDate) : null;
      
      let newStreak = streakData.currentStreak;
      if (!lastDate) {
        newStreak = 1;
      } else {
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1; // reset streak
        }
      }

      const newData = {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streakData.longestStreak),
        lastCompletedDate: date
      };
      setStreakData(newData);
      setToStorage(STREAKS_KEY, newData);
    }
  }, [completedTasks, totalTasks, date, streakData]);

  // Generate heatmap data for last 3 months
  const getHeatmapData = () => {
    const data = [];
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    let curr = new Date(start);
    while (curr <= end) {
      const dStr = curr.toISOString().split('T')[0];
      const mPlan = allMeals[dStr];
      const hLogs = allLogs[dStr] || [];
      
      let tMeals = mPlan ? mPlan.meals.length : 0;
      let cMeals = mPlan ? mPlan.meals.filter(m => m.completed).length : 0;
      
      let tTasks = tMeals + activeHabits.length;
      let cTasks = cMeals + hLogs.filter(l => l.completed).length;
      
      let pct = tTasks === 0 ? 0 : (cTasks / tTasks) * 100;
      
      // Determine intensity 0-4
      let intensity = 0;
      if (pct > 0) intensity = 1;
      if (pct > 30) intensity = 2;
      if (pct > 70) intensity = 3;
      if (pct === 100) intensity = 4;
      
      data.push({ date: dStr, intensity, pct });
      
      curr.setDate(curr.getDate() + 1);
    }
    return data;
  };

  return {
    stats: {
      totalMeals, completedMeals, totalHabits, completedHabits,
      totalTasks, completedTasks, completionPercentage
    },
    streaks: streakData,
    heatmapData: getHeatmapData()
  };
}
