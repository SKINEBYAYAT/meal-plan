import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSettings } from '../hooks/useSettings';
import { useMeals } from '../hooks/useMeals';
import { useHabits } from '../hooks/useHabits';
import { useProgress } from '../hooks/useProgress';
import { useCountdown } from '../hooks/useCountdown';
import { Check, Flame, ChevronRight, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const QUOTES = [
  "A grand adventure is about to begin.",
  "You are making magic happen inside you.",
  "Growing a life is the most beautiful journey.",
  "Trust your body, it knows exactly what to do.",
  "Every day brings you closer to meeting your little one.",
  "You are strong, you are beautiful, you are creating life.",
  "Nourish your body to nourish your baby.",
  "Rest when you need to, grow when you can.",
  "The tiniest feet leave the biggest footprints in our hearts.",
  "Take it one beautiful, challenging, miraculous day at a time."
];

export default function HomePage() {
  const { settings } = useSettings();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { dayPlan, toggleMealCompleted } = useMeals(todayStr);
  const { activeHabits, todaysLogs, toggleHabit } = useHabits(todayStr);
  const { stats, streaks } = useProgress(todayStr);

  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  // Find next meal
  const now = new Date();
  const nextMeal = [...dayPlan.meals]
    .filter(m => !m.completed)
    .sort((a, b) => a.time.localeCompare(b.time))
    .find(m => {
      const [h, min] = m.time.split(':').map(Number);
      const target = new Date();
      target.setHours(h, min, 0, 0);
      return target > now;
    });

  const timeLeft = useCountdown(nextMeal?.time || null);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="p-4 space-y-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="text-2xl font-bold mt-1">Hello, {settings.userName}</h1>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-3 py-1.5 rounded-full">
            <Flame className="w-4 h-4 fill-orange-400/20" />
            <span className="font-bold">{streaks.currentStreak}</span>
          </div>
        </div>
      </header>

      {settings.motivationalMessages && (
        <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-4 text-center">
          <p className="text-[#8BC34A] italic leading-relaxed text-sm">"{quote}"</p>
        </div>
      )}

      {/* Progress Circle */}
      <section className="flex flex-col items-center bg-[#161B22] border border-[#2d3748] rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#2d3748]">
          <motion.div 
            className="h-full bg-[#4CAF50]" 
            initial={{ width: 0 }} 
            animate={{ width: `${stats.completionPercentage}%` }} 
            transition={{ duration: 1 }}
          />
        </div>
        <h2 className="text-sm font-medium text-gray-400 mb-4">Today's Progress</h2>
        
        <div className="relative flex items-center justify-center w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#2d3748" strokeWidth="8" />
            <motion.circle 
              cx="50" cy="50" r="45" fill="none" stroke="#4CAF50" strokeWidth="8"
              strokeDasharray={283}
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * stats.completionPercentage) / 100 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-bold">{stats.completionPercentage}%</span>
            <span className="text-xs text-gray-400 mt-1">{stats.completedTasks} / {stats.totalTasks} Done</span>
          </div>
        </div>
      </section>

      {/* Next Meal */}
      {nextMeal ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Next Meal</h2>
            <Link href="/meals" className="text-sm text-[#4CAF50] flex items-center">View Plan <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#8BC34A]" />
                <span className="text-[#8BC34A] font-semibold text-sm">{nextMeal.time}</span>
              </div>
              <h3 className="font-bold text-lg">{nextMeal.name}</h3>
              <p className="text-gray-400 text-sm truncate mt-1">{nextMeal.foods.join(', ')}</p>
            </div>
            
            {timeLeft && (
              <div className="ml-4 flex flex-col items-center bg-[#0D1117] px-4 py-2 rounded-xl">
                <span className="text-xl font-mono font-bold tracking-tight">
                  {timeLeft.hours.toString().padStart(2, '0')}:{timeLeft.minutes.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Left</span>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Next Meal</h2>
            <Link href="/meals" className="text-sm text-[#4CAF50] flex items-center">View Plan <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-6 text-center text-gray-400">
            All meals completed for today!
          </div>
        </section>
      )}

      {/* Quick Habits */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Daily Habits</h2>
          <Link href="/habits" className="text-sm text-[#4CAF50] flex items-center">See All <ChevronRight className="w-4 h-4" /></Link>
        </div>
        <div className="space-y-2">
          {activeHabits.slice(0, 4).map(habit => {
            const isCompleted = todaysLogs.some(l => l.habitId === habit.id && l.completed);
            return (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id, !isCompleted)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl transition-all border text-left",
                  isCompleted 
                    ? "bg-[#4CAF50]/10 border-[#4CAF50]/30" 
                    : "bg-[#161B22] border-[#2d3748]"
                )}
                data-testid={`btn-quick-habit-${habit.id}`}
              >
                <span className={cn("font-medium transition-colors", isCompleted ? "text-[#4CAF50]" : "text-white")}>
                  {habit.name}
                </span>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                  isCompleted ? "bg-[#4CAF50] text-white" : "border-2 border-[#2d3748]"
                )}>
                  {isCompleted && <Check className="w-4 h-4" />}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </motion.div>
  );
}
