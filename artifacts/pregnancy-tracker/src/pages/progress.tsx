import { useState } from 'react';
import { format } from 'date-fns';
import { useProgress } from '../hooks/useProgress';
import { Flame, Trophy, CalendarDays, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from 'recharts';

export default function ProgressPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { stats, streaks, heatmapData } = useProgress(todayStr);

  const last7Days = heatmapData.slice(-7);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-[#0D1117]/95 backdrop-blur-sm border-b border-[#2d3748] px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-1">Your Journey</h1>
        <p className="text-gray-400 text-sm">Every small step makes a big difference.</p>
      </div>

      <div className="p-4 space-y-6 flex-1">
        
        {/* Streaks Header */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#161B22] border border-[#2d3748] rounded-3xl p-5 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-orange-400/10 rounded-full flex items-center justify-center mb-3">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div className="text-3xl font-bold">{streaks.currentStreak}</div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Current Streak</div>
          </div>
          
          <div className="bg-[#161B22] border border-[#2d3748] rounded-3xl p-5 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-[#4CAF50]/10 rounded-full flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-[#4CAF50]" />
            </div>
            <div className="text-3xl font-bold">{streaks.longestStreak}</div>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">Longest Streak</div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="bg-[#161B22] border border-[#2d3748] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#8BC34A]" /> Last 7 Days</h3>
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => format(new Date(val), 'EE')} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#718096', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#718096', fontSize: 12 }} 
                />
                <RechartsTooltip 
                  cursor={{ fill: '#2d3748' }}
                  contentStyle={{ backgroundColor: '#161B22', borderColor: '#2d3748', borderRadius: '8px' }}
                  labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                  formatter={(val: number) => [`${Math.round(val)}%`, 'Completed']}
                />
                <Bar dataKey="pct" radius={[4, 4, 4, 4]}>
                  {last7Days.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pct === 100 ? '#4CAF50' : '#8BC34A'} fillOpacity={entry.pct === 0 ? 0.2 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Github style contribution graph */}
        <div className="bg-[#161B22] border border-[#2d3748] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#4CAF50]" /> 90-Day History</h3>
          </div>
          
          <div className="flex flex-wrap gap-1.5 justify-end">
            {heatmapData.map((day, idx) => {
              // colors for 0-4 intensity
              const colors = [
                'bg-[#0D1117]', 
                'bg-[#4CAF50]/30', 
                'bg-[#4CAF50]/60', 
                'bg-[#4CAF50]/80', 
                'bg-[#4CAF50]'
              ];
              
              return (
                <div 
                  key={idx} 
                  className={cn("w-3.5 h-3.5 rounded-[2px]", colors[day.intensity])}
                  title={`${format(new Date(day.date), 'MMM d')}: ${Math.round(day.pct)}%`}
                />
              )
            })}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
            <span>Less</span>
            <div className="w-3.5 h-3.5 rounded-[2px] bg-[#0D1117]" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-[#4CAF50]/30" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-[#4CAF50]/60" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-[#4CAF50]/80" />
            <div className="w-3.5 h-3.5 rounded-[2px] bg-[#4CAF50]" />
            <span>More</span>
          </div>
        </div>
        
      </div>
    </div>
  );
}
