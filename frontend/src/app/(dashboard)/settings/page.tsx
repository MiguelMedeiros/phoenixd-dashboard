'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Settings,
  Zap,
  Sun,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Clock,
  LogOut,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Key,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import {
  setupPassword,
  changePassword,
  removePassword,
  updateAuthSettings,
  getSeed,
  type LockScreenBg,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth-provider';

// Fun messages
const funMessages = [
  'Stacking sats like a boss ⚡',
  'Lightning fast, as it should be ⚡',
  '21 million reasons to be here 🧡',
  'Running on pure Bitcoin energy ⚡',
  'Number go up technology™ 📈',
  'HODL mode: activated 💎',
  'Not your keys, not your coins 🔐',
  'Tick tock, next block ⏱️',
  'Stay humble, stack sats 🧘',
  "We're all gonna make it 🚀",
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [funMessage] = useState(() => funMessages[Math.floor(Math.random() * funMessages.length)]);

  // Auth context
  const { hasPassword, autoLockMinutes, lockScreenBg, logout, lock, refreshStatus } =
    useAuthContext();

  // Password form state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'setup' | 'change' | 'remove' | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [selectedAutoLock, setSelectedAutoLock] = useState(autoLockMinutes);
  const [selectedBackground, setSelectedBackground] = useState<LockScreenBg>(lockScreenBg);

  // Seed phrase state
  const [showSeedSection, setShowSeedSection] = useState(false);
  const [seedPassword, setSeedPassword] = useState('');
  const [showSeedPassword, setShowSeedPassword] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedCopied, setSeedCopied] = useState(false);

  useEffect(() => {
    setSelectedAutoLock(autoLockMinutes);
  }, [autoLockMinutes]);

  useEffect(() => {
    setSelectedBackground(lockScreenBg);
  }, [lockScreenBg]);

  const themes = [
    { id: 'dark', label: 'Dark', icon: Moon, description: 'Dark mode' },
    { id: 'light', label: 'Light', icon: Sun, description: 'Light mode' },
    { id: 'system', label: 'Auto', icon: Monitor, description: 'Follow system' },
  ];

  const autoLockOptions = [
    { value: 0, label: 'Never' },
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
  ];

  const backgroundOptions: {
    value: LockScreenBg;
    label: string;
    preview: string;
    video: string;
  }[] = [
    {
      value: 'storm-clouds',
      label: 'Storm Clouds',
      preview: 'bg-gradient-to-br from-slate-700 via-gray-600 to-slate-800',
      video: '/storm-clouds.mp4',
    },
    {
      value: 'lightning',
      label: 'Lightning',
      preview: 'bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-500',
      video: '/lightning-bg.mp4',
    },
    {
      value: 'thunder-flash',
      label: 'Thunder Flash',
      preview: 'bg-gradient-to-br from-purple-600 via-violet-500 to-indigo-600',
      video: '/thunder-flash.mp4',
    },
    {
      value: 'electric-storm',
      label: 'Electric Storm',
      preview: 'bg-gradient-to-br from-blue-900 via-indigo-700 to-purple-900',
      video: '/electric-storm.mp4',
    },
    {
      value: 'night-lightning',
      label: 'Night Lightning',
      preview: 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800',
      video: '/night-lightning.mp4',
    },
    {
      value: 'sky-thunder',
      label: 'Sky Thunder',
      preview: 'bg-gradient-to-br from-cyan-800 via-blue-700 to-indigo-800',
      video: '/sky-thunder.mp4',
    },
  ];

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordAction === 'setup' || passwordAction === 'change') {
      if (newPassword.length < 4) {
        setPasswordError('Password must be at least 4 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
    }

    setPasswordLoading(true);

    try {
      if (passwordAction === 'setup') {
        await setupPassword(newPassword);
        setPasswordSuccess('Password configured successfully!');
      } else if (passwordAction === 'change') {
        await changePassword(currentPassword, newPassword);
        setPasswordSuccess('Password changed successfully!');
      } else if (passwordAction === 'remove') {
        await removePassword(currentPassword);
        setPasswordSuccess('Password protection removed');
      }

      await refreshStatus();
      resetPasswordForm();
      setPasswordAction(null);
      setShowPasswordSection(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    setSelectedAutoLock(minutes);
    try {
      await updateAuthSettings({ autoLockMinutes: minutes });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to update auto-lock setting:', err);
      setSelectedAutoLock(autoLockMinutes);
    }
  };

  const handleBackgroundChange = async (bg: LockScreenBg) => {
    setSelectedBackground(bg);
    try {
      await updateAuthSettings({ lockScreenBg: bg });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to update background setting:', err);
      setSelectedBackground(lockScreenBg);
    }
  };

  const handleLock = () => {
    lock();
  };

  const handleLogout = async () => {
    await logout();
  };

  const resetSeedForm = () => {
    setSeedPassword('');
    setSeedPhrase(null);
    setSeedError(null);
    setShowSeedPassword(false);
    setSeedCopied(false);
  };

  const handleRevealSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSeedError(null);
    setSeedLoading(true);

    try {
      const result = await getSeed(seedPassword);
      setSeedPhrase(result.seed);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to retrieve seed');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleCopySeed = () => {
    if (seedPhrase) {
      navigator.clipboard.writeText(seedPhrase);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    }
  };

  const handleCloseSeed = () => {
    setShowSeedSection(false);
    resetSeedForm();
  };

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your dashboard preferences</p>
        </div>
      </div>

      {/* Security Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Security
        </h2>

        <div className="glass-card rounded-xl p-5 space-y-4">
          {/* Password Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center',
                  hasPassword ? 'bg-success/10' : 'bg-muted'
                )}
              >
                {hasPassword ? (
                  <Lock className="h-5 w-5 text-success" />
                ) : (
                  <Unlock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Password Protection</p>
                <p className="text-sm text-muted-foreground">
                  {hasPassword ? 'Dashboard is protected' : 'No password set'}
                </p>
                {!hasPassword && (
                  <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Set a password to view your wallet seed phrase
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setShowPasswordSection(!showPasswordSection);
                setPasswordAction(hasPassword ? null : 'setup');
                resetPasswordForm();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
            >
              {hasPassword ? 'Manage' : 'Setup'}
            </button>
          </div>

          {/* Password Actions */}
          {showPasswordSection && (
            <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-4">
              {/* Action Buttons */}
              {hasPassword && !passwordAction && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPasswordAction('change')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => setPasswordAction('remove')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    Remove Password
                  </button>
                  <button
                    onClick={() => setShowPasswordSection(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Password Form */}
              {passwordAction && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {passwordAction === 'setup' && 'Create a password to protect your dashboard.'}
                    {passwordAction === 'change' &&
                      'Enter your current password and choose a new one.'}
                    {passwordAction === 'remove' && 'Enter your password to remove protection.'}
                  </p>

                  {/* Current Password (for change/remove) */}
                  {(passwordAction === 'change' || passwordAction === 'remove') && (
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* New Password (for setup/change) */}
                  {(passwordAction === 'setup' || passwordAction === 'change') && (
                    <>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </>
                  )}

                  {/* Error/Success Messages */}
                  {passwordError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <Check className="h-4 w-4" />
                      {passwordSuccess}
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                        passwordAction === 'remove'
                          ? 'bg-destructive text-white hover:bg-destructive/90'
                          : 'bg-primary text-white hover:bg-primary/90',
                        passwordLoading && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {passwordAction === 'setup' && 'Set Password'}
                      {passwordAction === 'change' && 'Change Password'}
                      {passwordAction === 'remove' && 'Remove Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordAction(null);
                        resetPasswordForm();
                        if (!hasPassword) setShowPasswordSection(false);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Auto-Lock Setting */}
          {hasPassword && (
            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Auto-lock</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {autoLockOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAutoLockChange(option.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      selectedAutoLock === option.value
                        ? 'bg-primary text-white'
                        : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lock Screen Background */}
          {hasPassword && (
            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Lock Screen Background</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {backgroundOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleBackgroundChange(option.value)}
                    className={cn(
                      'relative rounded-xl overflow-hidden transition-all group',
                      'aspect-[4/3]',
                      selectedBackground === option.value
                        ? 'ring-2 ring-primary shadow-lg shadow-primary/20'
                        : 'ring-1 ring-black/10 dark:ring-white/10 hover:ring-primary/50 hover:shadow-md'
                    )}
                  >
                    {/* Background Preview - Video or Gradient */}
                    {option.video ? (
                      <video
                        src={option.video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className={cn('absolute inset-0', option.preview)} />
                    )}

                    {/* Dark overlay for videos */}
                    {option.video && <div className="absolute inset-0 bg-black/30" />}

                    {/* Mock Lock Screen UI */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
                      {/* Mini lightning icon */}
                      <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center mb-2">
                        <Zap className="h-4 w-4 text-white/80" strokeWidth={1.5} />
                      </div>
                      {/* Mini input field */}
                      <div className="w-3/4 h-5 rounded bg-white/10 backdrop-blur-sm mb-1.5" />
                      {/* Mini button */}
                      <div className="w-3/4 h-5 rounded bg-white/20 backdrop-blur-sm" />
                    </div>

                    {/* Label overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-4">
                      <span className="text-xs font-medium text-white/90">{option.label}</span>
                    </div>

                    {/* Selected indicator */}
                    {selectedBackground === option.value && (
                      <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lock/Logout Actions */}
          {hasPassword && (
            <div className="pt-4 border-t border-black/5 dark:border-white/5 flex gap-2">
              <button
                onClick={handleLock}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <Lock className="h-4 w-4" />
                Lock Now
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Wallet Seed Phrase Section - Only visible if password is set */}
      {hasPassword && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Key className="h-4 w-4" />
            Wallet Seed
          </h2>

          <div className="glass-card rounded-xl p-5 space-y-4">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Keep your seed phrase secret!</p>
                <p className="text-muted-foreground mt-1">
                  Anyone with your seed phrase can access and steal your funds. Never share it with
                  anyone.
                </p>
              </div>
            </div>

            {!showSeedSection ? (
              <button
                onClick={() => setShowSeedSection(true)}
                className="w-full px-4 py-3 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View Seed Phrase
              </button>
            ) : (
              <div className="space-y-4">
                {!seedPhrase ? (
                  <form onSubmit={handleRevealSeed} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter your dashboard password to reveal your wallet seed phrase.
                    </p>
                    <div className="relative">
                      <input
                        type={showSeedPassword ? 'text' : 'password'}
                        value={seedPassword}
                        onChange={(e) => setSeedPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSeedPassword(!showSeedPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showSeedPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>

                    {seedError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {seedError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={seedLoading || !seedPassword}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                          'bg-primary text-white hover:bg-primary/90',
                          (seedLoading || !seedPassword) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {seedLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Reveal Seed
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseSeed}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <p className="font-mono text-sm leading-relaxed break-all select-all">
                          {seedPhrase}
                        </p>
                      </div>
                      <button
                        onClick={handleCopySeed}
                        className={cn(
                          'absolute top-2 right-2 p-2 rounded-lg transition-colors',
                          seedCopied
                            ? 'bg-success/10 text-success'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                        )}
                        title="Copy seed phrase"
                      >
                        {seedCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    <button
                      onClick={handleCloseSeed}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                      <EyeOff className="h-4 w-4" />
                      Hide Seed Phrase
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Theme Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Theme
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                theme === t.id
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'glass-card hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground'
              )}
            >
              <t.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="pt-6 border-t border-black/5 dark:border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-semibold">Phoenixd Dashboard</span>
        </div>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {funMessage}
        </p>
      </div>
    </div>
  );
}
