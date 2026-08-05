import { useState } from 'react';
import { format } from 'date-fns';
import { useHabits } from '../hooks/useHabits';
import { Check, Flame, Droplet, Pill, Footprints, Activity, Moon, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { HabitDefinition } from '../types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const ICON_MAP: Record<string, any> = {
  droplet: Droplet,
  pill: Pill,
  footprints: Footprints,
  activity: Activity,
  moon: Moon
};

export default function HabitsPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { habits, activeHabits, todaysLogs, toggleHabit, getHabitStreak, updateHabits } = useHabits(todayStr);

  const [isManageMode, setIsManageMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitDefinition | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('droplet');

  const startEditing = (habit: HabitDefinition | null) => {
    if (habit) {
      setEditingHabit(habit);
      setEditName(habit.name);
      setEditIcon(habit.icon);
    } else {
      setEditingHabit({
        id: `habit-${Date.now()}`,
        name: '',
        icon: 'droplet',
        enabled: true,
        order: habits.length
      });
      setEditName('');
      setEditIcon('droplet');
    }
  };

  const saveHabit = () => {
    if (!editingHabit) return;
    const newHabits = [...habits];
    const existingIndex = newHabits.findIndex(h => h.id === editingHabit.id);
    const updated = { ...editingHabit, name: editName || 'New Habit', icon: editIcon };
    
    if (existingIndex >= 0) {
      newHabits[existingIndex] = updated;
    } else {
      newHabits.push(updated);
    }
    updateHabits(newHabits);
    setEditingHabit(null);
  };

  const deleteHabit = (id: string) => {
    updateHabits(habits.filter(h => h.id !== id));
  };

  const toggleHabitEnabled = (id: string, enabled: boolean) => {
    updateHabits(habits.map(h => h.id === id ? { ...h, enabled } : h));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-[#0D1117]/95 backdrop-blur-sm border-b border-[#2d3748] px-4 pt-6 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">Daily Habits</h1>
          <p className="text-gray-400 text-sm">Build healthy routines for you and your baby.</p>
        </div>
        <button 
          onClick={() => setIsManageMode(!isManageMode)}
          className={cn(
            "p-2 rounded-full transition-colors",
            isManageMode ? "bg-[#4CAF50] text-[#0D1117]" : "bg-[#2d3748] text-gray-300"
          )}
        >
          <Edit2 className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {isManageMode ? (
          <div className="space-y-4">
            <Button onClick={() => startEditing(null)} className="w-full bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A] flex gap-2">
              <Plus className="w-4 h-4" /> Add New Habit
            </Button>
            {habits.map(habit => (
              <div key={habit.id} className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={habit.enabled} 
                    onCheckedChange={(c) => toggleHabitEnabled(habit.id, c)} 
                    className="data-[state=checked]:bg-[#4CAF50]"
                  />
                  <span className={cn("font-medium", !habit.enabled && "text-gray-500 line-through")}>{habit.name}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditing(habit)} className="p-2 bg-[#2d3748] rounded-xl text-gray-300">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteHabit(habit.id)} className="p-2 bg-red-500/20 rounded-xl text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {activeHabits.map((habit) => {
              const isCompleted = todaysLogs.some(l => l.habitId === habit.id && l.completed);
              const Icon = ICON_MAP[habit.icon] || Check;
              const streak = getHabitStreak(habit.id);

              return (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleHabit(habit.id, !isCompleted)}
                  className={cn(
                    "cursor-pointer rounded-2xl p-4 flex items-center gap-4 transition-all border",
                    isCompleted 
                      ? "bg-[#161B22] border-[#4CAF50] shadow-[0_0_15px_rgba(76,175,80,0.1)]" 
                      : "bg-[#161B22] border-[#2d3748]"
                  )}
                  data-testid={`habit-${habit.id}`}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                    isCompleted ? "bg-[#4CAF50] text-[#0D1117]" : "bg-[#0D1117] text-[#4CAF50]"
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={cn(
                      "font-bold text-lg transition-colors",
                      isCompleted ? "text-white" : "text-gray-200"
                    )}>
                      {habit.name}
                    </h3>
                    {streak > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-orange-400">
                        <Flame className="w-3 h-3" /> {streak} day streak
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors",
                    isCompleted ? "border-[#4CAF50] bg-[#4CAF50] text-white" : "border-[#2d3748] text-transparent"
                  )}>
                    <Check className="w-5 h-5" />
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <Dialog open={!!editingHabit} onOpenChange={(open) => !open && setEditingHabit(null)}>
        <DialogContent className="bg-[#161B22] border-[#2d3748] text-white rounded-t-3xl sm:rounded-3xl p-6 overflow-hidden w-full sm:max-w-md mx-auto mt-auto sm:mt-0 absolute bottom-0 sm:relative">
          <DialogTitle className="text-xl font-bold mb-4">{editingHabit?.name ? 'Edit Habit' : 'Add Habit'}</DialogTitle>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-[#0D1117] border-[#2d3748]" placeholder="e.g. Meditate" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(ICON_MAP).map(key => {
                  const IconCmp = ICON_MAP[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setEditIcon(key)}
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center border transition-colors",
                        editIcon === key ? "bg-[#4CAF50] text-[#0D1117] border-[#4CAF50]" : "bg-[#0D1117] border-[#2d3748] text-gray-400"
                      )}
                    >
                      <IconCmp className="w-6 h-6" />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent border-[#2d3748]" onClick={() => setEditingHabit(null)}>Cancel</Button>
              <Button className="flex-1 bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A]" onClick={saveHabit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
