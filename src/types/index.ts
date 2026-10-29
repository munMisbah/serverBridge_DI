export type IslandState = 'compact' | 'expanded' | 'notification';

export type IslandStyle = 'pill' | 'notch';

export type ExpandTrigger = 'hover' | 'click';

export type ActiveTab = 'all' | 'weather' | 'calendar' | 'notifications' | 'clipboard';

export type ClipboardItemType = 'text' | 'image';

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  content: string; // Text string or image thumbnail base64 data URL
  charCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  imagePath?: string; // Path to saved high-res PNG file on disk
  timestamp: number;
  isUrl?: boolean;
}

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
  islandStyle: IslandStyle;
  autostartEnabled: boolean;
  alwaysOnTopEnabled: boolean;
  expandTrigger: ExpandTrigger;
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
  backgroundOpacity: number; // in % (20 to 100)
  backgroundBlur: number; // in px (0 to 40)
}

export interface AudioPlaybackState {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number; // 0 to 1
  duration: number; // in seconds
  sourceApp?: string; // e.g. 'spotify', 'youtube', 'apple', 'soundcloud', etc.
  coverUrl?: string; // Album artwork URL or image
}
