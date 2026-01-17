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
  Tag,
  Rocket,
  PartyPopper,
} from 'lucide-react';
import {
  payInvoice,
  payOffer,
  payLnAddress,
  sendToAddress,
  getNodeInfo,
  decodeInvoice,
  getCategories,
  updatePaymentMetadata,
  type Contact,
  type ContactAddress,
  type PaymentCategory,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrencyContext } from '@/components/currency-provider';
import { useAnimationContext } from '@/components/animation-provider';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { PageHeader } from '@/components/page-header';
import { useTranslations } from 'next-intl';
import { QRScanner } from '@/components/qr-scanner';
import { useRouter } from '@/i18n/navigation';
import { ContactSelector } from '@/components/contact-selector';

export default function SendPage() {
  const t = useTranslations('send');
  const ts = useTranslations('scanner');
  const tc = useTranslations('contacts');
  const { formatValue } = useCurrencyContext();
  const { playAnimation } = useAnimationContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'invoice' | 'offer' | 'address' | 'onchain'>(
    'invoice'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    data?: unknown;
    error?: string;
    amountSat?: number;
  } | null>(null);
  const [chain, setChain] = useState<string>('mainnet');
  const [scannerOpen, setScannerOpen] = useState(false);
  const { toast } = useToast();

  // Contact selector state for LN Address tab
  const [selectedLnAddressContact, setSelectedLnAddressContact] = useState<{
    contact: Contact;
    address: ContactAddress;
  } | null>(null);

  // Contact selector state for Offer tab
  const [selectedOfferContact, setSelectedOfferContact] = useState<{
    contact: Contact;
    address: ContactAddress;
  } | null>(null);

  // Category state
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const tcat = useTranslations('paymentLabels');

  // Fetch node info to get current chain
  const fetchNodeChain = () => {
    getNodeInfo()
      .then((info) => setChain(info.chain || 'mainnet'))
      .catch(() => setChain('mainnet'));
  };

  useEffect(() => {
    fetchNodeChain();
  }, []);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing send page data...');
      setTimeout(fetchNodeChain, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, []);

  // Fetch categories
  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data))
      .catch((err) => console.error('Failed to load categories:', err));
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
      const amountSat = decodedInvoice?.amountMsat
        ? Math.floor(decodedInvoice.amountMsat / 1000)
        : 0;
      setResult({ success: true, data, amountSat });

      // Save category metadata if selected
      if (selectedCategory && data.paymentHash) {
        try {
          await updatePaymentMetadata(data.paymentHash, {
            categoryIds: selectedCategory ? [selectedCategory] : [],
            isIncoming: false,
          });
        } catch (err) {
          console.error('Failed to save payment category:', err);
        }
      }

      // Fire confetti and play sound on success
      setTimeout(() => {
        playAnimation();
      }, 100);

      setInvoice('');
      setSelectedCategory('');
      setDecodedInvoice(null);
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

    const amountSat = parseInt(offerAmount);
    setLoading(true);
    setResult(null);
    try {
      const data = await payOffer({
        offer,
        amountSat,
        message: offerMessage || undefined,
      });
      setResult({ success: true, data, amountSat });

      // Save category metadata if selected
      if (selectedCategory && data.paymentHash) {
        try {
          await updatePaymentMetadata(data.paymentHash, {
            categoryIds: selectedCategory ? [selectedCategory] : [],
            isIncoming: false,
          });
        } catch (err) {
          console.error('Failed to save payment category:', err);
        }
      }

      // Fire confetti and play sound on success
      setTimeout(() => {
        playAnimation();
      }, 100);

      setOffer('');
      setOfferAmount('');
      setOfferMessage('');
      setSelectedCategory('');
      setSelectedOfferContact(null);
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

    const amountSat = parseInt(lnAddressAmount);
    setLoading(true);
    setResult(null);
    try {
      const data = await payLnAddress({
        address: lnAddress,
        amountSat,
        message: lnAddressMessage || undefined,
      });
      setResult({ success: true, data, amountSat });

      // Save category metadata if selected
      if (selectedCategory && data.paymentHash) {
        try {
          await updatePaymentMetadata(data.paymentHash, {
            categoryIds: selectedCategory ? [selectedCategory] : [],
            isIncoming: false,
          });
        } catch (err) {
          console.error('Failed to save payment category:', err);
        }
      }

      // Fire confetti and play sound on success
      setTimeout(() => {
        playAnimation();
      }, 100);

      setLnAddress('');
      setLnAddressAmount('');
      setLnAddressMessage('');
      setSelectedCategory('');
      setSelectedLnAddressContact(null);
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

    const amountSat = parseInt(btcAmount);
    setLoading(true);
    setResult(null);
    try {
      const data = await sendToAddress({
        address: btcAddress,
        amountSat,
        feerateSatByte: btcFeeRate ? parseInt(btcFeeRate) : undefined,
      });
      setResult({ success: true, data, amountSat });

      // Fire confetti and play sound on success
      setTimeout(() => {
        playAnimation();
      }, 100);

      setBtcAddress('');
      setBtcAmount('');
      setBtcFeeRate('');
      setSelectedCategory('');
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
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')}>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors shrink-0"
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">{ts('scan')}</span>
        </button>
      </PageHeader>

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
                  {t('invoiceLabel')} *
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
                        {formatValue(Math.floor(decodedInvoice.amountMsat / 1000))} sats
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

              {/* Category Selector */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tcat('category')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">{tcat('selectCategory')}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
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
                    {formatValue(Math.floor(decodedInvoice.amountMsat / 1000))} sats
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
              {/* Contact Selector for BOLT12 */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('selectContact')}
                </label>
                <ContactSelector
                  value={selectedOfferContact}
                  onChange={(selection) => {
                    setSelectedOfferContact(selection);
                    if (selection) {
                      setOffer(selection.address.address);
                    }
                  }}
                  filterType="bolt12_offer"
                  placeholder={tc('searchContacts')}
                />
              </div>

              <div className="relative flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground">{tc('or')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('offerLabel')} *
                </label>
                <textarea
                  placeholder={t('offerPlaceholder')}
                  value={offer}
                  onChange={(e) => {
                    setOffer(e.target.value);
                    setSelectedOfferContact(null);
                  }}
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

              {/* Category Selector */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tcat('category')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">{tcat('selectCategory')}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
              {/* Contact Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('selectContact')}
                </label>
                <ContactSelector
                  value={selectedLnAddressContact}
                  onChange={(selection) => {
                    setSelectedLnAddressContact(selection);
                    if (selection) {
                      setLnAddress(selection.address.address);
                    }
                  }}
                  filterType="lightning_address"
                  placeholder={tc('searchContacts')}
                />
              </div>

              <div className="relative flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground">{tc('or')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('lnAddress')} *
                </label>
                <input
                  placeholder={t('addressPlaceholder')}
                  value={lnAddress}
                  onChange={(e) => {
                    setLnAddress(e.target.value);
                    setSelectedLnAddressContact(null);
                  }}
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

              {/* Category Selector */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tcat('category')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">{tcat('selectCategory')}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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

              {/* Category Selector */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tcat('category')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="glass-input w-full pl-11 pr-4 py-3 text-sm appearance-none cursor-pointer"
                    >
                      <option value="">{tcat('selectCategory')}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
            'max-w-2xl glass-card rounded-2xl md:rounded-3xl p-4 md:p-6',
            result.success ? 'border-primary/30' : 'border-destructive/30'
          )}
        >
          {result.success ? (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-4 md:py-6 text-center">
              {/* Animated Icon */}
              <div className="relative mb-4 md:mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30">
                  <Rocket className="h-8 w-8 md:h-10 md:w-10 text-white" strokeWidth={2} />
                </div>
              </div>

              {/* Success Text */}
              <div className="space-y-1 md:space-y-2 mb-4 md:mb-6">
                <h2 className="text-lg md:text-2xl font-bold text-primary flex items-center justify-center gap-1.5 md:gap-2">
                  <PartyPopper className="h-4 w-4 md:h-5 md:w-5" />
                  {t('paymentSuccessful')}
                  <PartyPopper className="h-4 w-4 md:h-5 md:w-5 scale-x-[-1]" />
                </h2>
                {result.amountSat && result.amountSat > 0 && (
                  <p className="text-2xl md:text-3xl font-bold font-mono text-foreground">
                    -{formatValue(result.amountSat)} sats
                  </p>
                )}
                <p className="text-xs md:text-sm text-muted-foreground">
                  {t('paymentSentSuccessfully')}
                </p>
              </div>

              {/* Send Another Button */}
              <button
                onClick={() => setResult(null)}
                className="btn-gradient flex items-center justify-center gap-2 px-6 md:px-8 py-2.5 md:py-3 text-sm md:text-base"
              >
                <Send className="h-4 w-4 md:h-5 md:w-5" />
                {t('sendAnother')}
              </button>
            </div>
          ) : (
            /* Error State */
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl shrink-0 bg-destructive/10">
                <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm md:text-base text-destructive">
                  {t('paymentFailed')}
                </p>
                {result.error && (
                  <p className="mt-1 text-xs md:text-sm text-muted-foreground truncate">
                    {result.error}
                  </p>
                )}
              </div>
              <button onClick={() => setResult(null)} className="glass-button px-3 py-2 text-sm">
                {t('tryAgain')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Scanner */}
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
