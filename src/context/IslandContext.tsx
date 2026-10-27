import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  IslandState,
  AppNotification,
  WeatherData,
  CalendarEvent,
  UserSettings,
  AudioPlaybackState,
} from '../types';

interface IslandContextType {
  state: IslandState;
  setState: (state: IslandState) => void;
  activeNotification: AppNotification | null;
  notifications: AppNotification[];
  pushNotification: (notification: Omit<AppNotification, 'id' | 'receivedAt'>) => void;
  dismissNotification: (id?: string) => void;
  clearAllNotifications: () => void;
  weather: WeatherData | null;
  weatherLoading: boolean;
  weatherError: string | null;
  refreshWeather: () => Promise<void>;
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
  audioPlayback: AudioPlaybackState | null;
  setAudioPlayback: React.Dispatch<React.SetStateAction<AudioPlaybackState | null>>;
  activeTab: 'all' | 'weather' | 'calendar' | 'notifications' | 'settings';
  setActiveTab: (tab: 'all' | 'weather' | 'calendar' | 'notifications' | 'settings') => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  autostartEnabled: true,
  alwaysOnTopEnabled: true,
  expandTrigger: 'hover',
  targetMonitor: 'primary',
  weatherLocation: {
    name: 'Jakarta, Indonesia',
    latitude: -6.2088,
    longitude: 106.8456,
  },
  weatherRefreshInterval: 30, // 30 min
  notificationAllowlist: [],
  notificationBlocklist: [],
  hideNotificationContent: false,
  notificationDisplayDuration: 5, // 5 seconds
  reducedMotionEnabled: false,
  backgroundOpacity: 80,
  backgroundBlur: 20,
};
const DEFAULT_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Team Sync & Product Review',
    startAt: Date.now() + 1000 * 60 * 45, // in 45 mins
    endAt: Date.now() + 1000 * 60 * 105,
    location: 'Google Meet',
    reminderMinutes: 10,
    color: '#3b82f6',
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 100000,
  },
  {
    id: 'evt-2',
    title: 'Windows 11 Widget Testing',
    startAt: Date.now() + 1000 * 60 * 180, // in 3 hours
    endAt: Date.now() + 1000 * 60 * 240,
    location: 'Local Workstation',
    reminderMinutes: 15,
    color: '#10b981',
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 100000,
  },
  {
    id: 'evt-3',
    title: 'Deploy Dynamic Island v1.0',
    startAt: Date.now() + 1000 * 60 * 60 * 24, // tomorrow
    endAt: Date.now() + 1000 * 60 * 60 * 25,
    location: 'GitHub Release',
    reminderMinutes: 30,
    color: '#8b5cf6',
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 100000,
  },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-wa-1',
    appId: 'com.whatsapp.desktop',
    appName: 'WhatsApp',
    title: 'Budi Pratama',
    body: 'Bro, aplikasinya udah smooth banget! Animasi kapsulnya keren.',
    receivedAt: Date.now() - 1000 * 60 * 2,
    unread: true,
  },
  {
    id: 'notif-sys-2',
    appId: 'windows.system',
    appName: 'Windows Security',
    title: 'Protection definition updated',
    body: 'Your system is secure and up to date.',
    receivedAt: Date.now() - 1000 * 60 * 25,
    unread: false,
  },
];

const DEFAULT_AUDIO_PLAYBACK: AudioPlaybackState = {
  title: 'Starboy',
  artist: 'The Weeknd, Daft Punk',
  isPlaying: true,
  progress: 0.38,
  duration: 230,
  sourceApp: 'spotify',
};

const IslandContext = createContext<IslandContextType | undefined>(undefined);

