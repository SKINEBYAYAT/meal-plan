import { useSettings } from '../hooks/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { getAllMealsByDay } from '../hooks/useMeals';
import {
  getPushDiagnostic,
  requestPushSubscription,
  setupAllMealReminders,
  setMasterReminder,
  sendRemoteTestNotification,
} from '../push';
import { Bell, User, Heart, Download, Upload, Trash2, ChevronRight, Bug } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { MEAL_PLAN_KEY, COMPLETIONS_KEY, MEAL_DELETIONS_KEY, HABITS_KEY, HABIT_LOGS_KEY, STREAKS_KEY, SETTINGS_KEY } from '../lib/storage';

const BEIRUT_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const REMINDER_DEFAULTS_SYNC_KEY = 'pregnancy_tracker_reminder_defaults_v1_synced';

function timeInMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function displayMealTime(time: string): string {
  const minutes = timeInMinutes(time);
  if (minutes === null) return time;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function nextReminderLabel(enabled: boolean, now = new Date()): string {
  if (!enabled) return 'None scheduled';
  const meals = Object.values(getAllMealsByDay()).flat().filter((meal) => meal.reminderEnabled);
  if (meals.length === 0) return 'None scheduled';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Beirut', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = BEIRUT_DAYS.indexOf(values.weekday.toLowerCase());
  if (today < 0) return 'None scheduled';
  const currentMinutes = Number(values.hour === '24' ? '0' : values.hour) * 60 + Number(values.minute);
  const currentWeekMinute = today * MINUTES_PER_DAY + currentMinutes;
  let next: (typeof meals)[number] | null = null;
  let shortestWait = Number.POSITIVE_INFINITY;

  for (const meal of meals) {
    const day = BEIRUT_DAYS.indexOf(meal.day);
    const mealMinutes = timeInMinutes(meal.time);
    if (day < 0 || mealMinutes === null) continue;
    const mealWeekMinute = day * MINUTES_PER_DAY + mealMinutes;
    const wait = (mealWeekMinute - currentWeekMinute + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (wait < shortestWait) {
      next = meal;
      shortestWait = wait;
    }
  }

  return next ? `${next.name} · ${displayMealTime(next.time)}` : 'None scheduled';
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { permission, requestPermission } = useNotifications();
  const [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<typeof getPushDiagnostic>> | null>(null);
  const [pushResult, setPushResult] = useState('');
  const [settingUpReminders, setSettingUpReminders] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [name, setName] = useState(settings.userName);
  const syncingReminderDefaults = useRef(false);
  const { toast } = useToast();

  const refreshDiagnostics = useCallback(async () => {
    try {
      const next = await getPushDiagnostic();
      setDiagnostics(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPushResult(message);
      return null;
    }
  }, []);
  useEffect(() => { void refreshDiagnostics(); }, [refreshDiagnostics]);
  useEffect(() => {
    const canReconcile = diagnostics?.masterEnabled
      && diagnostics.subscription === 'registered'
      && diagnostics.backendDevice === 'registered';
    if (!canReconcile
      || syncingReminderDefaults.current
      || localStorage.getItem(REMINDER_DEFAULTS_SYNC_KEY) === 'true') return;

    syncingReminderDefaults.current = true;
    const meals = Object.values(getAllMealsByDay()).flat();
    void setupAllMealReminders(meals)
      .then(async () => {
        localStorage.setItem(REMINDER_DEFAULTS_SYNC_KEY, 'true');
        await refreshDiagnostics();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setSetupError(message);
      })
      .finally(() => {
        syncingReminderDefaults.current = false;
      });
  }, [diagnostics?.backendDevice, diagnostics?.masterEnabled, diagnostics?.subscription, refreshDiagnostics]);

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
    if (settingUpReminders) return;
    setSettingUpReminders(true);
    setSetupError('');
    try {
      if (checked) {
        const granted = permission === 'granted' || await requestPermission();
        if (!granted) {
          const denialMessage = 'Notification permission denied';
          setSetupError(denialMessage);
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

        const meals = Object.values(getAllMealsByDay()).flat();
        await setupAllMealReminders(meals);
        localStorage.setItem(REMINDER_DEFAULTS_SYNC_KEY, 'true');
        const registeredState = await getPushDiagnostic();
        if (registeredState.backendDevice !== 'registered') throw new Error('Backend device lookup failed after subscription POST');
        await setMasterReminder(true);
        const enabledState = await getPushDiagnostic();
        if (!enabledState.masterEnabled) throw new Error('Backend did not save master_enabled = true');
        setDiagnostics(enabledState);
        updateSettings({ notificationsEnabled: true });
        toast({ title: 'Meal reminders enabled', description: 'Enabled meals are now scheduled for this device.' });
      } else {
        await setMasterReminder(false);
        const disabledState = await getPushDiagnostic();
        if (disabledState.masterEnabled) throw new Error('Backend did not save master_enabled = false');
        setDiagnostics(disabledState);
        updateSettings({ notificationsEnabled: false });
      }
    } catch (error) {
      console.error('[Settings] Failed to update meal reminders:', error);
      const message = error instanceof Error ? error.message : 'Notification setup failed. Please try again.';
      setSetupError(message);
      toast({
        title: 'Could not enable reminders',
        description: message,
        variant: 'destructive',
      });
      updateSettings({ notificationsEnabled: false });
      await refreshDiagnostics();
    } finally {
      setSettingUpReminders(false);
    }
  };

  const handleTestNotification = useCallback(async () => {
    try {
      const subscription = await requestPushSubscription();
      if (!subscription) throw new Error('Notification permission denied');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPushResult(message);
      toast({ title: 'Test notification failed', description: message, variant: 'destructive' });
      return;
    }
    try {
      const result = await sendRemoteTestNotification();
      const detail = JSON.stringify(result);
      setPushResult(detail);
      toast({ title: 'Test notification sent', description: detail });
    } catch (err) {
      console.error('[Settings] Failed to send test notification:', err);
      const message = err instanceof Error ? err.message : String(err);
      setPushResult(message);
      toast({ title: 'Test notification failed', description: message, variant: 'destructive' });
    }
    await refreshDiagnostics();
  }, [refreshDiagnostics, toast]);


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
                checked={Boolean(diagnostics?.masterEnabled && diagnostics.backendDevice === 'registered' && diagnostics.subscription === 'registered' && diagnostics.permission === 'granted')}
                onCheckedChange={handleNotificationToggle}
                disabled={settingUpReminders}
                className="data-[state=checked]:bg-[#4CAF50]"
              />
            </div>
            {settingUpReminders && <div className="px-4 pb-3 text-xs text-blue-300">Setting up...</div>}
            {setupError && !settingUpReminders && <div className="px-4 pb-3 text-xs text-red-400 break-words">Last setup error: {setupError}</div>}

            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-400">
              <span>PWA Installed</span><strong className="text-right text-gray-200">{diagnostics?.pwaInstalled ? 'Yes' : 'No'}</strong>
              <span>Notifications Supported</span><strong className="text-right text-gray-200">{diagnostics?.supported ? 'Yes' : 'No'}</strong>
              <span>Permission</span><strong className="text-right text-gray-200">{diagnostics?.permission ?? permission}</strong>
              <span>Service Worker</span><strong className="text-right text-gray-200">{diagnostics?.serviceWorker ?? 'inactive'}</strong>
              <span>Push Subscription</span><strong className="text-right text-gray-200">{diagnostics?.subscription ?? 'missing'}</strong>
              <span>Backend Device Record</span><strong className="text-right text-gray-200">{diagnostics?.backendDevice ?? 'missing'}</strong>
              <span>Master Meal Reminders</span><strong className="text-right text-gray-200">{diagnostics?.masterEnabled ? 'on' : 'off'}</strong>
              <span>Next reminder</span><strong className="text-right text-gray-200">{nextReminderLabel(Boolean(diagnostics?.masterEnabled))}</strong>
              <span>SW Registrations</span><strong className="text-right text-gray-200">{diagnostics?.registrationCount ?? 0}</strong>
              <span>SW Script URL</span><strong className="text-right text-gray-200 break-all">{diagnostics?.scriptUrl ?? 'none'}</strong>
              <span>SW Scope</span><strong className="text-right text-gray-200 break-all">{diagnostics?.scope ?? 'none'}</strong>
              <span>Installing State</span><strong className="text-right text-gray-200">{diagnostics?.installingState ?? 'none'}</strong>
              <span>Waiting State</span><strong className="text-right text-gray-200">{diagnostics?.waitingState ?? 'none'}</strong>
              <span>Active State</span><strong className="text-right text-gray-200">{diagnostics?.activeState ?? 'none'}</strong>
              <span>Controller Present</span><strong className="text-right text-gray-200">{diagnostics?.controllerPresent ? 'Yes' : 'No'}</strong>
              <span>PushManager Available</span><strong className="text-right text-gray-200">{diagnostics?.pushManagerAvailable ? 'Yes' : 'No'}</strong>
              <span>VAPID Public Key Loaded</span><strong className="text-right text-gray-200">{diagnostics?.vapidPublicKeyLoaded ? 'Yes' : 'No'}</strong>
              <span>Subscription POST</span><strong className="text-right text-gray-200 break-words">{diagnostics?.subscriptionPostStatus ?? 'not attempted'}</strong>
              <span>Backend Lookup</span><strong className="text-right text-gray-200 break-words">{diagnostics?.backendLookupStatus ?? 'not attempted'}</strong>
              <span>Last Setup Error</span><strong className="text-right text-gray-200 break-words">{setupError || diagnostics?.lastSetupError || 'none'}</strong>
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
            {pushResult && <div className="px-4 pb-3 text-xs text-gray-300 break-words">Backend result: {pushResult}</div>}

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
