import { DEFAULT_WEATHER_LOCATION } from '../utils/locations';
import { NOTE_COLORS, NOTE_DEFAULT_HEIGHT, NOTE_DEFAULT_WIDTH } from '../utils/notes';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  IslandState,
  AppNotification,
  WeatherData,
  CalendarEvent,
  UserSettings,
  AudioPlaybackState,
  ClipboardItem,
  ActiveTab,
  TodoItem,
  NoteItem,
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
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  clipboardItems: ClipboardItem[];
  copyClipboardItem: (item: ClipboardItem) => Promise<boolean>;
  deleteClipboardItem: (id: string) => Promise<void>;
  clearClipboardHistory: () => Promise<void>;
  addClipboardItem: (item: Omit<ClipboardItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  todos: TodoItem[];
  addTodo: (title: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  clearCompletedTodos: () => void;
  notes: NoteItem[];
  createNote: () => string;
  updateNote: (id: string, patch: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  toggleNote: (id: string) => void;
  openAllNotes: () => void;
  minimizeAllNotes: () => void;
  bringNoteToFront: (id: string) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  islandStyle: 'pill',
  autostartEnabled: true,
  alwaysOnTopEnabled: true,
  expandTrigger: 'hover',
  targetMonitor: 'primary',
  weatherLocation: DEFAULT_WEATHER_LOCATION,
  weatherRefreshInterval: 30, // 30 min
  notificationAllowlist: [],
  notificationBlocklist: [],
  hideNotificationContent: false,
  notificationDisplayDuration: 5, // 5 seconds
  reducedMotionEnabled: false,
  backgroundOpacity: 85,
  backgroundBlur: 20,
  compactLeftSlot: 'weather',
  compactRightSlot: 'clock',
  mediaPlacement: 'right',
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

const DEFAULT_TODOS: TodoItem[] = [
  {
    id: 'todo-1',
    title: 'Finish UI design feedback',
    completed: true,
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'todo-2',
    title: 'Check Dynamic Island todo progress',
    completed: true,
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'todo-3',
    title: 'Review and release new version',
    completed: false,
    createdAt: Date.now() - 1800000,
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

const DEFAULT_WEATHER: WeatherData = {
  locationName: 'Jakarta, Indonesia',
  temperature: 29,
  feelsLike: 32,
  humidity: 78,
  weatherCode: 2,
  weatherDescription: 'Partly cloudy',
  tempMin: 24,
  tempMax: 33,
  windSpeed: 12,
  updatedAt: Date.now(),
};

const DEFAULT_AUDIO_PLAYBACK: AudioPlaybackState = {
  title: 'Starboy',
  artist: 'The Weeknd, Daft Punk',
  isPlaying: false,
  progress: 0.38,
  duration: 230,
  sourceApp: 'spotify',
  coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=160&auto=format&fit=crop&q=80',
};

const SAMPLE_SCREENSHOT_THUMBNAIL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="320" height="180" rx="12" fill="url(%23g)"/><rect x="20" y="24" width="280" height="28" rx="6" fill="%23334155"/><rect x="20" y="62" width="130" height="94" rx="8" fill="%230284c7" opacity="0.4"/><rect x="160" y="62" width="140" height="94" rx="8" fill="%236366f1" opacity="0.4"/><circle cx="36" cy="38" r="4" fill="%23ef4444"/><circle cx="48" cy="38" r="4" fill="%23eab308"/><circle cx="60" cy="38" r="4" fill="%2322c55e"/><text x="160" y="112" font-family="sans-serif" font-size="12" fill="%2394a3b8" text-anchor="middle">Screenshot Preview (1920 × 1080)</text></svg>';

const INITIAL_CLIPBOARD_ITEMS: ClipboardItem[] = [
  {
    id: 'clip-sample-1',
    type: 'text',
    content: 'https://github.com/wagydev/dynamic-island-windows',
    charCount: 47,
    timestamp: Date.now() - 1000 * 60 * 3,
    isUrl: true,
  },
  {
    id: 'clip-sample-2',
    type: 'image',
    content: SAMPLE_SCREENSHOT_THUMBNAIL,
    imageWidth: 1920,
    imageHeight: 1080,
    timestamp: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'clip-sample-3',
    type: 'text',
    content: 'Windows + Shift + S untuk tangkap screenshot dengan Dynamic Island',
    charCount: 66,
    timestamp: Date.now() - 1000 * 60 * 45,
    isUrl: false,
  },
];

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
  const [weather, setWeather] = useState<WeatherData>(() => {
    try {
      const cached = localStorage.getItem('di_weather_cache');
      return cached ? JSON.parse(cached) : DEFAULT_WEATHER;
    } catch {
      return DEFAULT_WEATHER;
    }
  });
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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('todo');
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>(() => {
    try {
      const saved = localStorage.getItem('di_clipboard_history');
      return saved ? JSON.parse(saved) : INITIAL_CLIPBOARD_ITEMS;
    } catch {
      return INITIAL_CLIPBOARD_ITEMS;
    }
  });
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('di_todos');
      return saved ? JSON.parse(saved) : DEFAULT_TODOS;
    } catch {
      return DEFAULT_TODOS;
    }
  });
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('di_notes');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as NoteItem[];
      if (!Array.isArray(parsed)) return [];
      // Notes always start folded into the list so the island stays compact on launch.
      return parsed.map((n) => ({ ...n, minimized: true }));
    } catch {
      return [];
    }
  });
  const [audioPlayback, setAudioPlayback] = useState<AudioPlaybackState | null>(DEFAULT_AUDIO_PLAYBACK);
  const dismissTimerRef = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    return () => {
      clearTimeout(dismissTimerRef.current);
    };
  }, []);
  // Save settings to local storage
  // Save settings to local storage and broadcast to all windows
  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('di_settings', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/event').then(({ emit }) => {
          emit('sync-settings', updated).catch(console.error);
        });
      }
      return updated;
    });
  }, []);

  // Listen for storage events across webview windows
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'di_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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

  // Save clipboard items to local storage
  useEffect(() => {
    try {
      localStorage.setItem('di_clipboard_history', JSON.stringify(clipboardItems));
    } catch (err) {
      console.error('Failed to persist clipboard history:', err);
    }
  }, [clipboardItems]);

  // Save todos to local storage
  useEffect(() => {
    try {
      localStorage.setItem('di_todos', JSON.stringify(todos));
    } catch (err) {
      console.error('Failed to persist todos:', err);
    }
  }, [todos]);

  // Save notes to local storage (debounced: typing must not write per keystroke)
  const notesPersistTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    clearTimeout(notesPersistTimer.current);
    notesPersistTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem('di_notes', JSON.stringify(notes));
      } catch (err) {
        console.error('Failed to persist notes:', err);
      }
    }, 250);
    return () => clearTimeout(notesPersistTimer.current);
  }, [notes]);

  // Never lose the last debounced edit when the app closes.
  const notesRef = useRef(notes);
  notesRef.current = notes;
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem('di_notes', JSON.stringify(notesRef.current));
      } catch {
        // Storage can be unavailable; nothing else to do here.
      }
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

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
      const currentSettings = settingsRef.current;
      // Check blocklist
      if (currentSettings.notificationBlocklist.includes(notifData.appId)) {
        return;
      }
      // Check allowlist if configured
      if (
        currentSettings.notificationAllowlist.length > 0 &&
        !currentSettings.notificationAllowlist.includes(notifData.appId)
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
      const duration = (currentSettings.notificationDisplayDuration || 5) * 1000;
      dismissTimerRef.current = setTimeout(() => {
        setState((current) => (current === 'notification' ? 'compact' : current));
        setActiveNotification(null);
      }, duration);
    },
    []
  );
  // Clipboard management methods
  const addClipboardItem = useCallback(
    (itemData: Omit<ClipboardItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
      setClipboardItems((prev) => {
        if (
          itemData.type === 'text' &&
          prev.length > 0 &&
          prev[0].type === 'text' &&
          prev[0].content === itemData.content
        ) {
          return prev;
        }
        const newItem: ClipboardItem = {
          id: itemData.id || `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: itemData.type,
          content: itemData.content,
          charCount:
            itemData.charCount ??
            (itemData.type === 'text' ? itemData.content.length : undefined),
          imageWidth: itemData.imageWidth,
          imageHeight: itemData.imageHeight,
          imagePath: itemData.imagePath,
          timestamp: itemData.timestamp || Date.now(),
          isUrl:
            itemData.type === 'text'
              ? /^https?:\/\//i.test(itemData.content.trim())
              : false,
        };
        return [newItem, ...prev.filter((i) => i.id !== newItem.id)].slice(0, 50);
      });
    },
    []
  );

  // Listen for native Windows notifications when running in Tauri
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        if (cancelled) return;

        const fns = await Promise.all([
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
          }),
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
                prev
                  ? {
                      ...prev,
                      isPlaying: false,
                      title: p.title,
                      artist: p.artist,
                      sourceApp: p.source_app ?? prev.sourceApp,
                    }
                  : null
              );
            } else {
              setAudioPlayback(null);
            }
          }),
          listen<{
            id?: string;
            item_type: 'text' | 'image';
            text?: string;
            char_count?: number;
            thumbnail?: string;
            image_path?: string;
            width?: number;
            height?: number;
            timestamp?: number;
          }>('windows-clipboard-copied', (event) => {
            const payload = event.payload;
            if (payload.item_type === 'image' && payload.thumbnail) {
              addClipboardItem({
                id: payload.id,
                type: 'image',
                content: payload.thumbnail,
                imageWidth: payload.width,
                imageHeight: payload.height,
                imagePath: payload.image_path,
                timestamp: payload.timestamp,
              });
              pushNotification({
                appId: 'system.clipboard',
                appName: 'Clipboard',
                title: 'Screenshot Captured',
                body:
                  payload.width && payload.height
                    ? `Tangkapan layar ${payload.width} × ${payload.height} px tersimpan`
                    : 'Tangkapan layar tersimpan di clipboard',
                icon: payload.thumbnail,
              });
            } else if (payload.item_type === 'text' && payload.text) {
              const text = payload.text;
              const isUrl = /^https?:\/\//i.test(text.trim());
              addClipboardItem({
                id: payload.id,
                type: 'text',
                content: text,
                charCount: payload.char_count ?? text.length,
                timestamp: payload.timestamp,
                isUrl,
              });
              pushNotification({
                appId: 'system.clipboard',
                appName: 'Clipboard',
                title: isUrl ? 'Copied Link' : 'Copied to Clipboard',
                body: `${text.slice(0, 100)}${text.length > 100 ? '...' : ''} (${payload.char_count ?? text.length} chars)`,
              });
            }
          }),
          listen('tray-open-settings', () => {
            setIsSettingsOpen((prev) => !prev);
          }),
          listen<Partial<UserSettings>>('sync-settings', (event) => {
            setSettings((prev) => ({ ...prev, ...event.payload }));
          }),
          listen<'hover' | 'click'>('tray-set-interaction', (event) => {
            updateSettings({ expandTrigger: event.payload });
          }),
          listen('tray-toggle-always-on-top', () => {
            setSettings((prev) => {
              const updated = { ...prev, alwaysOnTopEnabled: !prev.alwaysOnTopEnabled };
              try {
                localStorage.setItem('di_settings', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }),
          listen('tray-toggle-reduced-motion', () => {
            setSettings((prev) => {
              const updated = { ...prev, reducedMotionEnabled: !prev.reducedMotionEnabled };
              try {
                localStorage.setItem('di_settings', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }),
        ]);

        if (cancelled) {
          fns.forEach((fn) => fn());
        } else {
          cleanups.push(...fns);
        }
      })
      .catch((err) => {
        console.error('Failed to bind Tauri event listeners:', err);
      });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [pushNotification, updateSettings]);

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

  const copyClipboardItem = useCallback(async (item: ClipboardItem): Promise<boolean> => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    try {
      if (item.type === 'text') {
        if (isTauri) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('clipboard_write_text', { text: item.content });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(item.content);
        }
        return true;
      } else if (item.type === 'image') {
        if (isTauri && item.imagePath) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('clipboard_write_image', { imagePath: item.imagePath });
          return true;
        } else if (
          typeof window !== 'undefined' &&
          navigator.clipboard &&
          window.ClipboardItem &&
          item.content.startsWith('data:image/')
        ) {
          const res = await fetch(item.content);
          const blob = await res.blob();
          await navigator.clipboard.write([
            new window.ClipboardItem({ [blob.type || 'image/png']: blob }),
          ]);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to copy clipboard item:', err);
      return false;
    }
  }, []);

  const deleteClipboardItem = useCallback(async (id: string) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setClipboardItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target && target.type === 'image' && target.imagePath && isTauri) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('clipboard_delete_image_file', { imagePath: target.imagePath }).catch(console.error);
        });
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearClipboardHistory = useCallback(async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('clipboard_clear_image_cache');
      } catch (err) {
        console.error('Failed to clear clipboard cache:', err);
      }
    }
    setClipboardItems([]);
    try {
      localStorage.removeItem('di_clipboard_history');
    } catch {}
  }, []);

  const addTodo = useCallback((title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [newTodo, ...prev]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCompletedTodos = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.completed));
  }, []);

  const createNote = useCallback(() => {
    const now = Date.now();
    const id = `note-${now}-${Math.random().toString(36).slice(2, 6)}`;
    setNotes((prev) => [
      ...prev,
      {
        id,
        content: '',
        color: NOTE_COLORS[prev.length % NOTE_COLORS.length],
        x: -1,
        y: -1,
        width: NOTE_DEFAULT_WIDTH,
        height: NOTE_DEFAULT_HEIGHT,
        minimized: false,
        z: prev.reduce((max, n) => Math.max(max, n.z), 0) + 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    return id;
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<NoteItem>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toggleNote = useCallback((id: string) => {
    setNotes((prev) => {
      const maxZ = prev.reduce((max, n) => Math.max(max, n.z), 0);
      return prev.map((n) =>
        n.id === id
          ? { ...n, minimized: !n.minimized, z: maxZ + 1, updatedAt: Date.now() }
          : n
      );
    });
  }, []);

  const openAllNotes = useCallback(() => {
    setNotes((prev) => {
      let z = prev.reduce((max, n) => Math.max(max, n.z), 0) + 1;
      return prev.map((n) => (n.minimized ? { ...n, minimized: false, z: z++ } : n));
    });
  }, []);

  const minimizeAllNotes = useCallback(() => {
    setNotes((prev) => prev.map((n) => (n.minimized ? n : { ...n, minimized: true })));
  }, []);

  const bringNoteToFront = useCallback((id: string) => {
    setNotes((prev) => {
      const maxZ = prev.reduce((max, n) => Math.max(max, n.z), 0);
      const target = prev.find((n) => n.id === id);
      if (!target || target.z === maxZ) return prev;
      return prev.map((n) => (n.id === id ? { ...n, z: maxZ + 1 } : n));
    });
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
        clipboardItems,
        copyClipboardItem,
        deleteClipboardItem,
        clearClipboardHistory,
        addClipboardItem,
        isSettingsOpen,
        setIsSettingsOpen,
        todos,
        addTodo,
        toggleTodo,
        deleteTodo,
        clearCompletedTodos,
        notes,
        createNote,
        updateNote,
        deleteNote,
        toggleNote,
        openAllNotes,
        minimizeAllNotes,
        bringNoteToFront,
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