export const IslandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<IslandState>('compact');
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('di_notifications');
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });
  const [activeNotification, setActiveNotification] = useState<AppNotification | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('di_events');
      return saved ? JSON.parse(saved) : DEFAULT_EVENTS;
    } catch {
      return DEFAULT_EVENTS;
    }
  });
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('di_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [activeTab, setActiveTab] = useState<'all' | 'weather' | 'calendar' | 'notifications' | 'settings'>('all');
  const [audioPlayback, setAudioPlayback] = useState<AudioPlaybackState | null>(DEFAULT_AUDIO_PLAYBACK);
  const dismissTimerRef = useRef<number | undefined>(undefined);

  // Save settings to local storage
  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('di_settings', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
      return updated;
    });
  }, []);

  // Save events to local storage
  useEffect(() => {
    try {
      localStorage.setItem('di_events', JSON.stringify(events));
    } catch (err) {
      console.error('Failed to persist events:', err);
    }
  }, [events]);

  // Save notifications to local storage
  useEffect(() => {
    try {
      localStorage.setItem('di_notifications', JSON.stringify(notifications));
    } catch (err) {
      console.error('Failed to persist notifications:', err);
    }
  }, [notifications]);

  // Weather fetching with Open-Meteo
  const refreshWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const { latitude, longitude, name } = settings.weatherLocation;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Weather API error (${res.status})`);
      const data = await res.json();

      const current = data.current;
      const daily = data.daily;

      const codeMap: Record<number, string> = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snowfall',
        73: 'Moderate snowfall',
        75: 'Heavy snowfall',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
      };

      const weatherObj: WeatherData = {
        locationName: name,
        temperature: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        weatherCode: current.weather_code,
        weatherDescription: codeMap[current.weather_code] || 'Partly cloudy',
        tempMin: daily?.temperature_2m_min?.[0] ? Math.round(daily.temperature_2m_min[0]) : undefined,
        tempMax: daily?.temperature_2m_max?.[0] ? Math.round(daily.temperature_2m_max[0]) : undefined,
        windSpeed: current.wind_speed_10m,
        updatedAt: Date.now(),
      };

      setWeather(weatherObj);
      localStorage.setItem('di_weather_cache', JSON.stringify(weatherObj));
    } catch (err: unknown) {
      console.warn('Weather fetch failed, falling back to cache:', err);
      // Try cache
      const cached = localStorage.getItem('di_weather_cache');
      if (cached) {
        setWeather(JSON.parse(cached));
      } else {
        // Fallback default
        setWeather({
          locationName: settings.weatherLocation.name,
          temperature: 29,
          feelsLike: 32,
          humidity: 78,
          weatherCode: 2,
          weatherDescription: 'Partly cloudy',
          tempMin: 24,
          tempMax: 33,
          windSpeed: 12,
          updatedAt: Date.now(),
        });
      }
      setWeatherError(err instanceof Error ? err.message : 'Failed to update weather');
    } finally {
      setWeatherLoading(false);
    }
  }, [settings.weatherLocation]);

  // Initial weather load and periodic timer
  useEffect(() => {
    refreshWeather();
    const intervalMs = Math.max(5, settings.weatherRefreshInterval) * 60 * 1000;
    const timer = setInterval(refreshWeather, intervalMs);
    return () => clearInterval(timer);
  }, [refreshWeather, settings.weatherRefreshInterval]);

  // Push new notification
  const pushNotification = useCallback(
    (notifData: Omit<AppNotification, 'id' | 'receivedAt'>) => {
      // Check blocklist
      if (settings.notificationBlocklist.includes(notifData.appId)) {
        return;
      }
      // Check allowlist if configured
      if (
        settings.notificationAllowlist.length > 0 &&
        !settings.notificationAllowlist.includes(notifData.appId)
      ) {
        return;
      }

      const newNotif: AppNotification = {
        ...notifData,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        receivedAt: Date.now(),
        unread: true,
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
      setActiveNotification(newNotif);

      // Transition to notification state only if not already expanded
      setState((currentState) => {
        if (currentState !== 'expanded') {
          return 'notification';
        }
        return currentState;
      });

      // Clear any previous dismiss timer
      clearTimeout(dismissTimerRef.current);

      // Auto dismiss notification state after displayDuration seconds
      const duration = (settings.notificationDisplayDuration || 5) * 1000;
      dismissTimerRef.current = setTimeout(() => {
        setState((current) => (current === 'notification' ? 'compact' : current));
        setActiveNotification(null);
      }, duration);
    },
    [settings.notificationAllowlist, settings.notificationBlocklist, settings.notificationDisplayDuration]
  );
  // Listen for native Windows notifications when running in Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{
          id: string;
          app_id: string;
          app_name: string;
          title: string;
          body: string;
          received_at: number;
        }>('windows-notification', (event) => {
          const payload = event.payload;
          pushNotification({
            appId: payload.app_id,
            appName: payload.app_name,
            title: payload.title,
            body: payload.body,
          });
        }).then((unlistenFn) => {
          unlisten = unlistenFn;
        });
        listen<{
          title: string;
          artist: string;
          is_playing: boolean;
          progress: number;
          duration: number;
          source_app?: string;
        }>('windows-media-change', (event) => {
          const p = event.payload;
          if (p.is_playing && p.title) {
            setAudioPlayback({
              title: p.title,
              artist: p.artist || 'Unknown Artist',
              isPlaying: p.is_playing,
              progress: p.progress,
              duration: p.duration,
              sourceApp: p.source_app,
            });
          } else if (!p.is_playing && p.title) {
            setAudioPlayback((prev) =>
              prev ? { ...prev, isPlaying: false, title: p.title, artist: p.artist, sourceApp: p.source_app ?? prev.sourceApp } : null
            );
          } else {
            setAudioPlayback(null);
          }
        });
        listen<{
          text: string;
          char_count: number;
          timestamp: number;
        }>('windows-clipboard-copied', (event) => {
          const { text, char_count } = event.payload;
          const isUrl = /^https?:\/\//i.test(text.trim());
          pushNotification({
            appId: 'system.clipboard',
            appName: 'Clipboard',
            title: isUrl ? 'Copied Link' : 'Copied to Clipboard',
            body: `${text.slice(0, 100)}${text.length > 100 ? '...' : ''} (${char_count} chars)`,
          });
        });
        listen('tray-open-settings', () => {
          setState('expanded');
          setActiveTab('settings');
        });
        listen<'hover' | 'click'>('tray-set-interaction', (event) => {
          updateSettings({ expandTrigger: event.payload });
        });
        listen('tray-toggle-always-on-top', () => {
          setSettings((prev) => {
            const updated = { ...prev, alwaysOnTopEnabled: !prev.alwaysOnTopEnabled };
            try {
              localStorage.setItem('di_settings', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        });
        listen('tray-toggle-reduced-motion', () => {
          setSettings((prev) => {
            const updated = { ...prev, reducedMotionEnabled: !prev.reducedMotionEnabled };
            try {
              localStorage.setItem('di_settings', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        });
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [pushNotification]);

  // Sync settings with native Tauri backend
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('set_always_on_top', { enabled: settings.alwaysOnTopEnabled }).catch(console.error);
        invoke('set_autostart_enabled', { enabled: settings.autostartEnabled }).catch(console.error);
      });
    }
  }, [settings.alwaysOnTopEnabled, settings.autostartEnabled]);

  const dismissNotification = useCallback((id?: string) => {
    clearTimeout(dismissTimerRef.current);
    if (id) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
      );
    }
    setActiveNotification(null);
    setState((current) => (current === 'notification' ? 'compact' : current));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setActiveNotification(null);
    setState((current) => (current === 'notification' ? 'compact' : current));
  }, []);

  // Calendar CRUD
  const addEvent = useCallback((eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: `evt-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEvents((prev) => [...prev, newEvent].sort((a, b) => a.startAt - b.startAt));
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setEvents((prev) =>
      prev
        .map((evt) => (evt.id === id ? { ...evt, ...updates, updatedAt: Date.now() } : evt))
        .sort((a, b) => a.startAt - b.startAt)
    );
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((evt) => evt.id !== id));
  }, []);

  return (
    <IslandContext.Provider
      value={{
        state,
        setState,
        activeNotification,
        notifications,
        pushNotification,
        dismissNotification,
        clearAllNotifications,
        weather,
        weatherLoading,
        weatherError,
        refreshWeather,
        events,
        addEvent,
        updateEvent,
        deleteEvent,
        settings,
        updateSettings,
        audioPlayback,
        setAudioPlayback,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </IslandContext.Provider>
  );
};

export const useIsland = () => {
  const context = useContext(IslandContext);
  if (!context) {
    throw new Error('useIsland must be used within an IslandProvider');
  }
  return context;
};
