export type IslandState = 'compact' | 'expanded' | 'notification';

export interface AppNotification {
  id: string;
  appId: string;
  appName: string;
  title: string;
  body: string;
  receivedAt: number;
  isSensitive?: boolean;
  openTarget?: string;
  icon?: string;
  unread?: boolean;
}

export interface WeatherData {
  locationName: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  weatherCode: number;
  weatherDescription: string;
  tempMin?: number;
  tempMax?: number;
  windSpeed?: number;
  updatedAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: number; // Unix timestamp ms
  endAt?: number;
  location?: string;
  reminderMinutes?: number;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  autostartEnabled: boolean;
  alwaysOnTopEnabled: boolean;
  targetMonitor: string;
  weatherLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  weatherRefreshInterval: number; // in minutes
  notificationAllowlist: string[];
  notificationBlocklist: string[];
  hideNotificationContent: boolean;
  notificationDisplayDuration: number; // in seconds
  reducedMotionEnabled: boolean;
}

export interface AudioPlaybackState {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number; // 0 to 1
  duration: number; // in seconds
}
