export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
}

export const INDONESIA_WEATHER_LOCATIONS: WeatherLocation[] = [
  {
    name: 'Yogyakarta (DIY)',
    latitude: -7.7956,
    longitude: 110.3695,
    region: 'Daerah Istimewa Yogyakarta',
  },
  {
    name: 'Sleman',
    latitude: -7.7156,
    longitude: 110.3556,
    region: 'D.I. Yogyakarta',
  },
  {
    name: 'Dieng',
    latitude: -7.2062,
    longitude: 109.9075,
    region: 'Jawa Tengah',
  },
  {
    name: 'Magelang',
    latitude: -7.4797,
    longitude: 110.2178,
    region: 'Jawa Tengah',
  },
  {
    name: 'Semarang',
    latitude: -6.9667,
    longitude: 110.4167,
    region: 'Jawa Tengah',
  },
  {
    name: 'Surakarta (Solo)',
    latitude: -7.5755,
    longitude: 110.8243,
    region: 'Jawa Tengah',
  },
  {
    name: 'Jakarta',
    latitude: -6.2088,
    longitude: 106.8456,
    region: 'DKI Jakarta',
  },
  {
    name: 'Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    region: 'Jawa Barat',
  },
  {
    name: 'Surabaya',
    latitude: -7.2575,
    longitude: 112.7521,
    region: 'Jawa Timur',
  },
];

export const DEFAULT_WEATHER_LOCATION = INDONESIA_WEATHER_LOCATIONS[0]; // Yogyakarta (DIY)
