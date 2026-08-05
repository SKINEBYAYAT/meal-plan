import { useSettings } from '../hooks/useSettings';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, User, Heart, Palette, Download, Upload, Trash2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MEALS_KEY, HABITS_KEY, HABIT_LOGS_KEY, STREAKS_KEY, SETTINGS_KEY } from '../lib/storage';

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { permission, requestPermission } = useNotifications();
  const [name, setName] = useState(settings.userName);
  const { toast } = useToast();

  const handleNameSave = () => {
    updateSettings({ userName: name });
    toast({ title: "Profile updated", description: "Your name has been saved." });
  };

  const exportData = () => {
    const data = {
      meals: localStorage.getItem(MEALS_KEY),
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
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.meals) localStorage.setItem(MEALS_KEY, data.meals);
        if (data.habits) localStorage.setItem(HABITS_KEY, data.habits);
        if (data.logs) localStorage.setItem(HABIT_LOGS_KEY, data.logs);
        if (data.streaks) localStorage.setItem(STREAKS_KEY, data.streaks);
        if (data.settings) localStorage.setItem(SETTINGS_KEY, data.settings);
        
        toast({ title: "Data imported", description: "Your data has been restored successfully. Please refresh the app." });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        toast({ title: "Import failed", description: "Invalid backup file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked && permission !== 'granted') {
      const granted = await requestPermission();
      if (granted) {
        updateSettings({ notificationsEnabled: true });
      } else {
        toast({ title: "Permission denied", description: "Please enable notifications in your browser settings.", variant: "destructive" });
      }
    } else {
      updateSettings({ notificationsEnabled: checked });
    }
  };

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
                  onChange={e => setName(e.target.value)} 
                  className="bg-[#0D1117] border-[#2d3748] h-11"
                />
                <Button onClick={handleNameSave} className="h-11 bg-[#2d3748] text-white hover:bg-[#4CAF50] hover:text-[#0D1117]">Save</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4" /> Preferences
          </h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl divide-y divide-[#2d3748]">
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Meal Reminders</div>
                <div className="text-sm text-gray-400 mt-0.5">Get notified for upcoming meals</div>
              </div>
              <Switch 
                checked={settings.notificationsEnabled} 
                onCheckedChange={handleNotificationToggle} 
                className="data-[state=checked]:bg-[#4CAF50]"
              />
            </div>
            
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
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Data & Backup
          </h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl divide-y divide-[#2d3748]">
            <button onClick={exportData} className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#2d3748]/50 transition-colors">
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
          </div>
        </section>
        
        {/* Info */}
        <div className="pt-8 pb-4 text-center text-gray-500 text-sm flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#4CAF50] flex items-center justify-center mb-3">
             <Heart className="w-6 h-6 text-[#0D1117] fill-[#0D1117]" />
          </div>
          <p className="font-bold text-gray-300">PregnancyTracker v1.0.0</p>
          <p className="mt-1">All data is stored securely on your device.</p>
        </div>

      </div>
    </div>
  );
}
