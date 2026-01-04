'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Zap,
  Gift,
  Mail,
  Bitcoin,
  Loader2,
  ArrowUpFromLine,
  Check,
  AlertCircle,
  ScanLine,
  Clock,
  FileText,
  Hash,
} from 'lucide-react';
import {
  payInvoice,
  payOffer,
  payLnAddress,
  sendToAddress,
  getNodeInfo,
  decodeInvoice,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn, formatSats } from '@/lib/utils';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { useTranslations } from 'next-intl';
import { QRScanner } from '@/components/qr-scanner';
import { useRouter } from '@/i18n/navigation';

export default function SendPage() {
  const t = useTranslations('send');
  const ts = useTranslations('scanner');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'invoice' | 'offer' | 'address' | 'onchain'>(
    'invoice'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(
    null
  );
  const [chain, setChain] = useState<string>('mainnet');
  const [scannerOpen, setScannerOpen] = useState(false);
  const { toast } = useToast();

  // Fetch node info to get current chain
  useEffect(() => {
    getNodeInfo()
      .then((info) => setChain(info.chain || 'mainnet'))
      .catch(() => setChain('mainnet'));
  }, []);

  // Read URL params and populate fields
  useEffect(() => {
    const invoiceParam = searchParams.get('invoice');
    const offerParam = searchParams.get('offer');
    const addressParam = searchParams.get('address');
    const btcaddressParam = searchParams.get('btcaddress');

    if (invoiceParam) {
      setInvoice(invoiceParam);
      setActiveTab('invoice');
    } else if (offerParam) {
      setOffer(offerParam);
      setActiveTab('offer');
    } else if (addressParam) {
      setLnAddress(addressParam);
      setActiveTab('address');
    } else if (btcaddressParam) {
      setBtcAddress(btcaddressParam);
      setActiveTab('onchain');
    }
  }, [searchParams]);

  // Handle scanned QR code
  const handleScan = (data: string) => {
    const lowerData = data.toLowerCase().trim();

    // Lightning invoice (lnbc, lntb, lnbcrt)
    if (
      lowerData.startsWith('lnbc') ||
      lowerData.startsWith('lntb') ||
      lowerData.startsWith('lnbcrt') ||
      lowerData.startsWith('lightning:')
    ) {
      const invoiceData = data.replace(/^lightning:/i, '');
      setInvoice(invoiceData);
      setActiveTab('invoice');
      return;
    }

    // BOLT12 Offer (lno)
    if (lowerData.startsWith('lno')) {
      setOffer(data);
      setActiveTab('offer');
      return;
    }

    // Lightning Address (contains @)
    if (data.includes('@') && !data.includes('://')) {
      setLnAddress(data);
      setActiveTab('address');
      return;
    }

    // Bitcoin address (bc1, 1, 3, tb1)
    if (
      lowerData.startsWith('bc1') ||
      lowerData.startsWith('tb1') ||
      lowerData.startsWith('1') ||
      lowerData.startsWith('3') ||
      lowerData.startsWith('bitcoin:')
    ) {
      const address = data.replace(/^bitcoin:/i, '').split('?')[0];
      setBtcAddress(address);
      setActiveTab('onchain');
      return;
    }

    // LNURL - redirect to lnurl page
    if (lowerData.startsWith('lnurl')) {
      router.push(`/lnurl?lnurl=${encodeURIComponent(data)}`);
      return;
    }

    // Default: try as invoice
    setInvoice(data);
    setActiveTab('invoice');
  };

  const isTestnet = chain.toLowerCase().includes('testnet');
  const addressPlaceholder = isTestnet ? 'tb1...' : 'bc1...';

  // Invoice form
  const [invoice, setInvoice] = useState('');
  const [decodedInvoice, setDecodedInvoice] = useState<{
    description: string;
    amountMsat?: number;
    expiry: number;
    timestamp: number;
    paymentHash: string;
  } | null>(null);
  const [decoding, setDecoding] = useState(false);

  // Decode invoice when it changes
  useEffect(() => {
    const decode = async () => {
      if (!invoice || invoice.length < 20) {
        setDecodedInvoice(null);
        return;
      }

      // Check if it looks like a valid invoice
      const lower = invoice.toLowerCase().trim();
      if (!lower.startsWith('lnbc') && !lower.startsWith('lntb') && !lower.startsWith('lnbcrt')) {
        setDecodedInvoice(null);
        return;
      }

      setDecoding(true);
      try {
        const decoded = await decodeInvoice({ invoice: invoice.trim() });
        setDecodedInvoice(decoded);
      } catch (error) {
        console.error('Failed to decode invoice:', error);
        setDecodedInvoice(null);
      } finally {
        setDecoding(false);
      }
    };

    // Debounce the decode call
    const timeout = setTimeout(decode, 300);
    return () => clearTimeout(timeout);
  }, [invoice]);

  // Offer form
  const [offer, setOffer] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  // LN Address form
  const [lnAddress, setLnAddress] = useState('');
  const [lnAddressAmount, setLnAddressAmount] = useState('');
  const [lnAddressMessage, setLnAddressMessage] = useState('');

  // On-chain form
  const [btcAddress, setBtcAddress] = useState('');
  const [btcAmount, setBtcAmount] = useState('');
  const [btcFeeRate, setBtcFeeRate] = useState('');

  const handlePayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) {
      toast({ variant: 'destructive', title: 'Error', description: 'Invoice is required' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await payInvoice({ invoice });
      setResult({ success: true, data });
      setInvoice('');
      toast({ title: 'Payment Sent!', description: 'Invoice paid successfully' });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: 'Payment Failed', description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handlePayOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer || !offerAmount) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Offer and amount are required',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await payOffer({
        offer,
        amountSat: parseInt(offerAmount),
        message: offerMessage || undefined,
      });
      setResult({ success: true, data });
      setOffer('');
      setOfferAmount('');
      setOfferMessage('');
      toast({ title: 'Payment Sent!', description: 'Offer paid successfully' });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: 'Payment Failed', description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handlePayLnAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lnAddress || !lnAddressAmount) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Address and amount are required',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await payLnAddress({
        address: lnAddress,
        amountSat: parseInt(lnAddressAmount),
        message: lnAddressMessage || undefined,
      });
      setResult({ success: true, data });
      setLnAddress('');
      setLnAddressAmount('');
      setLnAddressMessage('');
      toast({ title: 'Payment Sent!', description: 'Payment to LN address successful' });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: 'Payment Failed', description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOnChain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!btcAddress || !btcAmount) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Address and amount are required',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await sendToAddress({
        address: btcAddress,
        amountSat: parseInt(btcAmount),
        feerateSatByte: btcFeeRate ? parseInt(btcFeeRate) : undefined,
      });
      setResult({ success: true, data });
      setBtcAddress('');
      setBtcAmount('');
      setBtcFeeRate('');
      toast({ title: 'Transaction Sent!', description: 'On-chain payment initiated' });
    } catch (error) {
      setResult({ success: false, error: String(error) });
      toast({ variant: 'destructive', title: 'Transaction Failed', description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'invoice', label: t('invoice'), icon: Zap },
    { id: 'offer', label: t('offer'), icon: Gift },
    { id: 'address', label: t('lnAddress'), icon: Mail },
    { id: 'onchain', label: t('onchain'), icon: Bitcoin },
  ];

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header with Scan Button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors shrink-0"
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">{ts('scan')}</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'invoice' | 'offer' | 'address' | 'onchain')}
      />

      {/* Forms */}
      <div className="max-w-2xl">
        {/* Pay Invoice */}
        {activeTab === 'invoice' && (
          <div className="glass-card rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl bg-lightning/10">
                <Zap className="h-5 w-5 md:h-6 md:w-6 text-lightning" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base">{t('payInvoice')}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{t('pasteBolt11')}</p>
              </div>
            </div>

            <form onSubmit={handlePayInvoice} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('invoice')} *
                </label>
                <textarea
                  placeholder={t('invoicePlaceholder')}
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-32 resize-none"
                />
              </div>

              {/* Decoded Invoice Info */}
              {decoding && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{t('decoding')}</span>
                </div>
              )}

              {decodedInvoice && !decoding && (
                <div className="rounded-xl bg-success/5 border border-success/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-success">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('invoiceDecoded')}</span>
                  </div>

                  {/* Amount */}
                  {decodedInvoice.amountMsat !== undefined && decodedInvoice.amountMsat > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Zap className="h-4 w-4" />
                        <span className="text-sm">{t('amount')}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {formatSats(Math.floor(decodedInvoice.amountMsat / 1000))} sats
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {decodedInvoice.description && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block">
                          {t('description')}
                        </span>
                        <span className="text-sm">{decodedInvoice.description}</span>
                      </div>
                    </div>
                  )}

                  {/* Expiry */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{t('expiry')}</span>
                    </div>
                    <span
                      className={cn(
                        (decodedInvoice.timestamp + decodedInvoice.expiry) * 1000 < Date.now()
                          ? 'text-destructive'
                          : 'text-foreground'
                      )}
                    >
                      {(decodedInvoice.timestamp + decodedInvoice.expiry) * 1000 < Date.now()
                        ? t('expired')
                        : new Date(
                            (decodedInvoice.timestamp + decodedInvoice.expiry) * 1000
                          ).toLocaleString()}
                    </span>
                  </div>

                  {/* Payment Hash (truncated) */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    <span className="font-mono truncate">{decodedInvoice.paymentHash}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !!(
                    decodedInvoice &&
                    (decodedInvoice.timestamp + decodedInvoice.expiry) * 1000 < Date.now()
                  )
                }
                className="btn-gradient w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : decodedInvoice && decodedInvoice.amountMsat ? (
                  <>
                    <Send className="h-5 w-5" /> {t('pay')}{' '}
                    {formatSats(Math.floor(decodedInvoice.amountMsat / 1000))} sats
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" /> {t('payInvoice')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Pay Offer */}
        {activeTab === 'offer' && (
          <div className="glass-card rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl bg-accent/10">
                <Gift className="h-5 w-5 md:h-6 md:w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base">{t('payOffer')}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{t('payBolt12')}</p>
              </div>
            </div>

            <form onSubmit={handlePayOffer} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('offer')} *
                </label>
                <textarea
                  placeholder={t('offerPlaceholder')}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('amountSats')} *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={offerAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setOfferAmount(value);
                  }}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('message')}
                </label>
                <input
                  placeholder={t('optionalMessage')}
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
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
                    <Send className="h-5 w-5" /> {t('payOffer')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Pay LN Address */}
        {activeTab === 'address' && (
          <div className="glass-card rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl bg-primary/10">
                <Mail className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base">{t('payLnAddress')}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t('sendSatsToLnAddress')}
                </p>
              </div>
            </div>

            <form onSubmit={handlePayLnAddress} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('lnAddress')} *
                </label>
                <input
                  placeholder={t('addressPlaceholder')}
                  value={lnAddress}
                  onChange={(e) => setLnAddress(e.target.value)}
                  className="glass-input w-full px-4 py-3.5"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('amountSats')} *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={lnAddressAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setLnAddressAmount(value);
                  }}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('message')}
                </label>
                <input
                  placeholder={t('optionalMessage')}
                  value={lnAddressMessage}
                  onChange={(e) => setLnAddressMessage(e.target.value)}
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
                    <Send className="h-5 w-5" /> {t('sendPayment')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* On-chain */}
        {activeTab === 'onchain' && (
          <div className="glass-card rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl bg-bitcoin/10">
                <Bitcoin className="h-5 w-5 md:h-6 md:w-6 text-bitcoin" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base">{t('sendOnchain')}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t('sendBitcoinToAddress')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSendOnChain} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('bitcoinAddress')} *
                </label>
                <input
                  placeholder={addressPlaceholder}
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('amountSats')} *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={btcAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setBtcAmount(value);
                  }}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('feeRate')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('feeRateAuto')}
                  value={btcFeeRate}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setBtcFeeRate(value);
                  }}
                  className="glass-input w-full px-4 py-3"
                  autoComplete="off"
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
                    <ArrowUpFromLine className="h-5 w-5" /> {t('sendBitcoin')}
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
            'max-w-2xl glass-card rounded-2xl md:rounded-3xl p-4 md:p-6 flex items-center gap-3 md:gap-4',
            result.success ? 'border-success/30' : 'border-destructive/30'
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl shrink-0',
              result.success ? 'bg-success/10' : 'bg-destructive/10'
            )}
          >
            {result.success ? (
              <Check className="h-5 w-5 md:h-6 md:w-6 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-semibold text-sm md:text-base',
                result.success ? 'text-success' : 'text-destructive'
              )}
            >
              {result.success ? t('paymentSuccessful') : t('paymentFailed')}
            </p>
            {result.error && (
              <p className="mt-1 text-xs md:text-sm text-muted-foreground truncate">
                {result.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner */}
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
