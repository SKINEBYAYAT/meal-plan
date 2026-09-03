import { useState, useEffect, useCallback } from 'react';
import { useMeals } from '../hooks/useMeals';
import { useSettings } from '../hooks/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { Check, Clock, Plus, Trash2, Edit2, Copy, X, Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Meal, DayOfWeek } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getStoredFcmToken,
  removeMealReminder,
  requestNotificationPermission as requestFcmToken,
  syncMealReminder,
} from '../firebase';

// ─── Weekday config ───────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; label: string; full: string }[] = [
  { key: 'monday',    label: 'MON', full: 'Monday'    },
  { key: 'tuesday',   label: 'TUE', full: 'Tuesday'   },
  { key: 'wednesday', label: 'WED', full: 'Wednesday' },
  { key: 'thursday',  label: 'THU', full: 'Thursday'  },
  { key: 'friday',    label: 'FRI', full: 'Friday'    },
  { key: 'saturday',  label: 'SAT', full: 'Saturday'  },
  { key: 'sunday',    label: 'SUN', full: 'Sunday'    },
];

const TODAY_DOW: DayOfWeek = (
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[]
)[new Date().getDay()];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MealsPage() {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(TODAY_DOW);
  const { dayPlan, toggleMealCompleted, updateMeal, deleteMeal } = useMeals(selectedDay);
  const { settings } = useSettings();
  const { permission, requestPermission, scheduleAll, scheduleMeal, cancelMeal } = useNotifications();
  const { toast } = useToast();

  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit-form state
  const [editName, setEditName] = useState('');
  const [editDay, setEditDay] = useState<DayOfWeek>(TODAY_DOW);
  const [editTime, setEditTime] = useState('');
  const [editFoods, setEditFoods] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);

  const meals = [...dayPlan.meals].sort((a, b) => a.time.localeCompare(b.time));

  // Re-schedule today's reminders whenever the meal list changes
  useEffect(() => {
    if (permission === 'granted') {
      scheduleAll(dayPlan.meals, selectedDay, settings.notificationsEnabled);
    }
  }, [dayPlan.meals, selectedDay, permission, scheduleAll, settings.notificationsEnabled]);

  // Deep-link from notification tap
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');
    if (highlightId) {
      window.history.replaceState({}, '', window.location.pathname);
      const tryOpen = () => {
        const found = dayPlan.meals.find((m) => m.id === highlightId);
        if (found) { setSelectedMeal(found); setIsEditing(false); }
      };
      tryOpen();
      setTimeout(tryOpen, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SW message: app already open when notification arrives
  useEffect(() => {
    const handler = (event: MessageEvent<{ type: string; mealId?: string }>) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.mealId) {
        const found = dayPlan.meals.find((m) => m.id === event.data.mealId);
        if (found) { setSelectedMeal(found); setIsEditing(false); }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [dayPlan.meals]);

  // ── Meal helpers ──────────────────────────────────────────────────────────

  const openMeal = useCallback((meal: Meal) => {
    setSelectedMeal(meal);
    setIsEditing(false);
  }, []);

  const startEditing = useCallback(
    (meal: Meal | null) => {
      if (meal) {
        setEditName(meal.name);
        setEditDay(meal.day);
        setEditTime(meal.time);
        setEditFoods(meal.foods.join(', '));
        setEditNotes(meal.notes || '');
        setEditReminderEnabled(meal.reminderEnabled);
        setSelectedMeal(meal);
      } else {
        const now = new Date();
        const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setEditName('');
        setEditDay(selectedDay);
        setEditTime(defaultTime);
        setEditFoods('');
        setEditNotes('');
        setEditReminderEnabled(false);
        setSelectedMeal({
          id: `${selectedDay}-${Date.now()}`,
          day: selectedDay,
          type: 'custom',
          name: '',
          time: defaultTime,
          foods: [],
          notes: '',
          reminderEnabled: false,
          completed: false,
        });
      }
      setIsEditing(true);
    },
    [selectedDay],
  );

  const saveMeal = useCallback(async () => {
    if (!selectedMeal) return;

    let reminderOn = editReminderEnabled;
    if (reminderOn && permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        reminderOn = false;
        toast({
          title: 'Notifications blocked',
          description: 'Enable notifications in device settings to use reminders.',
          variant: 'destructive',
        });
      }
    }

    const isNew = !selectedMeal.name;
    const dayChanged = !isNew && selectedMeal.day !== editDay;

    // Generate a new ID when adding or when moving to a different day
    const newId =
      isNew || dayChanged
        ? `${editDay}-${Date.now()}`
        : selectedMeal.id;

    const updated: Meal = {
      ...selectedMeal,
      id: newId,
      day: editDay,
      name: editName || 'Untitled Meal',
      time: editTime || '12:00',
      foods: editFoods.split(',').map((s) => s.trim()).filter(Boolean),
      notes: editNotes,
      reminderEnabled: reminderOn,
    };

    // Moving a meal changes its stable reminder key.
    if (dayChanged) {
      deleteMeal(selectedMeal.id);
      cancelMeal(selectedMeal.id);
      void removeMealReminder(selectedMeal.id).catch((error) => {
        console.error('[Meals] Failed to remove moved reminder:', error);
      });
    }

    updateMeal(updated);

    // Cancel old timers and schedule new ones if needed
    cancelMeal(updated.id);
    if (reminderOn && permission === 'granted') {
      scheduleMeal(updated, editDay);
      const token = getStoredFcmToken() ?? await requestFcmToken();
      if (token) {
        void syncMealReminder(updated, token).catch((error) => {
          console.error('[Meals] Failed to sync reminder:', error);
          toast({ title: 'Reminder saved locally', description: 'Server sync failed. Try enabling reminders again in Settings.' });
        });
      }
    } else if (!reminderOn) {
      void removeMealReminder(updated.id).catch((error) => {
        console.error('[Meals] Failed to remove reminder:', error);
      });
    }

    setIsEditing(false);
    setSelectedMeal(updated);
  }, [
    selectedMeal, editName, editDay, editTime, editFoods, editNotes, editReminderEnabled,
    permission, requestPermission, requestFcmToken, updateMeal, deleteMeal, cancelMeal, scheduleMeal, toast,
  ]);

  const duplicateMeal = useCallback(() => {
    if (!selectedMeal) return;
    const dup: Meal = {
      ...selectedMeal,
      id: `${selectedMeal.day}-${Date.now()}`,
      name: `${selectedMeal.name} (Copy)`,
      completed: false,
      reminderEnabled: false,
    };
    updateMeal(dup);
    setSelectedMeal(null);
  }, [selectedMeal, updateMeal]);

  const removeMeal = useCallback(() => {
    if (!selectedMeal) return;
    if (!window.confirm(`Delete "${selectedMeal.name}" from the weekly plan? This cannot be undone.`)) return;
    cancelMeal(selectedMeal.id);
    void removeMealReminder(selectedMeal.id).catch((error) => {
      console.error('[Meals] Failed to remove deleted reminder:', error);
    });
    deleteMeal(selectedMeal.id);
    setSelectedMeal(null);
  }, [selectedMeal, cancelMeal, deleteMeal]);

  const toggleReminder = useCallback(
    async (meal: Meal) => {
      const enabled = !meal.reminderEnabled;
      if (enabled && permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          toast({
            title: 'Notifications blocked',
            description: 'Enable notifications in device settings to use reminders.',
            variant: 'destructive',
          });
          return;
        }
      }
      const updated: Meal = { ...meal, reminderEnabled: enabled };
      updateMeal(updated);
      if (enabled) {
        scheduleMeal(updated, meal.day);
        const token = getStoredFcmToken() ?? await requestFcmToken();
        if (token) {
          void syncMealReminder(updated, token).catch((error) => {
            console.error('[Meals] Failed to sync reminder:', error);
          });
        }
        toast({ title: '🔔 Reminder set', description: `You'll be reminded for ${meal.name}.` });
      } else {
        cancelMeal(meal.id);
        void removeMealReminder(meal.id).catch((error) => {
          console.error('[Meals] Failed to remove reminder:', error);
        });
        toast({ title: 'Reminder off', description: `No more reminders for ${meal.name}.` });
      }
      setSelectedMeal(updated);
    },
    [permission, requestPermission, requestFcmToken, updateMeal, scheduleMeal, cancelMeal, toast],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header with weekday strip ──────────────────────────────── */}
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

        {/* Weekday tabs — NO date numbers */}
        <div className="flex justify-between items-center gap-1">
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedDay(key)}
              className={cn(
                'flex items-center justify-center flex-1 h-10 rounded-2xl transition-all text-xs font-bold uppercase tracking-wider',
                selectedDay === key
                  ? 'bg-[#4CAF50] text-white shadow-[0_0_12px_rgba(76,175,80,0.3)]'
                  : key === TODAY_DOW
                  ? 'border border-[#4CAF50] text-[#4CAF50]'
                  : 'bg-[#161B22] border border-[#2d3748] text-gray-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Meal list ──────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay}
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
                <p className="text-gray-500 text-sm mt-1 mb-4">
                  Tap + to add a meal for {DAYS.find((d) => d.key === selectedDay)?.full}.
                </p>
                <Button
                  onClick={() => startEditing(null)}
                  className="bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A]"
                >
                  Add Meal
                </Button>
              </div>
            ) : (
              meals.map((meal) => (
                <div
                  key={meal.id}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border transition-all',
                    meal.completed
                      ? 'bg-[#161B22]/50 border-[#4CAF50]/30'
                      : 'bg-[#161B22] border-[#2d3748]',
                  )}
                >
                  {meal.completed && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4CAF50]" />
                  )}
                  <div className="p-4 flex gap-4">
                    <button
                      onClick={() => toggleMealCompleted(meal.id, !meal.completed)}
                      className={cn(
                        'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 transition-all',
                        meal.completed
                          ? 'bg-[#4CAF50] text-white'
                          : 'border-2 border-[#4CAF50] text-transparent',
                      )}
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    <div className="flex-1 cursor-pointer" onClick={() => openMeal(meal)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-bold text-lg',
                              meal.completed
                                ? 'text-gray-400 line-through decoration-[#4CAF50]/50'
                                : 'text-white',
                            )}
                          >
                            {meal.name}
                          </span>
                          {meal.reminderEnabled && (
                            <Bell className="w-3.5 h-3.5 text-[#4CAF50]" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-[#8BC34A] bg-[#8BC34A]/10 px-2 py-0.5 rounded-md">
                          {meal.time}
                        </span>
                      </div>
                      <ul
                        className={cn(
                          'space-y-1 text-sm mt-2',
                          meal.completed ? 'text-gray-500' : 'text-gray-300',
                        )}
                      >
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

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMeal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60"
              onClick={() => setSelectedMeal(null)}
            />

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
                  {/* Edit header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3748] flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">
                      {selectedMeal.name ? 'Edit Meal' : 'Add Meal'}
                    </h2>
                    <button
                      onClick={() =>
                        selectedMeal.name ? setIsEditing(false) : setSelectedMeal(null)
                      }
                      className="w-8 h-8 rounded-full bg-[#2d3748] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-gray-300" />
                    </button>
                  </div>

                  {/* Edit form */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                    {/* Day selector */}
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Day of Week</label>
                      <div className="flex gap-1 flex-wrap">
                        {DAYS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditDay(key)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all',
                              editDay === key
                                ? 'bg-[#4CAF50] text-white'
                                : 'bg-[#0D1117] border border-[#2d3748] text-gray-400',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-[#0D1117] border-[#2d3748] text-white"
                        placeholder="e.g. Breakfast"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Time</label>
                      <Input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="bg-[#0D1117] border-[#2d3748] text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">
                        Foods (comma separated)
                      </label>
                      <Input
                        value={editFoods}
                        onChange={(e) => setEditFoods(e.target.value)}
                        className="bg-[#0D1117] border-[#2d3748] text-white"
                        placeholder="Eggs, Toast, Milk"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Notes</label>
                      <Input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="bg-[#0D1117] border-[#2d3748] text-white"
                        placeholder="Optional notes"
                      />
                    </div>

                    {/* Reminder toggle */}
                    <div className="bg-[#0D1117] rounded-xl border border-[#2d3748] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-[#4CAF50]" />
                          <span className="text-sm font-medium text-white">Meal Reminder</span>
                        </div>
                        <Switch
                          checked={editReminderEnabled}
                          onCheckedChange={setEditReminderEnabled}
                          className="data-[state=checked]:bg-[#4CAF50]"
                        />
                      </div>
                      {editReminderEnabled && (
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                          You'll be notified 15 min before, at meal time, and 30 min after if
                          not completed.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Edit footer */}
                  <div className="flex gap-3 px-6 py-4 border-t border-[#2d3748] bg-[#0D1117] flex-shrink-0">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent border-[#2d3748] text-white"
                      onClick={() =>
                        selectedMeal.name ? setIsEditing(false) : setSelectedMeal(null)
                      }
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-[#4CAF50] text-[#0D1117] hover:bg-[#8BC34A] font-bold"
                      onClick={() => void saveMeal()}
                    >
                      Save
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* View header */}
                  <div className="flex items-start justify-between px-6 py-4 border-b border-[#2d3748] flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <h2 className="text-2xl font-bold text-white truncate">
                        {selectedMeal.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-[#8BC34A]">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className="font-semibold">{selectedMeal.time}</span>
                        <span className="text-gray-500 text-sm">
                          · every {DAYS.find((d) => d.key === selectedMeal.day)?.full}
                        </span>
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

                  {/* View body */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-5">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Foods
                      </h4>
                      {selectedMeal.foods.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedMeal.foods.map((food, idx) => (
                            <li
                              key={idx}
                              className="bg-[#0D1117] px-4 py-3 rounded-xl border border-[#2d3748] flex items-center gap-3"
                            >
                              <div className="w-2 h-2 rounded-full bg-[#4CAF50] flex-shrink-0" />
                              <span className="text-gray-200 text-sm">{food}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm">No foods added yet.</p>
                      )}
                    </div>

                    {selectedMeal.notes && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Notes
                        </h4>
                        <p className="bg-[#0D1117] px-4 py-3 rounded-xl border border-[#2d3748] text-sm text-gray-300 leading-relaxed">
                          {selectedMeal.notes}
                        </p>
                      </div>
                    )}

                    {/* Reminder toggle */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Reminder
                      </h4>
                      <div
                        className={cn(
                          'rounded-xl border p-4 flex items-center justify-between',
                          selectedMeal.reminderEnabled
                            ? 'bg-[#4CAF50]/10 border-[#4CAF50]/30'
                            : 'bg-[#0D1117] border-[#2d3748]',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {selectedMeal.reminderEnabled ? (
                            <Bell className="w-5 h-5 text-[#4CAF50]" />
                          ) : (
                            <BellOff className="w-5 h-5 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {selectedMeal.reminderEnabled ? 'Reminder on' : 'No reminder'}
                            </p>
                            {selectedMeal.reminderEnabled && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Every {DAYS.find((d) => d.key === selectedMeal.day)?.full} ·
                                15 min before · at meal time · 30 min follow-up
                              </p>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={selectedMeal.reminderEnabled}
                          onCheckedChange={() => void toggleReminder(selectedMeal)}
                          className="data-[state=checked]:bg-[#4CAF50]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="px-6 py-4 border-t border-[#2d3748] bg-[#0D1117] flex-shrink-0">
                    <button
                      data-testid="button-toggle-meal-completed"
                      onClick={() => {
                        toggleMealCompleted(selectedMeal.id, !selectedMeal.completed);
                        setSelectedMeal(null);
                      }}
                      className={cn(
                        'w-full py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98]',
                        selectedMeal.completed
                          ? 'bg-[#2d3748] text-white'
                          : 'bg-[#4CAF50] text-[#0D1117] shadow-[0_4px_14px_rgba(76,175,80,0.3)]',
                      )}
                    >
                      {selectedMeal.completed ? 'Mark as Incomplete' : 'Mark as Completed ✓'}
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
