import React from 'react';

export type SupportedMediaApp =
  | 'spotify'
  | 'youtube'
  | 'apple'
  | 'soundcloud'
  | 'tidal'
  | 'chrome'
  | 'generic';

export interface MediaTheme {
  id: SupportedMediaApp;
  name: string;
  accentColor: string;
  accentSecondary: string;
  bgGlow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  renderIcon: (props: { className?: string; size?: number }) => React.ReactElement;
  sampleTrack: {
    title: string;
    artist: string;
    duration: number;
  };
}

// Crisp, lightweight SVG brand icons
export const SpotifyIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306c-.216.353-.676.467-1.029.251-2.822-1.724-6.374-2.114-10.559-1.158-.403.092-.807-.16-.899-.563-.092-.403.16-.807.563-.899 4.582-1.047 8.513-.6 11.666 1.332.353.216.467.676.251 1.029zm1.469-3.266c-.272.441-.853.582-1.294.31-3.23-1.986-8.154-2.56-11.974-1.4-1.498.455-1.048-.088-1.503-.586-.455-1.498.088-1.048.586-1.503 4.372-1.326 9.805-.68 13.518 1.603.441.272.582.853.31 1.294l.357.282zm.126-3.41c-3.874-2.301-10.264-2.513-13.978-1.385-.594.18-1.222-.153-1.402-.747-.18-.594.153-1.222.747-1.402 4.269-1.296 11.325-1.047 15.795 1.605.534.317.708 1.012.392 1.546-.317.534-1.012.708-1.546.392l-.008-.009z" />
  </svg>
);

export const YouTubeIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const AppleMusicIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M19.306 0a3.67 3.67 0 0 0-3.562 2.766L14.28 9.3H9.42L7.957 2.766A3.67 3.67 0 0 0 4.394 0C2.39 0 .762 1.628.762 3.633a3.64 3.64 0 0 0 .618 2.012l3.486 14.15A4.545 4.545 0 0 0 9.278 23a4.57 4.57 0 0 0 4.572-4.572V11.23h3.816v7.198A4.57 4.57 0 0 0 22.238 23 4.57 4.57 0 0 0 24 22.645l-3.232-17a3.64 3.64 0 0 0 .6-2.012C21.368 1.628 19.74 0 17.736 0h1.57zM8.85 20.473a2.046 2.046 0 1 1 0-4.092 2.046 2.046 0 0 1 0 4.092zm11.338 0a2.046 2.046 0 1 1 0-4.092 2.046 2.046 0 0 1 0 4.092z" />
  </svg>
);

export const SoundCloudIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M1.175 12.225c-.092 0-.175.083-.175.175v4.546c0 .092.083.175.175.175.092 0 .175-.083.175-.175V12.4c0-.092-.083-.175-.175-.175zm1.533-1.63c-.11 0-.2.09-.2.2v7.806c0 .11.09.2.2.2.11 0 .2-.09.2-.2v-7.806c0-.11-.09-.2-.2-.2zm1.567-.847c-.128 0-.233.105-.233.233v9.5c0 .128.105.233.233.233.128 0 .233-.105.233-.233v-9.5c0-.128-.105-.233-.233-.233zm1.6-.285c-.147 0-.267.12-.267.267v10.07c0 .147.12.267.267.267s.267-.12.267-.267V9.73c0-.147-.12-.267-.267-.267zm1.633.228c-.165 0-.3.135-.3.3v9.614c0 .165.135.3.3.3s.3-.135.3-.3V9.99c0-.165-.135-.3-.3-.3zm1.634-1.22c-.183 0-.333.15-.333.333v12.054c0 .183.15.333.333.333.183 0 .333-.15.333-.333V8.77c0-.183-.15-.333-.333-.333zm1.633-.655c-.202 0-.367.165-.367.367v13.364c0 .202.165.367.367.367.202 0 .367-.165.367-.367V8.115c0-.202-.165-.367-.367-.367zm1.633.224c-.22 0-.4.18-.4.4v12.916c0 .22.18.4.4.4.22 0 .4-.18.4-.4V8.34c0-.22-.18-.4-.4-.4zm1.634.62c-.238 0-.433.195-.433.433v12.063c0 .238.195.433.433.433.238 0 .433-.195.433-.433V8.96c0-.238-.195-.433-.433-.433zm6.65 1.57c-.12 0-.236.012-.35.034-.56-2.584-2.855-4.52-5.597-4.52-.39 0-.77.04-1.137.114v15.01c.367.073.746.113 1.137.113h5.947c2.58 0 4.673-2.093 4.673-4.673 0-2.58-2.093-6.078-4.673-6.078z" />
  </svg>
);

export const TidalIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.012 3.992L8.008 7.996l4.004 4.004 4.004-4.004-4.004-4.004zm-8.02 8.02L0 16.016l4.004 4.004 4.004-4.004L3.992 12.012zm8.02 0l-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004zm8.02 0l-4.004 4.004 4.004 4.004 4.004-4.004-4.004-4.004z" />
  </svg>
);

export const ChromeIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" fill="#4285F4" />
    <path
      d="M12 2C6.48 2 2 6.48 2 12c0 .94.13 1.85.38 2.71l5.44-9.42C9.07 3.82 10.49 3 12 3h8.93C18.66 2.37 15.48 2 12 2z"
      fill="#EA4335"
    />
    <path
      d="M21.62 9.29c.25.86.38 1.77.38 2.71 0 5.52-4.48 10-10 10-1.51 0-2.93-.82-4.18-2.29l5.44-9.42h8.36z"
      fill="#FBBC05"
    />
    <path
      d="M2.38 14.71C4.65 19.14 9.23 22 14.47 22l5.44-9.42H12c-2.76 0-5-2.24-5-5 0-.94.26-1.82.72-2.57L2.38 14.71z"
      fill="#34A853"
    />
  </svg>
);

