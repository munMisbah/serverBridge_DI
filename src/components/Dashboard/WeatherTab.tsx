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
  const { weather, weatherLoading, weatherError, refreshWeather, settings, updateSettings } =
    useIsland();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getWeatherIcon = () => {
    if (!weather) return <Sun className="w-8 h-8 text-amber-400" />;
    const code = weather.weatherCode;
    if (code >= 51 && code <= 82) return <CloudRain className="w-8 h-8 text-sky-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-8 h-8 text-slate-300" />;
    return <Sun className="w-8 h-8 text-amber-400" />;
  };

  const filteredCities = PRESET_CITIES.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCity = (city: typeof PRESET_CITIES[0]) => {
    updateSettings({ weatherLocation: city });
    setShowLocationPicker(false);
  };

  return (
    <div className="space-y-3">
      {/* Current Weather Hero Banner */}
      <div className="p-4 bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-white/10 relative overflow-hidden shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {weather?.locationName || settings.weatherLocation.name}
              </span>
              <button
                type="button"
                onClick={() => setShowLocationPicker((v) => !v)}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2"
              >
                Change
              </button>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {weather?.weatherDescription || 'Loading weather data...'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshWeather()}
              disabled={weatherLoading}
              className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Refresh weather"
            >
              <RotateCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="p-2 rounded-2xl bg-neutral-800/40 border border-white/5">
              {getWeatherIcon()}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight text-white">
            {weather ? `${weather.temperature}°` : '--°'}
          </span>
          <span className="text-xs text-neutral-400">
            Feels like {weather ? `${weather.feelsLike}°` : '--°'}
          </span>
        </div>

        {weatherError && (
          <p className="text-[11px] text-amber-400/90 mt-2 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            Offline cache in use: {weatherError}
          </p>
        )}
      </div>

      {/* Location Picker Overlay / Dropdown */}
      {showLocationPicker && (
        <div className="p-3 bg-neutral-900 rounded-2xl border border-white/10 space-y-2 animate-in fade-in duration-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city..."
              className="w-full bg-neutral-800 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {filteredCities.map((city) => {
              const isSelected = city.name === settings.weatherLocation.name;
              return (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <span>{city.name}</span>
                  {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Weather Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-neutral-900/80 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
          <Droplets className="w-4 h-4 text-sky-400 mb-1" />
          <span className="text-[10px] text-neutral-400">Humidity</span>
          <span className="text-xs font-bold text-white mt-0.5">
            {weather ? `${weather.humidity}%` : '--'}
          </span>
        </div>

        <div className="p-2.5 bg-neutral-900/80 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
          <Wind className="w-4 h-4 text-teal-400 mb-1" />
          <span className="text-[10px] text-neutral-400">Wind</span>
          <span className="text-xs font-bold text-white mt-0.5">
            {weather?.windSpeed !== undefined ? `${weather.windSpeed} km/h` : '--'}
          </span>
        </div>

        <div className="p-2.5 bg-neutral-900/80 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
          <Thermometer className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-[10px] text-neutral-400">Min / Max</span>
          <span className="text-xs font-bold text-white mt-0.5">
            {weather?.tempMin !== undefined && weather?.tempMax !== undefined
              ? `${weather.tempMin}° / ${weather.tempMax}°`
              : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
