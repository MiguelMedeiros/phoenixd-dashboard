'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
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
  Globe,
  Bell,
  BellOff,
  BellRing,
  Wifi,
  WifiOff,
  QrCode,
  ExternalLink,
  RefreshCw,
  DollarSign,
  Cloud,
  CloudOff,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNotifications } from '@/hooks/use-notifications';
import {
  setupPassword,
  changePassword,
  removePassword,
  updateAuthSettings,
  getSeed,
  getTorStatus,
  enableTor,
  disableTor,
  getTailscaleStatus,
  saveTailscaleAuthKey,
  enableTailscale,
  disableTailscale,
  refreshTailscaleDns,
  getCloudflaredStatus,
  saveCloudflaredToken,
  enableCloudflared,
  disableCloudflared,
  type LockScreenBg,
  type TorStatus,
  type TailscaleStatus,
  type CloudflaredStatus,
} from '@/lib/api';
import { clearUrlCache } from '@/hooks/use-dynamic-urls';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth-provider';
import {
  useCurrencyContext,
  FIAT_CURRENCIES,
  BITCOIN_DISPLAY_MODES,
} from '@/components/currency-provider';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-header';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';

type SettingsTab = 'security' | 'network' | 'display' | 'wallet' | 'notifications';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tf = useTranslations('funMessages');
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Determine active tab from URL or default to 'security'
  const [activeTab, setActiveTab] = useState<SettingsTab>((tabParam as SettingsTab) || 'security');

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as SettingsTab);
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  const tabs: TabItem[] = [
    { id: 'security', label: t('security'), icon: Shield },
    { id: 'network', label: t('network'), icon: Globe },
    { id: 'display', label: t('display'), icon: Palette },
    { id: 'wallet', label: t('walletSeed'), icon: Wallet },
    { id: 'notifications', label: t('notifications'), icon: Bell },
  ];

  // Fun messages - using translations
  const funMessageKeys = [
    'stackingSats',
    'lightningFast',
    'twentyOneMillion',
    'pureEnergy',
    'numberGoUp',
    'hodlMode',
    'notYourKeys',
    'tickTock',
    'stayHumble',
    'wagmi',
  ] as const;
  const [funMessage] = useState(() => {
    const key = funMessageKeys[Math.floor(Math.random() * funMessageKeys.length)];
    return tf(key);
  });

  return (
    <div className="pt-4 md:pt-6 space-y-6 pb-20 md:pb-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tab Switcher */}
      <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'network' && <NetworkTab />}
      {activeTab === 'display' && <DisplayTab />}
      {activeTab === 'wallet' && <WalletTab />}
      {activeTab === 'notifications' && <NotificationsTab />}

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

