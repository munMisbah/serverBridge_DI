import { INDONESIA_WEATHER_LOCATIONS } from '../../utils/locations';
import React from 'react';
import { SunIcon } from '@solar-icons/react/bold/sun';
import { CloudIcon } from '@solar-icons/react/bold/cloud';
import { CloudRainIcon } from '@solar-icons/react/bold/cloud-rain';
import { CloudStormIcon } from '@solar-icons/react/bold/cloud-storm';
import { WindIcon } from '@solar-icons/react/bold/wind';
import { WaterdropsIcon } from '@solar-icons/react/bold/waterdrops';
import { TemperatureIcon } from '@solar-icons/react/bold/temperature';
import { RestartIcon } from '@solar-icons/react/bold/restart';
import { MapPointIcon } from '@solar-icons/react/bold/map-point';
import { useIsland } from '../../context/IslandContext';

export const WeatherTab: React.FC = () => {
  const {
    weather,
    weatherLoading,
    refreshWeather,
    settings,
    updateSettings,
  } = useIsland();
  const getWeatherIcon = () => {
    if (!weather) return <SunIcon size={24} className="text-amber-400" />;

    const code = weather.weatherCode;
    if (code >= 95) return <CloudStormIcon size={24} className="text-amber-300" />;
    if (code >= 51 && code <= 82) return <CloudRainIcon size={24} className="text-sky-400" />;
    if (code >= 1 && code <= 3) return <CloudIcon size={24} className="text-neutral-300" />;
    return <SunIcon size={24} className="text-amber-400" />;
  };

  return (
    <div className="flex h-full w-full flex-col justify-between px-5 pt-3.5 pb-2 text-white select-none">
      {/* Top Header: Location, Condition, and Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] shadow-sm">
            {getWeatherIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <MapPointIcon size={12} className="text-sky-400 shrink-0" />
              <select
                value={settings.weatherLocation.name}
                onChange={(e) => {
                  const found = INDONESIA_WEATHER_LOCATIONS.find((loc) => loc.name === e.target.value);
                  if (found) {
                    updateSettings({ weatherLocation: found });
                  }
                }}
                className="bg-transparent text-[13px] font-semibold text-white cursor-pointer outline-none hover:text-sky-300 transition-colors py-0 px-0"
                title="Pilih Lokasi Cuaca"
                aria-label="Pilih Lokasi Cuaca"
              >
                {INDONESIA_WEATHER_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name} className="bg-[#14151a] text-white">
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="truncate text-[11px] text-neutral-400 leading-tight mt-0.5">
              {weather?.weatherDescription || 'Partly cloudy'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refreshWeather()}
          disabled={weatherLoading}
          className="flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-neutral-400 transition-colors hover:bg-white/[0.15] hover:text-white disabled:opacity-50"
          title="Refresh weather"
          aria-label="Refresh weather"
        >
          <RestartIcon size={14} className={weatherLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Middle Row: Large Temperature & High/Low / Feels Like */}
      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-[34px] font-light tracking-tight text-white leading-none">
            {weather ? `${weather.temperature}°` : '29°'}
          </span>
          <span className="text-xs text-neutral-400 font-medium">C</span>
        </div>
        <div className="text-right text-[11px] text-neutral-400 font-medium leading-tight">
          <p className="text-white/80">
            {weather?.tempMin !== undefined && weather?.tempMax !== undefined
              ? `H: ${weather.tempMax}°  L: ${weather.tempMin}°`
              : 'H: 33°  L: 24°'}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Feels like {weather ? `${weather.feelsLike}°` : '32°'}
          </p>
        </div>
      </div>

      {/* Bottom Row: 3 iOS Bento Metric Capsules */}
      <div className="grid grid-cols-3 gap-2 mt-1.5">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-900/90 py-1.5 px-1 text-center shadow-sm">
          <div className="flex items-center gap-1 text-[9px] font-semibold uppercase text-neutral-400 tracking-wider">
            <WaterdropsIcon size={11} className="text-sky-400" />
            <span>Humidity</span>
          </div>
          <span className="text-[12.5px] font-bold text-white tabular-nums mt-0.5">
            {weather ? `${weather.humidity}%` : '78%'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-900/90 py-1.5 px-1 text-center shadow-sm">
          <div className="flex items-center gap-1 text-[9px] font-semibold uppercase text-neutral-400 tracking-wider">
            <WindIcon size={11} className="text-teal-400" />
            <span>Wind</span>
          </div>
          <span className="text-[12.5px] font-bold text-white tabular-nums mt-0.5">
            {weather?.windSpeed !== undefined ? `${weather.windSpeed}` : '12'}
            <span className="text-[9.5px] font-normal text-neutral-400 ml-0.5">km/h</span>
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-900/90 py-1.5 px-1 text-center shadow-sm">
          <div className="flex items-center gap-1 text-[9px] font-semibold uppercase text-neutral-400 tracking-wider">
            <TemperatureIcon size={11} className="text-amber-400" />
            <span>Feels</span>
          </div>
          <span className="text-[12.5px] font-bold text-white tabular-nums mt-0.5">
            {weather ? `${weather.feelsLike}°` : '32°'}
          </span>
        </div>
      </div>
    </div>
  );
};
