'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LockScreenBg } from '@/lib/api';

interface StepBackgroundProps {
  value: LockScreenBg;
  onChange: (value: LockScreenBg) => void;
}

const backgrounds: { id: LockScreenBg; video: string; labelKey: string }[] = [
  { id: 'storm-clouds', video: '/storm-clouds.mp4', labelKey: 'stormClouds' },
  { id: 'lightning', video: '/lightning-bg.mp4', labelKey: 'lightning' },
  { id: 'thunder-flash', video: '/thunder-flash.mp4', labelKey: 'thunderFlash' },
  { id: 'electric-storm', video: '/electric-storm.mp4', labelKey: 'electricStorm' },
  { id: 'night-lightning', video: '/night-lightning.mp4', labelKey: 'nightLightning' },
  { id: 'sky-thunder', video: '/sky-thunder.mp4', labelKey: 'skyThunder' },
];

export function StepBackground({ value, onChange }: StepBackgroundProps) {
  const t = useTranslations('setup.background');
  const tSettings = useTranslations('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {backgrounds.map((bg) => (
          <button
            key={bg.id}
            onClick={() => onChange(bg.id)}
            className={cn(
              'relative rounded-xl overflow-hidden aspect-video transition-all',
              value === bg.id
                ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-transparent'
                : 'hover:opacity-80'
            )}
          >
            <video
              src={bg.video}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-2 left-2 text-xs text-white font-medium">
              {tSettings(bg.labelKey)}
            </span>
            {value === bg.id && (
              <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-white/50 text-center">{t('preview')}</p>
    </div>
  );
}
