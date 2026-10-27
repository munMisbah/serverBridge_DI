import React, { useState } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  RotateCw,
  Search,
  Check,
} from 'lucide-react';
import { useIsland } from '../../context/IslandContext';

const PRESET_CITIES = [
  { name: 'Jakarta, Indonesia', latitude: -6.2088, longitude: 106.8456 },
  { name: 'Surabaya, Indonesia', latitude: -7.2575, longitude: 112.7521 },
  { name: 'Bandung, Indonesia', latitude: -6.9175, longitude: 107.6191 },
  { name: 'Denpasar, Bali', latitude: -8.6705, longitude: 115.2126 },
  { name: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
  { name: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503 },
  { name: 'London, UK', latitude: 51.5074, longitude: -0.1278 },
];

export const WeatherTab: React.FC = () => {
  const {
    weather,
    weatherLoading,
    weatherError,
    refreshWeather,
    settings,
    updateSettings,
  } = useIsland();

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getWeatherIcon = () => {
    if (!weather) return <Sun className="h-8 w-8 text-amber-400" />;

    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) return <CloudRain className="h-8 w-8 text-sky-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="h-8 w-8 text-neutral-300" />;
    return <Sun className="h-8 w-8 text-amber-400" />;
  };

  const filteredCities = PRESET_CITIES.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCity = (city: (typeof PRESET_CITIES)[0]) => {
    updateSettings({ weatherLocation: city });
    setShowLocationPicker(false);
  };

  return (
    <div className="space-y-2.5">
      {/* Current weather */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12px] font-semibold text-white">
                {weather?.locationName || settings.weatherLocation.name}
              </span>
              <button
                type="button"
                onClick={() => setShowLocationPicker((visible) => !visible)}
                className="shrink-0 text-[10px] font-medium text-sky-400 underline underline-offset-2 transition-colors hover:text-sky-300"
              >
                Change
              </button>
            </div>
            <p className="mt-0.5 text-[10px] text-neutral-400">
              {weather?.weatherDescription || 'Loading weather data...'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => refreshWeather()}
              disabled={weatherLoading}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] text-neutral-400 transition-colors hover:bg-white/[0.10] hover:text-white disabled:opacity-50"
              title="Refresh weather"
              aria-label="Refresh weather"
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${weatherLoading ? 'animate-spin' : ''}`}
              />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04]">
              {getWeatherIcon()}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight text-white">
            {weather ? `${weather.temperature}°` : '--°'}
          </span>
          <span className="text-[10px] text-neutral-400">
            Feels like {weather ? `${weather.feelsLike}°` : '--°'}
          </span>
        </div>

        {weatherError && (
          <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400/90">
            Offline cache in use
          </p>
        )}
      </div>

      {/* Location picker */}
      {showLocationPicker && (
        <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-1.5 pl-8 pr-3 text-[11px] text-white placeholder-neutral-600 outline-none focus:border-sky-500/50"
            />
          </div>

          <div className="max-h-28 space-y-0.5 overflow-y-auto pr-1">
            {filteredCities.map((city) => {
              const isSelected = city.name === settings.weatherLocation.name;

              return (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 font-semibold text-sky-300'
                      : 'text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span>{city.name}</span>
                  {isSelected && <Check className="h-3 w-3 text-sky-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
          <Droplets className="mb-1 h-4 w-4 text-sky-400" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            Humidity
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-white">
            {weather ? `${weather.humidity}%` : '--'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
          <Wind className="mb-1 h-4 w-4 text-teal-400" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            Wind
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-white">
            {weather?.windSpeed !== undefined ? `${weather.windSpeed} km/h` : '--'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
          <Thermometer className="mb-1 h-4 w-4 text-amber-400" />
          <span className="text-[9px] uppercase tracking-wider text-neutral-500">
            Min / Max
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-white">
            {weather?.tempMin !== undefined && weather?.tempMax !== undefined
              ? `${weather.tempMin}° / ${weather.tempMax}°`
              : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
