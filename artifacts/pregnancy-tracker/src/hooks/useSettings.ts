import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { getFromStorage, setToStorage, SETTINGS_KEY } from '../lib/storage';

const DEFAULT_SETTINGS: AppSettings = {
  userName: 'Mama',
  notificationsEnabled: false,
  motivationalMessages: true,
  accentColor: '#4CAF50',
};

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(() => 
    getFromStorage<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  );

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      setToStorage(SETTINGS_KEY, updated);
      return updated;
    });
  };

  return { settings, updateSettings };
}
