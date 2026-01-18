'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Shield, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface StepPasswordProps {
  value: string;
  onChange: (value: string) => void;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 4) score++;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'weak', color: 'bg-destructive' };
  if (score <= 4) return { score: 2, label: 'fair', color: 'bg-warning' };
  if (score <= 5) return { score: 3, label: 'good', color: 'bg-primary' };
  return { score: 4, label: 'strong', color: 'bg-success' };
}

export function StepPassword({ value, onChange }: StepPasswordProps) {
  const t = useTranslations('setup.password');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const strength = getPasswordStrength(value);
  const passwordsMatch = value === confirmPassword && value.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
        <Shield className="h-5 w-5 text-primary flex-shrink-0" />
        <p className="text-sm text-primary">{t('securityNote')}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {value.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      level <= strength.score ? strength.color : 'bg-muted'
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('strength')}: {t(strength.label)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('confirmLabel')}</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPlaceholder')}
              className="pr-10"
            />
            {confirmPassword.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {passwordsMatch ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">{t('noMatch')}</p>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-2">
          <span className={value.length >= 4 ? 'text-success' : ''}>
            {value.length >= 4 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          {t('minLength')}
        </p>
      </div>
    </div>
  );
}
