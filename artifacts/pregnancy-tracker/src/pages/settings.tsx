import { useSettings } from '../hooks/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useMeals, getAllMealsByDay } from '../hooks/useMeals';
import {
  getStoredFcmToken,
  removeMealReminder,
  requestNotificationPermission,
  sendRemoteTestNotification,
  syncMealReminder,
} from '../firebase';
import { Bell, User, Heart, Download, Upload, Trash2, ChevronRight, Bug } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { MEAL_PLAN_KEY, COMPLETIONS_KEY, MEAL_DELETIONS_KEY, HABITS_KEY, HABIT_LOGS_KEY, STREAKS_KEY, SETTINGS_KEY } from '../lib/storage';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { updateMeal } = useMeals('monday');
  const { permission, isSupported, swStatus, requestPermission, getDebugInfo } = useNotifications();
  const [name, setName] = useState(settings.userName);
  const [fcmLoading, setFcmLoading] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState(() => getDebugInfo());
  const { toast } = useToast();

  useEffect(() => {
    setNotificationInfo(getDebugInfo());
    const timer = window.setInterval(() => setNotificationInfo(getDebugInfo()), 30000);
    return () => window.clearInterval(timer);
  }, [getDebugInfo]);

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
    if (checked && permission !== 'granted') {
      const granted = await requestPermission();
      if (granted) {
        updateSettings({ notificationsEnabled: true });
        toast({ title: 'Notifications enabled 🔔', description: 'Turn on reminders per meal in the Meals tab.' });
      } else {
        toast({
          title: 'Permission denied',
          description:
            permission === 'denied'
              ? 'Go to iOS Settings → Safari → Notifications to re-enable.'
              : 'Please allow notifications when prompted.',
          variant: 'destructive',
        });
      }
    } else {
      updateSettings({ notificationsEnabled: checked });
    }
  };

  const handleEnableReminders = useCallback(async () => {
    setFcmLoading(true);
    const token = await requestNotificationPermission();
    console.log('[Settings] FCM token result:', token);
    if (token) {
      try {
        const meals = Object.values(getAllMealsByDay()).flat();
        await Promise.all(
          meals.filter((meal) => meal.reminderEnabled).map((meal) => syncMealReminder(meal, token)),
        );
        updateSettings({ notificationsEnabled: true });
        toast({ title: 'Reminders enabled 🔔', description: 'Device registered for push notifications.' });
      } catch (err) {
        console.error('[Settings] Failed to sync reminders:', err);
        toast({ title: 'Could not sync reminders', description: 'Check your connection and try again.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Could not enable reminders', description: 'Check the console for details.', variant: 'destructive' });
    }
    setFcmLoading(false);
  }, [toast, updateSettings]);

  const handleTestNotification = useCallback(async () => {
    const token = getStoredFcmToken() ?? await requestNotificationPermission();
    if (!token) {
      toast({ title: 'Could not enable reminders', description: 'Grant notification permission first.', variant: 'destructive' });
      return;
    }
    try {
      await sendRemoteTestNotification(token);
      toast({ title: 'Test notification sent', description: 'Check your notification tray.' });
    } catch (err) {
      console.error('[Settings] Failed to send test notification:', err);
      toast({ title: 'Test notification failed', description: 'Check your connection and Firebase configuration.', variant: 'destructive' });
    }
  }, [toast]);

  const handleAllReminders = useCallback(async (enabled: boolean) => {
    let token = getStoredFcmToken();
    if (enabled && !token) token = await requestNotificationPermission();
    if (enabled && !token) {
      toast({ title: 'Permission required', description: 'Enable notifications before enabling reminders.', variant: 'destructive' });
      return;
    }
    const meals = Object.values(getAllMealsByDay()).flat();
    try {
      for (const meal of meals) {
        const updated = { ...meal, reminderEnabled: enabled };
        if (enabled && token) await syncMealReminder(updated, token);
        if (!enabled) await removeMealReminder(meal.id);
        updateMeal(updated);
      }
    } catch (error) {
      console.error('[Settings] Failed to update all reminders:', error);
      toast({ title: 'Could not update all reminders', description: 'Try again when connected.', variant: 'destructive' });
      return;
    }
    updateSettings({ notificationsEnabled: enabled });
  }, [requestPermission, removeMealReminder, syncMealReminder, toast, updateMeal, updateSettings]);

  const permissionLabel =
    permission === 'granted' ? 'Granted ✓' :
    permission === 'denied'  ? 'Denied — change in Settings' :
    'Not requested';

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
                  {isSupported ? permissionLabel : 'Not supported in this browser'}
                </div>
              </div>
              <Switch
                checked={settings.notificationsEnabled && permission === 'granted'}
                onCheckedChange={handleNotificationToggle}
                disabled={!isSupported}
                className="data-[state=checked]:bg-[#4CAF50]"
              />
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm font-medium">All meal reminders</div>
              <div className="flex gap-2">
                <Button onClick={() => void handleAllReminders(true)} variant="outline" className="h-9 flex-1 border-[#2d3748]">Enable All</Button>
                <Button onClick={() => void handleAllReminders(false)} variant="outline" className="h-9 flex-1 border-[#2d3748]">Disable All</Button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-400">
              <span>Notifications Supported</span><strong className="text-right text-gray-200">{isSupported ? 'Yes' : 'No'}</strong>
              <span>Permission Status</span><strong className="text-right text-gray-200">{permissionLabel}</strong>
              <span>FCM Token Status</span><strong className="text-right text-gray-200">{getStoredFcmToken() ? 'Registered' : 'Not registered'}</strong>
              <span>Push Service Status</span><strong className="text-right text-gray-200">{swStatus}</strong>
              <span>Next Meal Reminder</span><strong className="text-right text-gray-200">{notificationInfo.upcoming ? `${notificationInfo.upcoming.mealName} at ${new Date(notificationInfo.upcoming.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'None scheduled'}</strong>
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

            {/* Enable Reminders via FCM */}
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Enable Reminders</div>
                <div className="text-sm text-gray-400 mt-0.5">Register for push notifications</div>
              </div>
              <Button
                onClick={handleEnableReminders}
                disabled={fcmLoading}
                className="h-9 px-4 text-sm bg-[#4CAF50] text-[#0D1117] hover:bg-[#66BB6A] disabled:opacity-50"
              >
                {fcmLoading ? 'Requesting…' : 'Enable'}
              </Button>
            </div>

            {/* Link to debug page */}
            <Link href="/notifications-debug">
              <div className="flex items-center gap-3 p-4 hover:bg-[#2d3748]/50 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center">
                  <Bug className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Notification Debug</div>
                  <div className="text-xs text-gray-400">Status, test, and reschedule</div>
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
