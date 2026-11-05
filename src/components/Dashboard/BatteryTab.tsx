import React from 'react';
import { LaptopMinimalisticIcon } from '@solar-icons/react/bold/laptop-minimalistic';
import { HeadphonesRoundIcon } from '@solar-icons/react/bold/headphones-round';
import { KeyboardIcon } from '@solar-icons/react/bold/keyboard';
import { MouseIcon } from '@solar-icons/react/bold/mouse';
import { SmartSpeaker2Icon } from '@solar-icons/react/bold/smart-speaker-2';
import { WatchRoundIcon } from '@solar-icons/react/bold/watch-round';
import { IPhoneIcon } from '@solar-icons/react/bold/i-phone';
import { GamepadIcon } from '@solar-icons/react/bold/gamepad';
import { BluetoothIcon } from '@solar-icons/react/bold/bluetooth';
import { BoltIcon } from '@solar-icons/react/bold/bolt';
import { RefreshIcon } from '@solar-icons/react/bold/refresh';
import { useIsland } from '../../context/IslandContext';
import { BatteryDeviceKind } from '../../types';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const KIND_ICONS: Record<BatteryDeviceKind, IconComponent> = {
  headphones: HeadphonesRoundIcon,
  earbuds: HeadphonesRoundIcon,
  keyboard: KeyboardIcon,
  mouse: MouseIcon,
  speaker: SmartSpeaker2Icon,
  watch: WatchRoundIcon,
  phone: IPhoneIcon,
  controller: GamepadIcon,
  bluetooth: BluetoothIcon,
};

const BAR_TONES = {
  good: 'bg-emerald-500',
  medium: 'bg-amber-400',
  low: 'bg-red-500',
} as const;

const RING_TONES = {
  good: 'text-emerald-500',
  medium: 'text-amber-400',
  low: 'text-red-500',
  charging: 'text-emerald-400',
} as const;

const toneFor = (level: number): keyof typeof BAR_TONES =>
  level <= 15 ? 'low' : level <= 35 ? 'medium' : 'good';

export const BatteryTab: React.FC = () => {
  const { battery, batteryLoading, batteryError, refreshBattery } = useIsland();

  const system = battery?.system ?? null;
  const devices = battery?.bluetooth ?? [];
  const level = system?.level ?? 0;
  const tone = toneFor(level);
  const ringTone = system?.charging ? RING_TONES.charging : RING_TONES[tone];

  // Circular progress math mirrors the Todo tab ring.
  const radius = 41;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (level / 100) * circumference;

  const statusLabel = system
    ? system.charging
      ? 'Charging'
      : system.pluggedIn
        ? 'Plugged in'
        : 'On battery'
    : 'No system battery';

  return (
    <div className="flex h-full w-full gap-3 px-4 pt-3 pb-1 text-white select-none">
      {/* LEFT COLUMN: Laptop battery ring */}
      <div className="flex w-[140px] shrink-0 flex-col items-center justify-between py-1 px-1 text-center">
        <div className="w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            BATTERY
          </p>
        </div>

        <div className="relative my-auto flex items-center justify-center">
          <svg className="h-[112px] w-[112px] -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-neutral-800"
              strokeWidth="8.5"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={`transition-all duration-500 ease-out ${ringTone}`}
              strokeWidth="8.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Center: percentage + laptop glyph */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline">
              <span className="text-[26px] font-bold leading-none tabular-nums">
                {system ? level : '--'}
              </span>
              {system && <span className="text-[13px] font-semibold leading-none">%</span>}
            </div>
            <LaptopMinimalisticIcon size={16} className="mt-1.5 text-neutral-400" />
            {system?.charging && (
              <BoltIcon size={12} className="mt-0.5 text-emerald-400" />
            )}
          </div>
        </div>

        <div className="w-full">
          <p className="text-[11.5px] font-medium leading-tight text-neutral-400">
            {statusLabel}
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="flex w-2 shrink-0 items-center justify-center self-stretch">
        <div className="h-full w-px bg-white/10" />
      </div>

      {/* RIGHT COLUMN: Bluetooth accessory list */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5 pb-1.5 px-0.5">
          <BluetoothIcon size={13} className="text-sky-400" />
          <span className="text-[12px] font-semibold text-white/90">Bluetooth</span>
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.2 text-[9px] font-medium text-neutral-300">
            {devices.length}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void refreshBattery();
            }}
            title="Refresh battery"
            aria-label="Refresh battery"
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RefreshIcon
              size={11}
              className={batteryLoading ? 'animate-spin' : undefined}
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {devices.length === 0 ? (
            <div className="flex h-full min-h-[90px] flex-col items-center justify-center rounded-2xl bg-white/[0.02] p-3 text-center">
              <BluetoothIcon size={22} className="mb-1 text-white/25" />
              <p className="text-[11px] font-medium text-white/60">
                Tidak ada perangkat Bluetooth
              </p>
              <p className="mt-0.5 text-[9.5px] leading-snug text-white/35">
                Hubungkan TWS, headphone, keyboard, atau mouse yang melaporkan level baterai ke
                Windows
              </p>
            </div>
          ) : (
            devices.map((device) => {
              const DeviceIcon = KIND_ICONS[device.kind] ?? BluetoothIcon;
              const deviceTone = toneFor(device.level);

              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl bg-white/[0.03] px-2.5 py-1.5 transition-all hover:bg-white/[0.06]"
                  title={`${device.name} — ${device.level}%`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                      <DeviceIcon size={13} />
                    </span>
                    <span className="truncate text-[11.5px] font-medium text-white/90">
                      {device.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${BAR_TONES[deviceTone]}`}
                        style={{ width: `${device.level}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-neutral-200">
                      {device.level}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {batteryError && (
          <p className="shrink-0 truncate pt-1 text-[9px] text-red-300/70" title={batteryError}>
            {batteryError}
          </p>
        )}
      </div>
    </div>
  );
};