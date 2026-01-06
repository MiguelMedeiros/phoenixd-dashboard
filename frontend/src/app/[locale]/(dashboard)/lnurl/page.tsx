'use client';

import { useState } from 'react';
import {
  Link2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Key,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { lnurlPay, lnurlWithdraw, lnurlAuth } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { PageHeader } from '@/components/page-header';
import { useTranslations } from 'next-intl';

export default function LnurlPage() {
  const t = useTranslations('lnurl');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'pay' | 'withdraw' | 'auth'>('pay');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(
    null
  );
  const { toast } = useToast();

  // LNURL-Pay
  const [payUrl, setPayUrl] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMessage, setPayMessage] = useState('');

  // LNURL-Withdraw
  const [withdrawUrl, setWithdrawUrl] = useState('');

  // LNURL-Auth
  const [authUrl, setAuthUrl] = useState('');

  const handleLnurlPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payUrl || !payAmount) {
      toast({ variant: 'destructive', title: tc('error'), description: t('urlAndAmountRequired') });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await lnurlPay({
        lnurl: payUrl,
        amountSat: parseInt(payAmount),
        message: payMessage || undefined,
      });
      setResult({ success: true, data });
      setPayUrl('');
      setPayAmount('');
      setPayMessage('');
      toast({ title: tc('success') + '!', description: t('lnurlPayCompleted') });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: tc('error'), description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleLnurlWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawUrl) {
      toast({ variant: 'destructive', title: tc('error'), description: t('urlRequired') });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await lnurlWithdraw({ lnurl: withdrawUrl });
      setResult({ success: true, data });
      setWithdrawUrl('');
      toast({ title: tc('success') + '!', description: t('lnurlWithdrawCompleted') });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: tc('error'), description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleLnurlAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUrl) {
      toast({ variant: 'destructive', title: tc('error'), description: t('urlRequired') });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await lnurlAuth({ lnurl: authUrl });
      setResult({ success: true, data });
      setAuthUrl('');
      toast({ title: tc('success') + '!', description: t('lnurlAuthCompleted') });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: tc('error'), description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'pay', label: t('pay'), icon: ArrowUpFromLine },
    { id: 'withdraw', label: t('withdraw'), icon: ArrowDownToLine },
    { id: 'auth', label: t('auth'), icon: Key },
  ];

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tab Switcher */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'pay' | 'withdraw' | 'auth')}
      />

      {/* Forms */}
      <div className="max-w-2xl">
        {/* LNURL-Pay */}
        {activeTab === 'pay' && (
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <ArrowUpFromLine className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{t('lnurlPay')}</h3>
                <p className="text-sm text-muted-foreground">{t('payUsingLnurl')}</p>
              </div>
            </div>

            <form onSubmit={handleLnurlPay} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('lnurlOrAddress')} *
                </label>
                <input
                  placeholder="LNURL... or user@domain.com"
                  value={payUrl}
                  onChange={(e) => setPayUrl(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('amount')} ({tc('sats')}) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('message')}
                </label>
                <input
                  placeholder={t('optionalMessage')}
                  value={payMessage}
                  onChange={(e) => setPayMessage(e.target.value)}
                  className="glass-input w-full px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gradient w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Link2 className="h-5 w-5" /> {t('payViaLnurl')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* LNURL-Withdraw */}
        {activeTab === 'withdraw' && (
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                <ArrowDownToLine className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">{t('lnurlWithdraw')}</h3>
                <p className="text-sm text-muted-foreground">{t('claimFunds')}</p>
              </div>
            </div>

            <form onSubmit={handleLnurlWithdraw} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('lnurlWithdrawUrl')} *
                </label>
                <input
                  placeholder="LNURL..."
                  value={withdrawUrl}
                  onChange={(e) => setWithdrawUrl(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gradient w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ArrowDownToLine className="h-5 w-5" /> {t('withdraw')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* LNURL-Auth */}
        {activeTab === 'auth' && (
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <Key className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">{t('lnurlAuth')}</h3>
                <p className="text-sm text-muted-foreground">{t('authenticateWithNode')}</p>
              </div>
            </div>

            <form onSubmit={handleLnurlAuth} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('lnurlAuthUrl')} *
                </label>
                <input
                  placeholder="LNURL..."
                  value={authUrl}
                  onChange={(e) => setAuthUrl(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gradient w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Key className="h-5 w-5" /> {t('authenticate')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div
          className={cn(
            'max-w-2xl glass-card rounded-3xl p-6 flex items-center gap-4',
            result.success ? 'border-success/30' : 'border-destructive/30'
          )}
        >
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl shrink-0',
              result.success ? 'bg-success/10' : 'bg-destructive/10'
            )}
          >
            {result.success ? (
              <Check className="h-6 w-6 text-success" />
            ) : (
              <AlertCircle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn('font-semibold', result.success ? 'text-success' : 'text-destructive')}
            >
              {result.success ? tc('success') + '!' : t('operationFailed')}
            </p>
            {result.error && (
              <p className="mt-1 text-sm text-muted-foreground truncate">{result.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
