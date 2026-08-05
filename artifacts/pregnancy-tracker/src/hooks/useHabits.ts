import { useState } from 'react';
import { HabitDefinition, HabitLog } from '../types';
import { getFromStorage, setToStorage, HABITS_KEY, HABIT_LOGS_KEY } from '../lib/storage';

const DEFAULT_HABITS: HabitDefinition[] = [
  { id: 'water', name: 'Drink Water', icon: 'droplet', enabled: true, order: 0 },
  { id: 'prenatal', name: 'Prenatal Vitamin', icon: 'pill', enabled: true, order: 1 },
  { id: 'walk', name: 'Walk', icon: 'footprints', enabled: true, order: 2 },
  { id: 'stretch', name: 'Stretching', icon: 'activity', enabled: true, order: 3 },
  { id: 'sleep', name: 'Sleep Before 10:30 PM', icon: 'moon', enabled: true, order: 4 },
];

function seedHabitsIfNeeded() {
  const current = getFromStorage<HabitDefinition[]>(HABITS_KEY, []);
  if (current.length > 0) return current;
  setToStorage(HABITS_KEY, DEFAULT_HABITS);
  return DEFAULT_HABITS;
}

export function useHabits(date: string) {
  const [habits, setHabits] = useState<HabitDefinition[]>(() => seedHabitsIfNeeded());
  const [logs, setLogs] = useState<Record<string, HabitLog[]>>(() => 
    getFromStorage<Record<string, HabitLog[]>>(HABIT_LOGS_KEY, {})
  );

  const activeHabits = habits.filter(h => h.enabled).sort((a, b) => a.order - b.order);
  const todaysLogs = logs[date] || [];

  const toggleHabit = (habitId: string, completed: boolean) => {
    setLogs(prev => {
      const dayLogs = prev[date] || [];
      const newDayLogs = dayLogs.filter(l => l.habitId !== habitId);
      if (completed) {
        newDayLogs.push({ habitId, date, completed, completedAt: new Date().toISOString() });
      }
      const newLogs = { ...prev, [date]: newDayLogs };
      setToStorage(HABIT_LOGS_KEY, newLogs);
      return newLogs;
    });
  };

  const updateHabits = (newHabits: HabitDefinition[]) => {
    setHabits(newHabits);
    setToStorage(HABITS_KEY, newHabits);
  };

  // Helper to get streak for a specific habit
  const getHabitStreak = (habitId: string) => {
    let streak = 0;
    const sortedDates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we missed today or yesterday to break the streak
    let currentDate = today;
    let index = sortedDates.indexOf(currentDate);
    
    if (index === -1) {
       // Check yesterday
       const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
       index = sortedDates.indexOf(yesterday);
       if (index === -1) return 0; // Missed yesterday and today
       currentDate = yesterday;
    }

    // Now count backwards continuously
    let d = new Date(currentDate);
    while (true) {
      const dStr = d.toISOString().split('T')[0];
      const dayLogs = logs[dStr] || [];
      if (dayLogs.find(l => l.habitId === habitId && l.completed)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  return { habits, activeHabits, todaysLogs, toggleHabit, updateHabits, getHabitStreak, allLogs: logs };
}
