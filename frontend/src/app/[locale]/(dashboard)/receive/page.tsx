'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Gift,
  Copy,
  Check,
  Loader2,
  FileText,
  RefreshCw,
  CheckCircle2,
  PartyPopper,
  X,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { createInvoice, createOffer } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useCurrencyContext } from '@/components/currency-provider';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { PageHeader } from '@/components/page-header';
import { useTranslations } from 'next-intl';

// Success sound using Web Audio API
const playSuccessSound = () => {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Create a pleasant "ding" sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Second note (higher)
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();

      osc2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.frequency.setValueAtTime(1318.5, audioContext.currentTime); // E6
      osc2.type = 'sine';

      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.8);
    }, 150);
  } catch {
    console.log('Audio not supported');
  }
};

// Fire confetti
const fireConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#f97316', '#fb923c', '#fdba74'],
  });
  fire(0.2, {
    spread: 60,
    colors: ['#22c55e', '#4ade80', '#86efac'],
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#eab308', '#facc15', '#fde047'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#f97316', '#22c55e', '#eab308'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#ffffff', '#fef3c7'],
  });
};

export default function ReceivePage() {
  const t = useTranslations('receive');
  const _tc = useTranslations('common'); // Prefixed with _ for future use
  const { formatValue } = useCurrencyContext();
  const [activeTab, setActiveTab] = useState<'invoice' | 'offer'>('invoice');
  const [loading, setLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{
    serialized: string;
    paymentHash: string;
  } | null>(null);
  const [offerResult, setOfferResult] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const { toast } = useToast();
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const wsRef = useRef<WebSocket | null>(null);

  // Invoice form state
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');

  // Offer form state
  const [offerDescription, setOfferDescription] = useState('');

  // Portal mounting state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for payment received via WebSocket
  useEffect(() => {
    if (!invoiceResult?.paymentHash) return;

    // Get WebSocket URL dynamically based on access method
    const getWsUrl = () => {
      if (typeof window === 'undefined') {
        return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
      }
      const hostname = window.location.hostname;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If accessing via Tailscale Magic DNS, use dynamic URL
      if (hostname.endsWith('.ts.net')) {
        return `${protocol}//${hostname}`;
      }
      return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
    };

    const wsUrl = getWsUrl();
    const ws = new WebSocket(`${wsUrl}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Check if this payment matches our invoice
        if (data.type === 'payment_received' && data.paymentHash === invoiceResult.paymentHash) {
          setIsPaid(true);
          setPaidAmount(data.amountSat || parseInt(invoiceAmount));

          // Fire confetti and play sound
          setTimeout(() => {
            fireConfetti();
            playSuccessSound();
          }, 100);
        }
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [invoiceResult?.paymentHash, invoiceAmount]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceAmount) {
      toast({ variant: 'destructive', title: 'Error', description: 'Amount is required' });
      return;
    }

    setLoading(true);
    setIsPaid(false);
    try {
      const result = await createInvoice({
        amountSat: parseInt(invoiceAmount),
        description: invoiceDescription || undefined,
      });
      setInvoiceResult(result);
      toast({ title: 'Invoice Created!', description: 'Ready to receive payment' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create invoice' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createOffer({ description: offerDescription || undefined });
      setOfferResult(result.offer);
      toast({ title: 'Offer Created!', description: 'Share this reusable offer' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create offer' });
    } finally {
      setLoading(false);
    }
  };

  const resetInvoice = () => {
    setInvoiceResult(null);
    setInvoiceAmount('');
    setInvoiceDescription('');
    setIsPaid(false);
    setPaidAmount(0);
  };

  const resetOffer = () => {
    setOfferResult(null);
    setOfferDescription('');
  };

  const tabs: TabItem[] = [
    { id: 'invoice', label: t('invoice'), icon: Zap },
    { id: 'offer', label: t('offer'), icon: Gift },
  ];

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tab Switcher */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'invoice' | 'offer')}
      />

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <>
          {/* Mobile Fullscreen Invoice View - Using Portal for z-index reliability */}
          {mounted &&
            (invoiceResult || isPaid) &&
            createPortal(
              <div className="md:hidden fixed inset-0 z-[9999] bg-background flex flex-col min-h-screen min-h-[100dvh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
                  <button
                    onClick={resetInvoice}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    {isPaid ? (
                      <>
                        <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                        <span className="font-medium text-success text-sm">
                          {t('paymentReceived')}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
                        <span className="font-medium text-sm">{t('waiting')}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={resetInvoice}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
                  {isPaid ? (
                    /* Payment Received */
                    <>
                      <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-success to-emerald-600 shadow-lg shadow-success/30">
                          <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div className="text-center space-y-2 mb-8">
                        <h2 className="text-xl font-bold text-success flex items-center justify-center gap-2">
                          <PartyPopper className="h-5 w-5" />
                          {t('paymentReceived')}
                          <PartyPopper className="h-5 w-5 scale-x-[-1]" />
                        </h2>
                        <p className="text-4xl font-bold font-mono text-foreground">
                          +{formatValue(paidAmount || parseInt(invoiceAmount))}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Waiting for Payment */
                    <>
                      {/* Amount */}
                      <div className="text-center mb-6">
                        <p className="text-sm text-muted-foreground mb-1">{t('amountSats')}</p>
                        <p className="text-3xl font-bold font-mono text-lightning">
                          {formatValue(parseInt(invoiceAmount))}
                        </p>
                        {invoiceDescription && (
                          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                            {invoiceDescription}
                          </p>
                        )}
                      </div>

                      {/* Large QR Code */}
                      <div className="p-4 bg-white rounded-3xl shadow-2xl mb-6">
                        <QRCodeSVG
                          value={invoiceResult!.serialized.toUpperCase()}
                          size={260}
                          level="M"
                          includeMargin={false}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] space-y-3">
                  {isPaid ? (
                    <button
                      onClick={resetInvoice}
                      className="btn-gradient w-full flex items-center justify-center gap-2 py-4 text-base font-semibold"
                    >
                      <Zap className="h-5 w-5" />
                      {t('createAnother')}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => copyToClipboard(invoiceResult!.serialized)}
                        className="btn-gradient w-full flex items-center justify-center gap-2 py-4 text-base font-semibold"
                      >
                        {copied ? (
                          <>
                            <Check className="h-5 w-5 text-white" />
                            {t('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-5 w-5" />
                            {t('copyInvoice')}
                          </>
                        )}
                      </button>
                      {typeof navigator !== 'undefined' && navigator.share && (
                        <button
                          onClick={() => {
                            navigator.share({
                              title: t('invoice'),
                              text: invoiceResult!.serialized,
                            });
                          }}
                          className="glass-button w-full flex items-center justify-center gap-2 py-4 text-base"
                        >
                          <Share2 className="h-5 w-5" />
                          {t('share')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>,
              document.body
            )}

          {/* Desktop/Form View */}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            {/* Form */}
            <div className="glass-card rounded-xl md:rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg md:rounded-xl bg-gradient-to-br from-lightning/20 to-lightning/5">
                  <Zap className="h-4 w-4 md:h-5 md:w-5 text-lightning" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs md:text-sm">{t('createInvoice')}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    {t('oneTimeBolt11')}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateInvoice} className="space-y-3 md:space-y-4">
                <div className="space-y-1.5 md:space-y-2">
                  <label className="text-[10px] md:text-xs font-medium text-muted-foreground">
                    {t('amountSats')} *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={invoiceAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setInvoiceAmount(value);
                    }}
                    className="glass-input w-full px-3 md:px-4 py-3 md:py-3.5 text-xl md:text-2xl font-mono text-center"
                    autoComplete="off"
                  />
                  {/* Quick Amount Buttons - Mobile friendly */}
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 500, 1000, 5000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setInvoiceAmount(String(amount))}
                        className="py-2.5 px-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10"
                      >
                        {amount >= 1000 ? `${amount / 1000}k` : amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[10px] md:text-xs font-medium text-muted-foreground">
                    {t('descriptionOptional')}
                  </label>
                  <textarea
                    placeholder={t('whatIsThisFor')}
                    value={invoiceDescription}
                    onChange={(e) => setInvoiceDescription(e.target.value)}
                    className="glass-input w-full px-3 md:px-4 py-2.5 md:py-3 min-h-[60px] md:min-h-[80px] resize-none text-xs md:text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !invoiceAmount}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-3.5 md:py-3 text-base md:text-base font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      {t('createInvoice')}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Result - Desktop only */}
            <div className="hidden md:block glass-card rounded-xl md:rounded-2xl p-4 md:p-5">
              {isPaid ? (
                /* Payment Received UI */
                <div className="h-full flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  {/* Success Icon with Animation */}
                  <div className="relative mb-4 md:mb-6">
                    <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
                    <div className="relative flex h-16 w-16 md:h-24 md:w-24 items-center justify-center rounded-full bg-gradient-to-br from-success to-emerald-600 shadow-lg shadow-success/30">
                      <CheckCircle2
                        className="h-8 w-8 md:h-12 md:w-12 text-white"
                        strokeWidth={2.5}
                      />
                    </div>
                  </div>

                  {/* Success Text */}
                  <div className="space-y-1 md:space-y-2 mb-4 md:mb-6">
                    <h2 className="text-lg md:text-2xl font-bold text-success flex items-center justify-center gap-1.5 md:gap-2">
                      <PartyPopper className="h-4 w-4 md:h-6 md:w-6" />
                      {t('paymentReceived')}
                      <PartyPopper className="h-4 w-4 md:h-6 md:w-6 scale-x-[-1]" />
                    </h2>
                    <p className="text-2xl md:text-4xl font-bold font-mono text-foreground">
                      +{formatValue(paidAmount || parseInt(invoiceAmount))}
                    </p>
                    <p className="text-xs md:text-base text-muted-foreground">
                      {t('invoicePaidSuccessfully')}
                    </p>
                  </div>

                  {/* Create Another Button */}
                  <button
                    onClick={resetInvoice}
                    className="btn-gradient flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 text-sm md:text-base"
                  >
                    <Zap className="h-4 w-4 md:h-5 md:w-5" />
                    {t('createAnother')}
                  </button>
                </div>
              ) : invoiceResult ? (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 md:mb-5">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-warning animate-pulse" />
                      <span className="font-medium text-xs md:text-base">{t('waiting')}</span>
                      <span className="font-mono text-lightning font-semibold text-sm md:text-base">
                        {formatValue(parseInt(invoiceAmount))}
                      </span>
                    </div>
                    <button
                      onClick={resetInvoice}
                      className="p-1.5 md:p-2 rounded-lg hover:bg-white/10 transition-colors"
                      title={t('createNewInvoice')}
                    >
                      <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* QR Code - Centered & Responsive */}
                  <div className="flex justify-center mb-4 md:mb-5">
                    <div className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl">
                      <QRCodeSVG
                        value={invoiceResult.serialized.toUpperCase()}
                        size={180}
                        level="M"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                      />
                    </div>
                  </div>

                  {/* Invoice String */}
                  <div className="space-y-3">
                    <div className="relative">
                      <div className="glass-input w-full px-3 py-2.5 font-mono text-xs break-all rounded-xl max-h-20 overflow-y-auto">
                        {invoiceResult.serialized}
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(invoiceResult.serialized)}
                      className="glass-button w-full flex items-center justify-center gap-2 py-3"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-success" />
                          {t('copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          {t('copyInvoice')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">{t('noInvoiceYet')}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t('fillAmountToGenerate')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Offer Tab */}
      {activeTab === 'offer' && (
        <>
          {/* Mobile Fullscreen Offer View - Using Portal for z-index reliability */}
          {mounted &&
            offerResult &&
            createPortal(
              <div className="md:hidden fixed inset-0 z-[9999] bg-background flex flex-col min-h-screen min-h-[100dvh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
                  <button
                    onClick={resetOffer}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                    <span className="font-medium text-success text-sm">{t('bolt12Ready')}</span>
                  </div>
                  <button
                    onClick={resetOffer}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
                  {/* Description */}
                  <div className="text-center mb-6">
                    <p className="text-sm text-muted-foreground mb-1">{t('offer')}</p>
                    <p className="text-xl font-semibold text-accent">{t('reusableBolt12')}</p>
                    {offerDescription && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                        {offerDescription}
                      </p>
                    )}
                  </div>

                  {/* Large QR Code */}
                  <div className="p-4 bg-white rounded-3xl shadow-2xl mb-6">
                    <QRCodeSVG
                      value={offerResult.toUpperCase()}
                      size={260}
                      level="M"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] space-y-3">
                  <button
                    onClick={() => copyToClipboard(offerResult)}
                    className="btn-gradient w-full flex items-center justify-center gap-2 py-4 text-base font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="h-5 w-5 text-white" />
                        {t('copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-5 w-5" />
                        {t('copyOffer')}
                      </>
                    )}
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={() => {
                        navigator.share({
                          title: t('offer'),
                          text: offerResult,
                        });
                      }}
                      className="glass-button w-full flex items-center justify-center gap-2 py-4 text-base"
                    >
                      <Share2 className="h-5 w-5" />
                      {t('share')}
                    </button>
                  )}
                </div>
              </div>,
              document.body
            )}

          {/* Desktop/Form View */}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            {/* Form */}
            <div className="glass-card rounded-xl md:rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg md:rounded-xl bg-gradient-to-br from-accent/20 to-accent/5">
                  <Gift className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs md:text-sm">{t('createOffer')}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    {t('reusableBolt12')}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="mb-4 p-3 md:p-4 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {t('offerExplanation')}
                </p>
              </div>

              <form onSubmit={handleCreateOffer} className="space-y-3 md:space-y-4">
                <div className="space-y-1 md:space-y-1.5">
                  <label className="text-[10px] md:text-xs font-medium text-muted-foreground">
                    {t('descriptionOptional')}
                  </label>
                  <textarea
                    placeholder={t('describeThisOffer')}
                    value={offerDescription}
                    onChange={(e) => setOfferDescription(e.target.value)}
                    className="glass-input w-full px-3 md:px-4 py-2.5 md:py-3 min-h-[80px] md:min-h-[120px] resize-none text-xs md:text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-2.5 md:py-3 text-sm md:text-base"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  ) : (
                    <>
                      <Gift className="h-4 w-4 md:h-5 md:w-5" />
                      {t('createOffer')}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Result - Desktop only */}
            <div className="hidden md:block glass-card rounded-xl md:rounded-2xl p-4 md:p-5">
              {offerResult ? (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 md:mb-5">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-success animate-pulse" />
                      <span className="font-medium text-xs md:text-base">{t('bolt12Ready')}</span>
                    </div>
                    <button
                      onClick={resetOffer}
                      className="p-1.5 md:p-2 rounded-lg hover:bg-white/10 transition-colors"
                      title={t('createNewOffer')}
                    >
                      <RefreshCw className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* QR Code - Centered & Responsive */}
                  <div className="flex justify-center mb-3 md:mb-5">
                    <div className="p-2 md:p-3 bg-white rounded-xl md:rounded-2xl">
                      <QRCodeSVG
                        value={offerResult.toUpperCase()}
                        size={180}
                        level="M"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                      />
                    </div>
                  </div>

                  {/* Offer String */}
                  <div className="space-y-2 md:space-y-3">
                    <div className="relative">
                      <div className="glass-input w-full px-2.5 md:px-3 py-2 md:py-2.5 font-mono text-[10px] md:text-xs break-all rounded-lg md:rounded-xl max-h-16 md:max-h-20 overflow-y-auto">
                        {offerResult}
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(offerResult)}
                      className="glass-button w-full flex items-center justify-center gap-2 py-2.5 md:py-3 text-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-success" />
                          {t('copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          {t('copyOffer')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-8 md:py-12 text-center">
                  <div className="flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-xl md:rounded-2xl bg-white/5 mb-3 md:mb-4">
                    <Gift className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1 text-sm md:text-base">{t('noOfferYet')}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground max-w-xs">
                    {t('createReusableOffer')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