// ============= SECURITY TAB =============
function SecurityTab() {
  const t = useTranslations('settings');
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

  useEffect(() => {
    setSelectedAutoLock(autoLockMinutes);
  }, [autoLockMinutes]);

  useEffect(() => {
    setSelectedBackground(lockScreenBg);
  }, [lockScreenBg]);

  const backgrounds: { id: LockScreenBg; label: string; video: string }[] = [
    { id: 'storm-clouds', label: t('stormClouds'), video: '/storm-clouds.mp4' },
    { id: 'lightning', label: t('lightning'), video: '/lightning-bg.mp4' },
    { id: 'thunder-flash', label: t('thunderFlash'), video: '/thunder-flash.mp4' },
    { id: 'electric-storm', label: t('electricStorm'), video: '/electric-storm.mp4' },
    { id: 'night-lightning', label: t('nightLightning'), video: '/night-lightning.mp4' },
    { id: 'sky-thunder', label: t('skyThunder'), video: '/sky-thunder.mp4' },
  ];

  const autoLockOptions = [
    { value: 0, label: t('never') },
    { value: 5, label: t('minutes', { count: 5 }) },
    { value: 15, label: t('minutes', { count: 15 }) },
    { value: 30, label: t('minutes', { count: 30 }) },
    { value: 60, label: t('hour') },
  ];

  const resetPasswordForm = () => {
    setPasswordAction(null);
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
        setPasswordError(t('passwordMinLength'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError(t('passwordsNoMatch'));
        return;
      }
    }

    setPasswordLoading(true);

    try {
      if (passwordAction === 'setup') {
        await setupPassword(newPassword);
        setPasswordSuccess(t('passwordConfigured'));
      } else if (passwordAction === 'change') {
        await changePassword(currentPassword, newPassword);
        setPasswordSuccess(t('passwordChanged'));
      } else if (passwordAction === 'remove') {
        await removePassword(currentPassword);
        setPasswordSuccess(t('passwordRemoved'));
      }
      await refreshStatus();
      setTimeout(resetPasswordForm, 1500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    setSelectedAutoLock(minutes);
    try {
      await updateAuthSettings({ autoLockMinutes: minutes });
      await refreshStatus();
    } catch {
      setSelectedAutoLock(autoLockMinutes);
    }
  };

  const handleBackgroundChange = async (bg: LockScreenBg) => {
    setSelectedBackground(bg);
    try {
      await updateAuthSettings({ lockScreenBg: bg });
      await refreshStatus();
    } catch {
      setSelectedBackground(lockScreenBg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        {/* Password Protection */}
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
            <div>
              <p className="font-medium">{t('passwordProtection')}</p>
              <p className="text-sm text-muted-foreground">
                {hasPassword ? t('dashboardProtected') : t('noPasswordSet')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (showPasswordSection) {
                resetPasswordForm();
                setShowPasswordSection(false);
              } else {
                setShowPasswordSection(true);
                setPasswordAction(hasPassword ? null : 'setup');
              }
            }}
            className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
          >
            {hasPassword ? t('manage') : t('setup')}
          </button>
        </div>

        {/* Password Form */}
        {showPasswordSection && (
          <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-4">
            {hasPassword && !passwordAction && (
              <div className="flex gap-3">
                <button
                  onClick={() => setPasswordAction('change')}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
                >
                  {t('changePassword')}
                </button>
                <button
                  onClick={() => setPasswordAction('remove')}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors"
                >
                  {t('removePassword')}
                </button>
              </div>
            )}

            {passwordAction && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {passwordAction === 'setup' && t('createPassword')}
                  {passwordAction === 'change' && t('enterCurrentAndNew')}
                  {passwordAction === 'remove' && t('enterToRemove')}
                </p>

                {(passwordAction === 'change' || passwordAction === 'remove') && (
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('currentPassword')}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoComplete="current-password"
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

                {(passwordAction === 'setup' || passwordAction === 'change') && (
                  <>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('newPassword')}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoComplete="new-password"
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
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('confirmPassword')}
                      className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoComplete="new-password"
                    />
                  </>
                )}

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

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetPasswordForm}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className={cn(
                      'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                      passwordAction === 'remove'
                        ? 'bg-destructive text-white hover:bg-destructive/90'
                        : 'bg-primary text-white hover:bg-primary/90',
                      passwordLoading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {passwordAction === 'setup' && t('setPassword')}
                    {passwordAction === 'change' && t('changePassword')}
                    {passwordAction === 'remove' && t('removePassword')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Auto-lock */}
        <div className="pt-4 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{t('autoLock')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {autoLockOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAutoLockChange(option.value)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
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

        {/* Lock Screen Background */}
        <div className="pt-4 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{t('lockScreenBackground')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleBackgroundChange(bg.id)}
                className={cn(
                  'relative rounded-xl overflow-hidden aspect-video transition-all',
                  selectedBackground === bg.id
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'hover:opacity-80'
                )}
              >
                <video
                  src={bg.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 text-xs text-white font-medium">
                  {bg.label}
                </span>
                {selectedBackground === bg.id && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lock/Logout Buttons */}
        <div className="pt-4 border-t border-black/5 dark:border-white/5 flex gap-3">
          <button
            onClick={lock}
            className="flex-1 py-2.5 px-4 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="h-4 w-4" />
            {t('lockNow')}
          </button>
          <button
            onClick={logout}
            className="flex-1 py-2.5 px-4 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= NETWORK TAB =============
function NetworkTab() {
  const t = useTranslations('settings');

  // Tor state
  const [torStatus, setTorStatus] = useState<TorStatus | null>(null);
  const [torLoading, setTorLoading] = useState(false);
  const [torError, setTorError] = useState<string | null>(null);

  // Tailscale state
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [tailscaleLoading, setTailscaleLoading] = useState(false);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('');
  const [tailscaleHostname, setTailscaleHostname] = useState('phoenixd-dashboard');
  const [showTailscaleAuthKey, setShowTailscaleAuthKey] = useState(false);
  const [tailscaleAuthKeySaved, setTailscaleAuthKeySaved] = useState(false);
  const [showTailscaleQR, setShowTailscaleQR] = useState(false);
  const { copied: tailscaleUrlCopied, copy: copyTailscaleUrl } = useCopyToClipboard();

  // Cloudflared state
  const [cloudflaredStatus, setCloudflaredStatus] = useState<CloudflaredStatus | null>(null);
  const [cloudflaredLoading, setCloudflaredLoading] = useState(false);
  const [cloudflaredError, setCloudflaredError] = useState<string | null>(null);
  const [cloudflaredToken, setCloudflaredToken] = useState('');
  const [showCloudflaredToken, setShowCloudflaredToken] = useState(false);
  const [cloudflaredTokenSaved, setCloudflaredTokenSaved] = useState(false);
  const [showCloudflaredQR, setShowCloudflaredQR] = useState(false);
  const { copied: cloudflaredUrlCopied, copy: copyCloudflaredUrl } = useCopyToClipboard();

  // Fetch status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [tor, tailscale, cloudflared] = await Promise.all([
          getTorStatus().catch(() => null),
          getTailscaleStatus().catch(() => null),
          getCloudflaredStatus().catch(() => null),
        ]);
        if (tor) setTorStatus(tor);
        if (tailscale) {
          setTailscaleStatus(tailscale);
          if (tailscale.hasAuthKey) setTailscaleAuthKeySaved(true);
          if (tailscale.hostname) setTailscaleHostname(tailscale.hostname);
        }
        if (cloudflared) {
          setCloudflaredStatus(cloudflared);
          if (cloudflared.hasToken) setCloudflaredTokenSaved(true);
        }
      } catch (err) {
        console.error('Failed to fetch network status:', err);
      }
    };
    fetchStatus();
  }, []);

  // Tor handlers
  const handleTorToggle = async () => {
    setTorLoading(true);
    setTorError(null);
    try {
      if (torStatus?.enabled) {
        await disableTor();
        setTorStatus({ enabled: false, running: false, healthy: false, containerExists: false });
      } else {
        await enableTor();
        setTorStatus({ enabled: true, running: true, healthy: false, containerExists: true });
        const pollHealth = async () => {
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const status = await getTorStatus();
            setTorStatus(status);
            if (status.healthy) break;
          }
        };
        pollHealth();
      }
    } catch (err) {
      setTorError(err instanceof Error ? err.message : 'Failed to toggle Tor');
    } finally {
      setTorLoading(false);
    }
  };

  // Tailscale handlers
  const handleSaveTailscaleAuthKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tailscaleAuthKey.trim()) return;
    setTailscaleLoading(true);
    setTailscaleError(null);
    try {
      await saveTailscaleAuthKey(
        tailscaleAuthKey.trim(),
        tailscaleHostname.trim() || 'phoenixd-dashboard'
      );
      setTailscaleAuthKeySaved(true);
      setTailscaleAuthKey('');
      const status = await getTailscaleStatus();
      setTailscaleStatus(status);
    } catch (err) {
      setTailscaleError(err instanceof Error ? err.message : 'Failed to save auth key');
    } finally {
      setTailscaleLoading(false);
    }
  };

  const handleTailscaleToggle = async () => {
    setTailscaleLoading(true);
    setTailscaleError(null);
    try {
      if (tailscaleStatus?.enabled) {
        await disableTailscale();
        clearUrlCache();
        setTailscaleStatus({
          ...tailscaleStatus,
          enabled: false,
          running: false,
          healthy: false,
          containerExists: false,
          dnsName: null,
        });
      } else {
        const result = await enableTailscale();
        clearUrlCache();
        setTailscaleStatus({
          ...(tailscaleStatus || {
            imageExists: true,
            hasAuthKey: true,
            hostname: tailscaleHostname,
          }),
          enabled: true,
          running: true,
          healthy: false,
          containerExists: true,
          dnsName: result.dnsName || null,
        });
        const pollHealth = async () => {
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const status = await getTailscaleStatus();
            setTailscaleStatus(status);
            clearUrlCache();
            if (status.healthy) break;
          }
        };
        pollHealth();
      }
    } catch (err) {
      setTailscaleError(err instanceof Error ? err.message : 'Failed to toggle Tailscale');
    } finally {
      setTailscaleLoading(false);
    }
  };

  const handleRefreshTailscaleDns = async () => {
    setTailscaleLoading(true);
    try {
      const result = await refreshTailscaleDns();
      if (result.dnsName) {
        setTailscaleStatus((prev) => (prev ? { ...prev, dnsName: result.dnsName || null } : null));
        clearUrlCache();
      }
    } catch (err) {
      setTailscaleError(err instanceof Error ? err.message : 'Failed to refresh DNS');
    } finally {
      setTailscaleLoading(false);
    }
  };

  const tailscaleFrontendUrl = tailscaleStatus?.dnsName
    ? `https://${tailscaleStatus.dnsName}`
    : null;

  // Cloudflared handlers
  const handleSaveCloudflaredToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudflaredToken.trim()) return;
    setCloudflaredLoading(true);
    setCloudflaredError(null);
    try {
      await saveCloudflaredToken(cloudflaredToken.trim());
      setCloudflaredTokenSaved(true);
      setCloudflaredToken('');
      const status = await getCloudflaredStatus();
      setCloudflaredStatus(status);
    } catch (err) {
      setCloudflaredError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setCloudflaredLoading(false);
    }
  };

  const handleCloudflaredToggle = async () => {
    setCloudflaredLoading(true);
    setCloudflaredError(null);
    try {
      if (cloudflaredStatus?.enabled) {
        await disableCloudflared();
        setCloudflaredStatus({
          ...cloudflaredStatus,
          enabled: false,
          running: false,
          healthy: false,
          containerExists: false,
        });
      } else {
        await enableCloudflared();
        setCloudflaredStatus({
          ...(cloudflaredStatus || { imageExists: true, hasToken: true, ingress: [] }),
          enabled: true,
          running: true,
          healthy: false,
          containerExists: true,
        });
        const pollHealth = async () => {
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const status = await getCloudflaredStatus();
            setCloudflaredStatus(status);
            if (status.healthy) break;
          }
        };
        pollHealth();
      }
    } catch (err) {
      setCloudflaredError(err instanceof Error ? err.message : 'Failed to toggle Cloudflared');
      try {
        const status = await getCloudflaredStatus();
        setCloudflaredStatus(status);
      } catch {
        /* ignore */
      }
    } finally {
      setCloudflaredLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tor Section */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                torStatus?.enabled && torStatus?.healthy
                  ? 'bg-success/10'
                  : torStatus?.enabled && torStatus?.running
                    ? 'bg-warning/10'
                    : 'bg-muted'
              )}
            >
              <Shield
                className={cn(
                  'h-5 w-5',
                  torStatus?.enabled && torStatus?.healthy
                    ? 'text-success'
                    : torStatus?.enabled && torStatus?.running
                      ? 'text-warning animate-pulse'
                      : 'text-muted-foreground'
                )}
              />
            </div>
            <div>
              <p className="font-medium">{t('torProxy')}</p>
              <p className="text-sm text-muted-foreground">
                {torStatus?.enabled
                  ? torStatus?.healthy
                    ? t('connectedTor')
                    : torStatus?.running
                      ? t('connectingTor')
                      : t('startingTor')
                  : t('disabledTor')}
              </p>
              {torStatus?.enabled && torStatus?.healthy && (
                <p className="text-xs text-success/80 mt-1 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t('ipHidden')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleTorToggle}
            disabled={torLoading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              torStatus?.enabled
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
              torLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {torLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {torStatus?.enabled ? t('disable') : t('enable')}
          </button>
        </div>
        {torError && (
          <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {torError}
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
          {t('torDescription')}
        </p>
      </div>

      {/* Tailscale Section */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        {!tailscaleAuthKeySaved ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted">
                <Wifi className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{t('tailscaleVpn')}</p>
                <p className="text-sm text-muted-foreground">{t('disabledTailscale')}</p>
              </div>
            </div>
            <form onSubmit={handleSaveTailscaleAuthKey} className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary">{t('tailscaleSetup')}</p>
                  <p className="text-muted-foreground mt-1">{t('tailscaleSetupDescription')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showTailscaleAuthKey ? 'text' : 'password'}
                    value={tailscaleAuthKey}
                    onChange={(e) => setTailscaleAuthKey(e.target.value)}
                    placeholder={t('tailscaleAuthKeyPlaceholder')}
                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTailscaleAuthKey(!showTailscaleAuthKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showTailscaleAuthKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={tailscaleHostname}
                  onChange={(e) => setTailscaleHostname(e.target.value)}
                  placeholder={t('tailscaleHostnamePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={tailscaleLoading || !tailscaleAuthKey.trim()}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90',
                  (tailscaleLoading || !tailscaleAuthKey.trim()) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {tailscaleLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('saveAuthKey')}
              </button>
              <a
                href="https://login.tailscale.com/admin/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t('getTailscaleAuthKey')}
              </a>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center',
                    tailscaleStatus?.enabled && tailscaleStatus?.healthy
                      ? 'bg-success/10'
                      : tailscaleStatus?.enabled && tailscaleStatus?.running
                        ? 'bg-warning/10'
                        : 'bg-muted'
                  )}
                >
                  {tailscaleStatus?.enabled ? (
                    <Wifi
                      className={cn(
                        'h-5 w-5',
                        tailscaleStatus?.healthy
                          ? 'text-success'
                          : tailscaleStatus?.running
                            ? 'text-warning animate-pulse'
                            : 'text-muted-foreground'
                      )}
                    />
                  ) : (
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t('tailscaleVpn')}</p>
                  <p className="text-sm text-muted-foreground">
                    {tailscaleStatus?.enabled
                      ? tailscaleStatus?.healthy
                        ? t('connectedTailscale')
                        : tailscaleStatus?.running
                          ? t('connectingTailscale')
                          : t('startingTailscale')
                      : t('disabledTailscale')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTailscaleToggle}
                disabled={tailscaleLoading}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0',
                  tailscaleStatus?.enabled
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20',
                  tailscaleLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {tailscaleLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tailscaleStatus?.enabled ? t('disable') : t('enable')}
              </button>
            </div>

            {tailscaleStatus?.enabled && tailscaleStatus?.dnsName && (
              <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('magicDnsUrl')}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshTailscaleDns}
                      disabled={tailscaleLoading}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      title={t('refreshDns')}
                    >
                      <RefreshCw
                        className={cn(
                          'h-4 w-4 text-muted-foreground',
                          tailscaleLoading && 'animate-spin'
                        )}
                      />
                    </button>
                    <button
                      onClick={() => setShowTailscaleQR(!showTailscaleQR)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      title={showTailscaleQR ? t('hideQrCode') : t('showQrCode')}
                    >
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                  <Globe className="h-4 w-4 text-success flex-shrink-0" />
                  <a
                    href={tailscaleFrontendUrl || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-success font-mono break-all hover:underline"
                  >
                    {tailscaleFrontendUrl}
                  </a>
                  <button
                    onClick={() => copyTailscaleUrl(tailscaleFrontendUrl || '')}
                    className="ml-auto p-1.5 rounded-lg hover:bg-success/20 transition-colors flex-shrink-0"
                  >
                    {tailscaleUrlCopied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-success" />
                    )}
                  </button>
                </div>
                {showTailscaleQR && tailscaleFrontendUrl && (
                  <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-white">
                    <QRCodeSVG value={tailscaleFrontendUrl} size={200} level="M" />
                    <p className="text-xs text-gray-600 text-center">{t('scanQrToAccess')}</p>
                  </div>
                )}
              </div>
            )}

            {tailscaleError && (
              <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {tailscaleError}
              </div>
            )}

            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <button
                onClick={() => setTailscaleAuthKeySaved(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('changeAuthKey')}
              </button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
          {t('tailscaleDescription')}
        </p>
      </div>

      {/* Cloudflare Tunnel Section */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        {!cloudflaredTokenSaved ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted">
                <Cloud className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{t('cloudflareTunnel')}</p>
                <p className="text-sm text-muted-foreground">{t('disabledCloudflare')}</p>
              </div>
            </div>
            <form onSubmit={handleSaveCloudflaredToken} className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary">{t('cloudflaredSetup')}</p>
                  <p className="text-muted-foreground mt-1">{t('cloudflaredSetupDescription')}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showCloudflaredToken ? 'text' : 'password'}
                  value={cloudflaredToken}
                  onChange={(e) => setCloudflaredToken(e.target.value)}
                  placeholder={t('cloudflaredTokenPlaceholder')}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowCloudflaredToken(!showCloudflaredToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showCloudflaredToken ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={cloudflaredLoading || !cloudflaredToken.trim()}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90',
                  (cloudflaredLoading || !cloudflaredToken.trim()) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {cloudflaredLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('saveToken')}
              </button>
              <a
                href="https://one.dash.cloudflare.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t('getCloudflaredToken')}
              </a>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center',
                    cloudflaredStatus?.enabled && cloudflaredStatus?.healthy
                      ? 'bg-success/10'
                      : cloudflaredStatus?.enabled && cloudflaredStatus?.running
                        ? 'bg-warning/10'
                        : 'bg-muted'
                  )}
                >
                  {cloudflaredStatus?.enabled ? (
                    <Cloud
                      className={cn(
                        'h-5 w-5',
                        cloudflaredStatus?.healthy
                          ? 'text-success'
                          : cloudflaredStatus?.running
                            ? 'text-warning animate-pulse'
                            : 'text-muted-foreground'
                      )}
                    />
                  ) : (
                    <CloudOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t('cloudflareTunnel')}</p>
                  <p className="text-sm text-muted-foreground">
                    {cloudflaredStatus?.enabled
                      ? cloudflaredStatus?.healthy
                        ? t('connectedCloudflare')
                        : cloudflaredStatus?.running
                          ? t('connectingCloudflare')
                          : t('startingCloudflare')
                      : t('disabledCloudflare')}
                  </p>
                  {cloudflaredStatus?.enabled && cloudflaredStatus?.healthy && (
                    <p className="text-xs text-success/80 mt-1 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {t('publicAccessEnabled')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleCloudflaredToggle}
                disabled={cloudflaredLoading}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0',
                  cloudflaredStatus?.enabled
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20',
                  cloudflaredLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {cloudflaredLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {cloudflaredStatus?.enabled ? t('disable') : t('enable')}
              </button>
            </div>

            {/* Cloudflare URL Display */}
            {cloudflaredStatus?.enabled && cloudflaredStatus?.healthy && cloudflaredStatus?.ingress && cloudflaredStatus.ingress.length > 0 && (
              <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('publicUrl')}</span>
                  <button
                    onClick={() => setShowCloudflaredQR(!showCloudflaredQR)}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title={showCloudflaredQR ? t('hideQrCode') : t('showQrCode')}
                  >
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                  <Globe className="h-4 w-4 text-success flex-shrink-0" />
                  <a
                    href={`https://${cloudflaredStatus.ingress[0].hostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-success font-mono break-all hover:underline"
                  >
                    https://{cloudflaredStatus.ingress[0].hostname}
                  </a>
                  <button
                    onClick={() => copyCloudflaredUrl(`https://${cloudflaredStatus.ingress[0].hostname}`)}
                    className="ml-auto p-1.5 rounded-lg hover:bg-success/20 transition-colors flex-shrink-0"
                  >
                    {cloudflaredUrlCopied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-success" />
                    )}
                  </button>
                </div>
                {showCloudflaredQR && (
                  <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-white">
                    <QRCodeSVG value={`https://${cloudflaredStatus.ingress[0].hostname}`} size={200} level="M" />
                    <p className="text-xs text-gray-600 text-center">{t('scanQrToAccess')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Configure in Cloudflare */}
            {cloudflaredStatus?.enabled && (
              <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">{t('configureInCloudflare')}</p>
                    <p className="text-muted-foreground mt-1">
                      {t('configureInCloudflareDescription')}
                    </p>
                  </div>
                </div>
                <a
                  href="https://one.dash.cloudflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('openCloudflarePanel')}
                </a>
              </div>
            )}

            {cloudflaredError && (
              <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {cloudflaredError}
              </div>
            )}

            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <button
                onClick={() => setCloudflaredTokenSaved(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('changeToken')}
              </button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
          {t('cloudflaredDescription')}
        </p>
      </div>
    </div>
  );
}

// ============= DISPLAY TAB =============
function DisplayTab() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();
  const {
    currency,
    setCurrency,
    bitcoinDisplayMode,
    setBitcoinDisplayMode,
    loading: currencyLoading,
  } = useCurrencyContext();

  const themes = [
    { id: 'dark', label: t('dark'), icon: Moon, description: t('darkMode') },
    { id: 'light', label: t('light'), icon: Sun, description: t('lightMode') },
    { id: 'system', label: t('auto'), icon: Monitor, description: t('followSystem') },
  ];

  return (
    <div className="space-y-6">
      {/* Currency */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center',
              currency !== 'BTC' ? 'bg-primary/10' : 'bg-bitcoin/10'
            )}
          >
            {currency === 'BTC' ? (
              <Zap className="h-5 w-5 text-bitcoin" />
            ) : (
              <DollarSign className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">{t('displayCurrency')}</p>
            <p className="text-sm text-muted-foreground">
              {currency === 'BTC' ? t('showingInSats') : t('showingInFiat', { currency })}
            </p>
          </div>
          {currencyLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {FIAT_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => setCurrency(curr.code)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                currency === curr.code
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground'
              )}
            >
              <span className="text-lg font-bold">{curr.symbol}</span>
              <span className="text-xs font-medium">{curr.code}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-4 border-t border-black/5 dark:border-white/5">
          {t('currencyDescription')}
        </p>
      </div>

      {/* Bitcoin Unit Display - Only visible when BTC is selected */}
      {currency === 'BTC' && (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-bitcoin/10">
              <Zap className="h-5 w-5 text-bitcoin" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('unitDisplayFormat')}</p>
              <p className="text-sm text-muted-foreground">
                {bitcoinDisplayMode === 'sats' ? t('showingClassicSats') : t('showingBip177')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BITCOIN_DISPLAY_MODES.map((displayMode) => (
              <button
                key={displayMode.mode}
                onClick={() => setBitcoinDisplayMode(displayMode.mode)}
                className={cn(
                  'flex flex-col items-start gap-2 p-4 rounded-xl border transition-all text-left',
                  bitcoinDisplayMode === displayMode.mode
                    ? 'bg-bitcoin/10 border-bitcoin/50 text-bitcoin'
                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {displayMode.mode === 'sats' ? 'sats' : '₿'}
                  </span>
                  {bitcoinDisplayMode === displayMode.mode && <Check className="h-4 w-4" />}
                </div>
                <div>
                  <span className="text-sm font-medium block">
                    {t(displayMode.mode === 'sats' ? 'classicSats' : 'modernBip177')}
                  </span>
                  <span className="text-xs opacity-75">
                    {displayMode.mode === 'sats' ? '100,000 sats' : '₿100,000'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-4 border-t border-black/5 dark:border-white/5">
            {t('bitcoinUnitDescription')}
          </p>
        </div>
      )}

      {/* Theme */}
      <div className="glass-card rounded-xl p-5">
        <div className="grid grid-cols-3 gap-3">
          {themes.map((themeItem) => (
            <button
              key={themeItem.id}
              onClick={() => setTheme(themeItem.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                theme === themeItem.id
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground'
              )}
            >
              <themeItem.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{themeItem.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= WALLET TAB =============
function WalletTab() {
  const t = useTranslations('settings');
  const { hasPassword } = useAuthContext();
  const [showSeedSection, setShowSeedSection] = useState(false);
  const [seedPassword, setSeedPassword] = useState('');
  const [showSeedPassword, setShowSeedPassword] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const { copied: seedCopied, copy: copySeed } = useCopyToClipboard();

  const handleRevealSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedPassword) return;
    setSeedLoading(true);
    setSeedError(null);
    try {
      const result = await getSeed(seedPassword);
      setSeedPhrase(result.seed);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to reveal seed');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleHideSeed = () => {
    setSeedPhrase(null);
    setSeedPassword('');
    setShowSeedSection(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        {!hasPassword && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">{t('setPasswordToViewSeed')}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">{t('keepSeedSecret')}</p>
            <p className="text-muted-foreground mt-1">{t('seedWarning')}</p>
          </div>
        </div>

        {hasPassword && !seedPhrase && (
          <button
            onClick={() => setShowSeedSection(!showSeedSection)}
            className="w-full py-3 px-4 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Key className="h-4 w-4" />
            {t('viewSeedPhrase')}
          </button>
        )}

        {showSeedSection && !seedPhrase && (
          <form
            onSubmit={handleRevealSeed}
            className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5"
          >
            <p className="text-sm text-muted-foreground">{t('enterPasswordToReveal')}</p>
            <div className="relative">
              <input
                type={showSeedPassword ? 'text' : 'password'}
                value={seedPassword}
                onChange={(e) => setSeedPassword(e.target.value)}
                placeholder={t('currentPassword')}
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoComplete="current-password"
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
            <button
              type="submit"
              disabled={seedLoading || !seedPassword}
              className={cn(
                'w-full py-2.5 px-4 rounded-lg bg-destructive text-white hover:bg-destructive/90 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                (seedLoading || !seedPassword) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {seedLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('revealSeed')}
            </button>
          </form>
        )}

        {seedPhrase && (
          <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
            <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium uppercase">
                  Seed Phrase
                </span>
                <button
                  onClick={() => copySeed(seedPhrase)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {seedCopied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {seedPhrase.split(' ').map((word, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded bg-black/5 dark:bg-white/5"
                  >
                    <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
                    <span className="text-sm font-mono">{word}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleHideSeed}
              className="w-full py-2.5 px-4 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              {t('hideSeedPhrase')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= NOTIFICATIONS TAB =============
function NotificationsTab() {
  const t = useTranslations('settings');
  const {
    permission: notificationPermission,
    isSupported: notificationsSupported,
    isEnabled: notificationsEnabled,
    enableNotifications,
    disableNotifications,
    sendNotification,
  } = useNotifications();
  const [notificationLoading, setNotificationLoading] = useState(false);

  const handleNotificationToggle = async () => {
    setNotificationLoading(true);
    try {
      if (notificationsEnabled) {
        disableNotifications();
      } else {
        const enabled = await enableNotifications();
        if (enabled) {
          setTimeout(() => {
            sendNotification({
              title: '⚡ Phoenixd Dashboard',
              body: 'Notifications enabled! You will now receive alerts for incoming payments.',
              tag: 'notifications-enabled',
            });
          }, 500);
        }
      }
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                notificationsEnabled
                  ? 'bg-success/10'
                  : notificationPermission === 'denied'
                    ? 'bg-destructive/10'
                    : 'bg-muted'
              )}
            >
              {notificationsEnabled ? (
                <BellRing className="h-5 w-5 text-success" />
              ) : notificationPermission === 'denied' ? (
                <BellOff className="h-5 w-5 text-destructive" />
              ) : (
                <Bell className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('pushNotifications')}</p>
              <p className="text-sm text-muted-foreground">
                {notificationsEnabled
                  ? t('notificationsEnabled')
                  : notificationPermission === 'denied'
                    ? t('notificationsDenied')
                    : t('notificationsDisabled')}
              </p>
            </div>
          </div>
          {notificationsSupported && notificationPermission !== 'denied' && (
            <button
              onClick={handleNotificationToggle}
              disabled={notificationLoading}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                notificationsEnabled
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-primary/10 text-primary hover:bg-primary/20',
                notificationLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {notificationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {notificationsEnabled ? t('disable') : t('enable')}
            </button>
          )}
        </div>

        {notificationPermission === 'denied' && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">{t('notificationsBlocked')}</p>
              <p className="text-muted-foreground mt-1">{t('enableInBrowser')}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-4 border-t border-black/5 dark:border-white/5">
          {t('notificationsDescription')}
        </p>
      </div>
    </div>
  );
}