export const GenericMusicIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-4 h-4',
  size = 16,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const MEDIA_THEMES: Record<SupportedMediaApp, MediaTheme> = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    accentColor: '#1DB954',
    accentSecondary: '#1ed760',
    bgGlow: 'rgba(29, 185, 84, 0.35)',
    badgeBg: 'rgba(29, 185, 84, 0.15)',
    badgeBorder: 'rgba(29, 185, 84, 0.35)',
    badgeText: '#1ed760',
    renderIcon: (props) => <SpotifyIcon {...props} />,
    sampleTrack: {
      title: 'Starboy',
      artist: 'The Weeknd, Daft Punk',
      duration: 230,
    },
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube Music',
    accentColor: '#FF0000',
    accentSecondary: '#FF3333',
    bgGlow: 'rgba(255, 0, 0, 0.35)',
    badgeBg: 'rgba(255, 0, 0, 0.15)',
    badgeBorder: 'rgba(255, 0, 0, 0.35)',
    badgeText: '#ff4d4d',
    renderIcon: (props) => <YouTubeIcon {...props} />,
    sampleTrack: {
      title: 'Golden Hour',
      artist: 'JVKE',
      duration: 209,
    },
  },
  apple: {
    id: 'apple',
    name: 'Apple Music',
    accentColor: '#FA243C',
    accentSecondary: '#FC3C44',
    bgGlow: 'rgba(250, 36, 60, 0.35)',
    badgeBg: 'rgba(250, 36, 60, 0.15)',
    badgeBorder: 'rgba(250, 36, 60, 0.35)',
    badgeText: '#ff4d6a',
    renderIcon: (props) => <AppleMusicIcon {...props} />,
    sampleTrack: {
      title: 'Anti-Hero',
      artist: 'Taylor Swift',
      duration: 200,
    },
  },
  soundcloud: {
    id: 'soundcloud',
    name: 'SoundCloud',
    accentColor: '#FF5500',
    accentSecondary: '#FF7700',
    bgGlow: 'rgba(255, 85, 0, 0.35)',
    badgeBg: 'rgba(255, 85, 0, 0.15)',
    badgeBorder: 'rgba(255, 85, 0, 0.35)',
    badgeText: '#ff7722',
    renderIcon: (props) => <SoundCloudIcon {...props} />,
    sampleTrack: {
      title: 'Midnight City',
      artist: 'M83',
      duration: 244,
    },
  },
  tidal: {
    id: 'tidal',
    name: 'TIDAL',
    accentColor: '#00FFFF',
    accentSecondary: '#33FFFF',
    bgGlow: 'rgba(0, 255, 255, 0.35)',
    badgeBg: 'rgba(0, 255, 255, 0.15)',
    badgeBorder: 'rgba(0, 255, 255, 0.35)',
    badgeText: '#00e5ff',
    renderIcon: (props) => <TidalIcon {...props} />,
    sampleTrack: {
      title: 'Renaissance',
      artist: 'Beyoncé',
      duration: 260,
    },
  },
  chrome: {
    id: 'chrome',
    name: 'Google Chrome',
    accentColor: '#4285F4',
    accentSecondary: '#669DF6',
    bgGlow: 'rgba(66, 133, 244, 0.35)',
    badgeBg: 'rgba(66, 133, 244, 0.15)',
    badgeBorder: 'rgba(66, 133, 244, 0.35)',
    badgeText: '#669df6',
    renderIcon: (props) => <ChromeIcon {...props} />,
    sampleTrack: {
      title: 'Lofi Hip Hop Radio',
      artist: 'Lofi Girl - Beats to Relax/Study',
      duration: 3600,
    },
  },
  generic: {
    id: 'generic',
    name: 'Media Player',
    accentColor: '#38BDF8',
    accentSecondary: '#60A5FA',
    bgGlow: 'rgba(56, 189, 248, 0.35)',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.35)',
    badgeText: '#38bdf8',
    renderIcon: (props) => <GenericMusicIcon {...props} />,
    sampleTrack: {
      title: 'Ambient Waves',
      artist: 'Windows Media Audio',
      duration: 180,
    },
  },
};

/**
 * Detect media source application from OS AppUserModelId, track title, or artist
 */
export function detectMediaApp(
  sourceApp?: string,
  title?: string,
  artist?: string
): MediaTheme {
  const s = (sourceApp || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const a = (artist || '').toLowerCase();

  if (s.includes('spotify') || t.includes('spotify') || a.includes('spotify')) {
    return MEDIA_THEMES.spotify;
  }
  if (
    s.includes('youtube') ||
    s.includes('ytmusic') ||
    t.includes('youtube') ||
    a.includes('youtube')
  ) {
    return MEDIA_THEMES.youtube;
  }
  if (
    s.includes('apple') ||
    s.includes('itunes') ||
    s.includes('music.ui') ||
    t.includes('apple music')
  ) {
    return MEDIA_THEMES.apple;
  }
  if (s.includes('soundcloud') || t.includes('soundcloud') || a.includes('soundcloud')) {
    return MEDIA_THEMES.soundcloud;
  }
  if (s.includes('tidal') || t.includes('tidal')) {
    return MEDIA_THEMES.tidal;
  }
  if (s.includes('chrome') || s.includes('msedge') || s.includes('brave') || s.includes('firefox')) {
    return MEDIA_THEMES.chrome;
  }

  return MEDIA_THEMES.generic;
}
