import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { useMeals } from '../hooks/useMeals';
import { Check, Clock, ChevronRight, Plus, Trash2, Edit2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Meal } from '../types';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function MealsPage() {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const { dayPlan, toggleMealCompleted, updateMeal, deleteMeal } = useMeals(dateStr);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editFoods, setEditFoods] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const meals = [...dayPlan.meals].sort((a, b) => a.time.localeCompare(b.time));

  const openMeal = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsEditing(false);
  };

  const startEditing = (meal: Meal | null) => {
    if (meal) {
      setEditName(meal.name);
      setEditTime(meal.time);
      setEditFoods(meal.foods.join(', '));
      setEditNotes(meal.notes || '');
      setSelectedMeal(meal);
    } else {
      setEditName('');
      setEditTime('12:00');
      setEditFoods('');
      setEditNotes('');
      setSelectedMeal({
        id: `${dateStr}-${Date.now()}`,
        type: 'lunch',
        name: '',
        time: '12:00',
        foods: [],
        notes: '',
        reminderEnabled: false,
        reminderTime: '11:45',
        completed: false
      });
    }
    setIsEditing(true);
  };

  const saveMeal = () => {
    if (!selectedMeal) return;
    const updated: Meal = {
      ...selectedMeal,
      name: editName || 'Untitled Meal',
      time: editTime || '12:00',
      foods: editFoods.split(',').map(s => s.trim()).filter(Boolean),
      notes: editNotes
    };
    updateMeal(updated);
    setIsEditing(false);
    setSelectedMeal(updated); // Update local state for view mode
  };

  const duplicateMeal = () => {
    if (!selectedMeal) return;
    const dup: Meal = {
      ...selectedMeal,
      id: `${dateStr}-${Date.now()}`,
      name: `${selectedMeal.name} (Copy)`,
      completed: false
    };
    updateMeal(dup);
    setSelectedMeal(null);
  };

  const removeMeal = () => {
    if (!selectedMeal) return;
    deleteMeal(selectedMeal.id);
    setSelectedMeal(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-[#0D1117]/95 backdrop-blur-sm border-b border-[#2d3748] px-4 pt-6 pb-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Meal Plan</h1>
          <button 
            onClick={() => startEditing(null)}
            className="w-10 h-10 bg-[#2d3748] rounded-full flex items-center justify-center text-white"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex justify-between items-center gap-2">
          {weekDays.map((d, i) => {
            const isSelected = isSameDay(d, selectedDate);
            const isToday = isSameDay(d, today);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex flex-col items-center justify-center w-11 h-14 rounded-2xl transition-all",
                  isSelected 
                    ? "bg-[#4CAF50] text-white shadow-[0_0_15px_rgba(76,175,80,0.3)]" 
                    : isToday 
                      ? "border border-[#4CAF50] text-[#4CAF50]" 
                      : "bg-[#161B22] border border-[#2d3748] text-gray-400"
                )}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider mb-1">{format(d, 'EEE')}</span>
                <span className="text-sm font-semibold">{format(d, 'd')}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={dateStr}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {meals.length === 0 ? (
              <div className="text-center py-10 bg-[#161B22] rounded-3xl border border-[#2d3748]">
                <div className="w-12 h-12 bg-[#2d3748] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-200 font-medium">No meals planned</h3>
                <p className="text-gray-500 text-sm mt-1 mb-4">Tap + to add a meal for this day.</p>
                <Button onClick={() => startEditing(null)} className="bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A]">Add Meal</Button>
              </div>
            ) : (
              meals.map((meal) => (
                <div 
                  key={meal.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border transition-all",
                    meal.completed 
                      ? "bg-[#161B22]/50 border-[#4CAF50]/30" 
                      : "bg-[#161B22] border-[#2d3748]"
                  )}
                >
                  {meal.completed && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4CAF50]" />
                  )}
                  <div className="p-4 flex gap-4">
                    <button 
                      onClick={() => toggleMealCompleted(meal.id, !meal.completed)}
                      className={cn(
                        "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 transition-all",
                        meal.completed 
                          ? "bg-[#4CAF50] text-white" 
                          : "border-2 border-[#4CAF50] text-transparent"
                      )}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    
                    <div className="flex-1 cursor-pointer" onClick={() => openMeal(meal)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "font-bold text-lg",
                          meal.completed ? "text-gray-400 line-through decoration-[#4CAF50]/50" : "text-white"
                        )}>
                          {meal.name}
                        </span>
                        <span className="text-sm font-medium text-[#8BC34A] bg-[#8BC34A]/10 px-2 py-0.5 rounded-md">
                          {meal.time}
                        </span>
                      </div>
                      
                      <ul className={cn(
                        "space-y-1 text-sm mt-2",
                        meal.completed ? "text-gray-500" : "text-gray-300"
                      )}>
                        {meal.foods.map((food, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#4CAF50] mt-0.5">•</span>
                            {food}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Dialog open={!!selectedMeal} onOpenChange={(open) => !open && setSelectedMeal(null)}>
        <DialogContent className="bg-[#161B22] border-[#2d3748] text-white rounded-t-3xl sm:rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col w-full sm:max-w-md mx-auto mt-auto sm:mt-0 absolute bottom-0 sm:relative data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full">
          {selectedMeal && (
            isEditing ? (
              <>
                <div className="p-6 border-b border-[#2d3748] flex justify-between items-center">
                  <DialogTitle className="text-xl font-bold">{selectedMeal.name ? 'Edit Meal' : 'Add Meal'}</DialogTitle>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Name</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-[#0D1117] border-[#2d3748]" placeholder="e.g. Breakfast" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Time</label>
                    <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="bg-[#0D1117] border-[#2d3748]" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Foods (comma separated)</label>
                    <Input value={editFoods} onChange={e => setEditFoods(e.target.value)} className="bg-[#0D1117] border-[#2d3748]" placeholder="Eggs, Toast, Milk" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Notes</label>
                    <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-[#0D1117] border-[#2d3748]" placeholder="Optional notes" />
                  </div>
                </div>
                <div className="p-4 border-t border-[#2d3748] bg-[#0D1117] flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent border-[#2d3748]" onClick={() => selectedMeal.name ? setIsEditing(false) : setSelectedMeal(null)}>Cancel</Button>
                  <Button className="flex-1 bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A]" onClick={saveMeal}>Save</Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-6 border-b border-[#2d3748] flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-2xl font-bold">{selectedMeal.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-2 text-[#8BC34A]">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold">{selectedMeal.time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditing(selectedMeal)} className="w-8 h-8 rounded-full bg-[#2d3748] flex items-center justify-center">
                      <Edit2 className="w-4 h-4 text-gray-300" />
                    </button>
                    <button onClick={duplicateMeal} className="w-8 h-8 rounded-full bg-[#2d3748] flex items-center justify-center">
                      <Copy className="w-4 h-4 text-gray-300" />
                    </button>
                    <button onClick={removeMeal} className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Foods</h4>
                  {selectedMeal.foods.length > 0 ? (
                    <ul className="space-y-3 mb-6">
                      {selectedMeal.foods.map((food, idx) => (
                        <li key={idx} className="bg-[#0D1117] p-3 rounded-xl border border-[#2d3748] flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#4CAF50]" />
                          <span>{food}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 mb-6">No foods added.</p>
                  )}

                  {selectedMeal.notes && (
                    <>
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h4>
                      <p className="bg-[#0D1117] p-4 rounded-xl border border-[#2d3748] text-sm text-gray-300 leading-relaxed mb-6">
                        {selectedMeal.notes}
                      </p>
                    </>
                  )}
                </div>
                
                <div className="p-4 border-t border-[#2d3748] bg-[#0D1117]">
                  <button 
                    onClick={() => {
                      toggleMealCompleted(selectedMeal.id, !selectedMeal.completed);
                      setSelectedMeal(null);
                    }}
                    className={cn(
                      "w-full py-4 rounded-xl font-bold transition-all active:scale-[0.98]",
                      selectedMeal.completed 
                        ? "bg-[#2d3748] text-white"
                        : "bg-[#4CAF50] text-[#0D1117] shadow-[0_4px_14px_rgba(76,175,80,0.3)]"
                    )}
                  >
                    {selectedMeal.completed ? 'Mark as Incomplete' : 'Mark as Completed'}
                  </button>
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
