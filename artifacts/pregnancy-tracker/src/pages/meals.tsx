import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { useMeals } from '../hooks/useMeals';
import { Check, Clock, Plus, Trash2, Edit2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Meal } from '../types';
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

      {/* Bottom Sheet Overlay */}
      <AnimatePresence>
        {selectedMeal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60"
              onClick={() => setSelectedMeal(null)}
            />

            {/* Sheet — always fixed to bottom, never changes position */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[70] flex flex-col bg-[#161B22] rounded-t-3xl border-t border-[#2d3748]"
              style={{
                maxHeight: 'calc(85dvh - env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#2d3748]" />
              </div>

              {isEditing ? (
                <>
                  {/* Header — fixed, never scrolls */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3748] flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">
                      {selectedMeal.name ? 'Edit Meal' : 'Add Meal'}
                    </h2>
                    <button
                      onClick={() => selectedMeal.name ? setIsEditing(false) : setSelectedMeal(null)}
                      className="w-8 h-8 rounded-full bg-[#2d3748] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-gray-300" />
                    </button>
                  </div>

                  {/* Scrollable form body */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Name</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-[#0D1117] border-[#2d3748] text-white" placeholder="e.g. Breakfast" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Time</label>
                      <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="bg-[#0D1117] border-[#2d3748] text-white" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Foods (comma separated)</label>
                      <Input value={editFoods} onChange={e => setEditFoods(e.target.value)} className="bg-[#0D1117] border-[#2d3748] text-white" placeholder="Eggs, Toast, Milk" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Notes</label>
                      <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-[#0D1117] border-[#2d3748] text-white" placeholder="Optional notes" />
                    </div>
                  </div>

                  {/* Footer buttons — fixed, always visible */}
                  <div className="flex gap-3 px-6 py-4 border-t border-[#2d3748] bg-[#0D1117] flex-shrink-0">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent border-[#2d3748] text-white"
                      onClick={() => selectedMeal.name ? setIsEditing(false) : setSelectedMeal(null)}
                    >
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A] font-bold" onClick={saveMeal}>
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Header — fixed, never scrolls */}
                  <div className="flex items-start justify-between px-6 py-4 border-b border-[#2d3748] flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <h2 className="text-2xl font-bold text-white truncate">{selectedMeal.name}</h2>
                      <div className="flex items-center gap-2 mt-1 text-[#8BC34A]">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className="font-semibold">{selectedMeal.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        data-testid="button-edit-meal"
                        onClick={() => startEditing(selectedMeal)}
                        className="w-9 h-9 rounded-full bg-[#2d3748] flex items-center justify-center"
                      >
                        <Edit2 className="w-4 h-4 text-gray-300" />
                      </button>
                      <button
                        data-testid="button-duplicate-meal"
                        onClick={duplicateMeal}
                        className="w-9 h-9 rounded-full bg-[#2d3748] flex items-center justify-center"
                      >
                        <Copy className="w-4 h-4 text-gray-300" />
                      </button>
                      <button
                        data-testid="button-delete-meal"
                        onClick={removeMeal}
                        className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                      <button
                        onClick={() => setSelectedMeal(null)}
                        className="w-9 h-9 rounded-full bg-[#2d3748] flex items-center justify-center ml-1"
                      >
                        <X className="w-4 h-4 text-gray-300" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Foods</h4>
                    {selectedMeal.foods.length > 0 ? (
                      <ul className="space-y-2 mb-5">
                        {selectedMeal.foods.map((food, idx) => (
                          <li key={idx} className="bg-[#0D1117] px-4 py-3 rounded-xl border border-[#2d3748] flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#4CAF50] flex-shrink-0" />
                            <span className="text-gray-200 text-sm">{food}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm mb-5">No foods added yet.</p>
                    )}

                    {selectedMeal.notes && (
                      <>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h4>
                        <p className="bg-[#0D1117] px-4 py-3 rounded-xl border border-[#2d3748] text-sm text-gray-300 leading-relaxed">
                          {selectedMeal.notes}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Footer CTA — fixed, always visible */}
                  <div className="px-6 py-4 border-t border-[#2d3748] bg-[#0D1117] flex-shrink-0">
                    <button
                      data-testid="button-toggle-meal-completed"
                      onClick={() => {
                        toggleMealCompleted(selectedMeal.id, !selectedMeal.completed);
                        setSelectedMeal(null);
                      }}
                      className={cn(
                        "w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98]",
                        selectedMeal.completed
                          ? "bg-[#2d3748] text-white"
                          : "bg-[#4CAF50] text-[#0D1117] shadow-[0_4px_14px_rgba(76,175,80,0.3)]"
                      )}
                    >
                      {selectedMeal.completed ? 'Mark as Incomplete' : 'Mark as Completed'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
