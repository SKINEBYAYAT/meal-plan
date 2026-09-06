import { useSettings } from '../hooks/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { getAllMealsByDay, setAllMealRemindersEnabled } from '../hooks/useMeals';
import {
  requestPushSubscription,
  setMasterReminder,
  sendRemoteTestNotification,
  syncMealReminder,
} from '../push';
import { Bell, User, Heart, Download, Upload, Trash2, ChevronRight, Bug } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { MEAL_PLAN_KEY, COMPLETIONS_KEY, MEAL_DELETIONS_KEY, HABITS_KEY, HABIT_LOGS_KEY, STREAKS_KEY, SETTINGS_KEY } from '../lib/storage';

const BEIRUT_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function nextReminderLabel(enabled: boolean): string {
  if (!enabled) return 'None scheduled';
  const meals = Object.values(getAllMealsByDay()).flat().filter((meal) => meal.reminderEnabled);
  if (meals.length === 0) return 'None scheduled';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Beirut', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = BEIRUT_DAYS.indexOf(values.weekday.toLowerCase());
  const currentMinutes = Number(values.hour === '24' ? '0' : values.hour) * 60 + Number(values.minute);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = BEIRUT_DAYS[(today + offset) % 7];
    const candidate = meals.filter((meal) => meal.day === day && (offset > 0 || meal.time > `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`)).sort((a, b) => a.time.localeCompare(b.time))[0];
    if (candidate) {
      const [hour, minute] = candidate.time.split(':').map(Number);
      const formatted = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `${candidate.name} · ${formatted}`;
    }
  }
  return 'None scheduled';
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { permission, isSupported, swStatus, requestPermission } = useNotifications();
  const [name, setName] = useState(settings.userName);
  const { toast } = useToast();

  const handleNameSave = () => {
    updateSettings({ userName: name });
    toast({ title: 'Profile updated', description: 'Your name has been saved.' });
  };

  const exportData = () => {
    const data = {
      mealPlan: localStorage.getItem(MEAL_PLAN_KEY),
      mealCompletions: localStorage.getItem(COMPLETIONS_KEY),
      habits: localStorage.getItem(HABITS_KEY),
      logs: localStorage.getItem(HABIT_LOGS_KEY),
      streaks: localStorage.getItem(STREAKS_KEY),
      settings: localStorage.getItem(SETTINGS_KEY),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pregnancy-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        // Current backup schema (created after key migration)
        if (data.mealPlan) localStorage.setItem(MEAL_PLAN_KEY, data.mealPlan);
        if (data.mealCompletions) localStorage.setItem(COMPLETIONS_KEY, data.mealCompletions);
        // Legacy backup schema — `meals` field mapped to new plan key
        if (!data.mealPlan && data.meals) localStorage.setItem(MEAL_PLAN_KEY, data.meals);
        // Habits / streaks / settings keys are unchanged across versions
        if (data.habits) localStorage.setItem(HABITS_KEY, data.habits);
        if (data.logs) localStorage.setItem(HABIT_LOGS_KEY, data.logs);
        if (data.streaks) localStorage.setItem(STREAKS_KEY, data.streaks);
        if (data.settings) localStorage.setItem(SETTINGS_KEY, data.settings);
        toast({ title: 'Data imported', description: 'Your data has been restored. Refreshing…' });
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast({ title: 'Import failed', description: 'Invalid backup file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const handleNotificationToggle = async (checked: boolean) => {
    try {
      if (checked) {
        const granted = permission === 'granted' || await requestPermission();
        if (!granted) {
          toast({
            title: 'Permission denied',
            description:
              permission === 'denied'
                ? 'Go to device settings and allow notifications for this app.'
                : 'Please allow notifications when prompted.',
            variant: 'destructive',
          });
          return;
        }

        const subscription = await requestPushSubscription();
        if (!subscription) {
          toast({ title: 'Notifications unavailable', description: 'Web Push could not register this device.', variant: 'destructive' });
          return;
        }

        const meals = setAllMealRemindersEnabled(true);
        await Promise.all(meals.map((meal) => syncMealReminder(meal)));
        await setMasterReminder(true);
        updateSettings({ notificationsEnabled: true });
        await sendRemoteTestNotification();
        toast({ title: 'Meal reminders enabled', description: 'A test notification was sent and all meals are scheduled.' });
      } else {
        await setMasterReminder(false);
        updateSettings({ notificationsEnabled: false });
      }
    } catch (error) {
      console.error('[Settings] Failed to update meal reminders:', error);
      toast({
        title: 'Could not enable reminders',
        description: error instanceof Error ? error.message : 'Notification setup failed. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = useCallback(async () => {
    try {
      await requestPushSubscription();
    } catch (error) {
      toast({ title: 'Could not enable reminders', description: 'Grant notification permission first.', variant: 'destructive' });
      return;
    }
    try {
      await sendRemoteTestNotification();
      toast({ title: 'Test notification sent', description: 'Check your notification tray.' });
    } catch (err) {
      console.error('[Settings] Failed to send test notification:', err);
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Test notification failed', description: message, variant: 'destructive' });
    }
  }, [toast]);


  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-[#0D1117]/95 backdrop-blur-sm border-b border-[#2d3748] px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
      </div>

      <div className="p-4 space-y-8 flex-1">

        {/* Profile */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-4 space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Your Name</label>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#0D1117] border-[#2d3748] h-11"
                />
                <Button
                  onClick={handleNameSave}
                  className="h-11 bg-[#2d3748] text-white hover:bg-[#4CAF50] hover:text-[#0D1117]"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl divide-y divide-[#2d3748]">
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Meal Reminders</div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Get notified when meals are due
                </div>
              </div>
              <Switch
                checked={settings.notificationsEnabled && permission === 'granted'}
                onCheckedChange={handleNotificationToggle}
                disabled={!isSupported}
                className="data-[state=checked]:bg-[#4CAF50]"
              />
            </div>

            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-400">
              <span>Push notifications</span><strong className="text-right text-gray-200">{isSupported && permission === 'granted' && swStatus === 'registered' ? 'Ready' : 'Not ready'}</strong>
              <span>Next reminder</span><strong className="text-right text-gray-200">{nextReminderLabel(settings.notificationsEnabled)}</strong>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Send Test Notification</div>
                <div className="text-sm text-gray-400 mt-0.5">Verify server push delivery</div>
              </div>
              <Button onClick={() => void handleTestNotification()} className="h-9 px-4 text-sm bg-[#2d3748] text-white hover:bg-[#4CAF50]">
                Test
              </Button>
            </div>

            {permission === 'denied' && (
              <div className="px-4 py-3 bg-amber-500/5">
                <p className="text-xs text-amber-400 leading-relaxed">
                  Notifications are blocked. On iPhone: <strong>Settings → Safari → Notifications</strong> → enable for this site.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Motivational Quotes</div>
                <div className="text-sm text-gray-400 mt-0.5">Show daily inspiration on home</div>
              </div>
              <Switch
                checked={settings.motivationalMessages}
                onCheckedChange={(checked) => updateSettings({ motivationalMessages: checked })}
                className="data-[state=checked]:bg-[#4CAF50]"
              />
            </div>

            {/* Link to debug page */}
            <Link href="/notifications-debug">
              <div className="flex items-center gap-3 p-4 hover:bg-[#2d3748]/50 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center">
                  <Bug className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Notification Debug</div>
                  <div className="text-xs text-gray-400">Development tools</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </Link>
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4" /> Preferences
          </h2>
          <div className={cn('bg-[#161B22] border border-[#2d3748] rounded-2xl divide-y divide-[#2d3748]')}>
            {/* placeholder for future preferences */}
            <div className="p-4 text-sm text-gray-500 text-center">More options coming soon</div>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Data & Backup
          </h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl divide-y divide-[#2d3748]">
            <button
              onClick={exportData}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#2d3748]/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center">
                <Download className="w-4 h-4 text-[#8BC34A]" />
              </div>
              <div>
                <div className="font-medium">Export Backup</div>
                <div className="text-xs text-gray-400">Save your data to a file</div>
              </div>
            </button>

            <label className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#2d3748]/50 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center">
                <Upload className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="font-medium">Import Backup</div>
                <div className="text-xs text-gray-400">Restore from a file</div>
              </div>
              <input type="file" accept=".json" className="hidden" onChange={importData} />
            </label>

            <button
              onClick={() => {
                if (confirm('Delete all data? This cannot be undone.')) {
                  [
                    MEAL_PLAN_KEY, COMPLETIONS_KEY, MEAL_DELETIONS_KEY,
                    HABITS_KEY, HABIT_LOGS_KEY, STREAKS_KEY, SETTINGS_KEY,
                    // legacy keys that may still be present from older versions
                    'pregnancy_tracker_meals_v2', 'pregnancy_tracker_meals',
                    'pregnancy_tracker_completions',
                  ].forEach((k) => localStorage.removeItem(k));
                  window.location.reload();
                }
              }}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-500/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <div className="font-medium text-red-400">Clear All Data</div>
                <div className="text-xs text-gray-400">Permanently delete everything</div>
              </div>
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 pb-4 text-center text-gray-500 text-sm flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center mb-3">
            <Heart className="w-6 h-6 text-[#0D1117] fill-[#0D1117]" />
          </div>
          <p className="font-bold text-gray-300">PregnancyTracker v1.1.0</p>
          <p className="mt-1">All data is stored securely on your device.</p>
        </div>
      </div>
    </div>
  );
}
