'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { payInvoice, payOffer, payLnAddress, sendToAddress, getNodeInfo } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';

export default function SendPage() {
  const [activeTab, setActiveTab] = useState<'invoice' | 'offer' | 'address' | 'onchain'>(
    'invoice'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(
    null
  );
  const [chain, setChain] = useState<string>('mainnet');
  const { toast } = useToast();

  // Fetch node info to get current chain
  useEffect(() => {
    getNodeInfo()
      .then((info) => setChain(info.chain || 'mainnet'))
      .catch(() => setChain('mainnet'));
  }, []);

  const isTestnet = chain.toLowerCase().includes('testnet');
  const addressPlaceholder = isTestnet ? 'tb1...' : 'bc1...';

  // Invoice form
  const [invoice, setInvoice] = useState('');

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
    { id: 'invoice', label: 'Invoice', icon: Zap },
    { id: 'offer', label: 'Offer', icon: Gift },
    { id: 'address', label: 'LN Address', icon: Mail },
    { id: 'onchain', label: 'On-chain', icon: Bitcoin },
  ];

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Send Payment</h1>
        <p className="mt-1 text-sm md:text-base text-muted-foreground">
          Pay invoices, offers, addresses, or send on-chain
        </p>
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
                <h3 className="font-semibold text-sm md:text-base">Pay Invoice</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Paste a Bolt11 invoice</p>
              </div>
            </div>

            <form onSubmit={handlePayInvoice} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice *
                </label>
                <textarea
                  placeholder="lnbc..."
                  value={invoice}
                  onChange={(e) => setInvoice(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-32 resize-none"
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
                    <Send className="h-5 w-5" /> Pay Invoice
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
                <h3 className="font-semibold text-sm md:text-base">Pay Offer</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Pay a Bolt12 offer</p>
              </div>
            </div>

            <form onSubmit={handlePayOffer} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Offer *
                </label>
                <textarea
                  placeholder="lno..."
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount (sats) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Message
                </label>
                <input
                  placeholder="Optional message"
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
                    <Send className="h-5 w-5" /> Pay Offer
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
                <h3 className="font-semibold text-sm md:text-base">Pay Lightning Address</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Send sats to any LN address
                </p>
              </div>
            </div>

            <form onSubmit={handlePayLnAddress} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Lightning Address *
                </label>
                <input
                  placeholder="user@domain.com"
                  value={lnAddress}
                  onChange={(e) => setLnAddress(e.target.value)}
                  className="glass-input w-full px-4 py-3.5"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount (sats) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={lnAddressAmount}
                  onChange={(e) => setLnAddressAmount(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Message
                </label>
                <input
                  placeholder="Optional message"
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
                    <Send className="h-5 w-5" /> Send Payment
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
                <h3 className="font-semibold text-sm md:text-base">Send On-chain</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Send Bitcoin to a regular address
                </p>
              </div>
            </div>

            <form onSubmit={handleSendOnChain} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bitcoin Address *
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
                  Amount (sats) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={btcAmount}
                  onChange={(e) => setBtcAmount(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fee Rate (sat/vB)
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={btcFeeRate}
                  onChange={(e) => setBtcFeeRate(e.target.value)}
                  className="glass-input w-full px-4 py-3"
                  min="1"
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
                    <ArrowUpFromLine className="h-5 w-5" /> Send Bitcoin
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
              {result.success ? 'Payment Successful!' : 'Payment Failed'}
            </p>
            {result.error && (
              <p className="mt-1 text-xs md:text-sm text-muted-foreground truncate">
                {result.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
