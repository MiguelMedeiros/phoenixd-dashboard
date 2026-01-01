'use client';

import { useState } from 'react';
import { Search, FileCode, Calculator, Loader2, Zap, Gift, Check, Info } from 'lucide-react';
import { decodeInvoice, decodeOffer, estimateLiquidityFees } from '@/lib/api';
import { formatSats, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { useTranslations } from 'next-intl';

interface DecodedInvoice {
  prefix: string;
  timestamp: number;
  nodeId: string;
  serialized: string;
  description: string;
  paymentHash: string;
  expiry: number;
  minFinalCltvExpiry: number;
  amountMsat?: number;
  [key: string]: unknown;
}

interface DecodedOffer {
  offerId: string;
  description?: string;
  nodeId: string;
  serialized: string;
  amount?: { amountMsat?: number };
  [key: string]: unknown;
}

interface LiquidityFees {
  miningFeeSat: number;
  serviceFeeSat: number;
}

export default function ToolsPage() {
  const t = useTranslations('tools');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'invoice' | 'offer' | 'fees'>('invoice');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Decode Invoice
  const [invoiceToDecode, setInvoiceToDecode] = useState('');
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | null>(null);

  // Decode Offer
  const [offerToDecode, setOfferToDecode] = useState('');
  const [decodedOffer, setDecodedOffer] = useState<DecodedOffer | null>(null);

  // Estimate Fees
  const [feeAmount, setFeeAmount] = useState('');
  const [estimatedFees, setEstimatedFees] = useState<LiquidityFees | null>(null);

  const handleDecodeInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToDecode.trim()) return;

    setLoading(true);
    setDecodedInvoice(null);
    try {
      const result = await decodeInvoice({ invoice: invoiceToDecode.trim() });
      setDecodedInvoice(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode invoice';
      toast({
        variant: 'destructive',
        title: t('invalidInvoice'),
        description: message.includes('400') ? t('invalidInvoiceFormat') : message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerToDecode.trim()) return;

    setLoading(true);
    setDecodedOffer(null);
    try {
      const result = await decodeOffer({ offer: offerToDecode.trim() });
      setDecodedOffer(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode offer';
      toast({
        variant: 'destructive',
        title: t('invalidOffer'),
        description: message.includes('400') ? t('invalidOfferFormat') : message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(feeAmount);
    if (!amount || amount <= 0) {
      toast({
        variant: 'destructive',
        title: t('invalidAmount'),
        description: t('enterValidAmount'),
      });
      return;
    }

    setLoading(true);
    setEstimatedFees(null);
    try {
      const result = await estimateLiquidityFees({ amountSat: amount });
      setEstimatedFees(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to estimate fees';
      toast({ variant: 'destructive', title: t('estimationFailed'), description: message });
    } finally {
      setLoading(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'invoice', label: tc('invoice'), icon: Zap },
    { id: 'offer', label: tc('offer'), icon: Gift },
    { id: 'fees', label: tc('fees'), icon: Calculator },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Tab Switcher */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'invoice' | 'offer' | 'fees')}
      />

      {/* Decode Invoice */}
      {activeTab === 'invoice' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lightning/10">
                <FileCode className="h-6 w-6 text-lightning" />
              </div>
              <div>
                <h3 className="font-semibold">{t('decodeInvoice')}</h3>
                <p className="text-sm text-muted-foreground">{t('bolt11Invoice')}</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-2xl bg-lightning/5 border border-lightning/20 p-4 mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-lightning font-medium flex items-center gap-1 mb-1">
                  <Info className="h-3.5 w-3.5" /> {t('whatIsBolt11')}
                </span>
                {t('bolt11Description')} {t('pasteInvoice')}{' '}
                <code className="text-foreground bg-white/10 px-1 rounded">lnbc</code>{' '}
                {t('mainnetPrefix')}{' '}
                <code className="text-foreground bg-white/10 px-1 rounded">lntb</code>{' '}
                {t('testnetPrefix')} {t('toDecodeIt')}
              </p>
            </div>

            <form onSubmit={handleDecodeInvoice} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('invoice')}
                </label>
                <textarea
                  placeholder="lnbc1..."
                  value={invoiceToDecode}
                  onChange={(e) => setInvoiceToDecode(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-32 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !invoiceToDecode.trim()}
                className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5" /> {t('decode')}
                  </>
                )}
              </button>
            </form>
          </div>

          <div className={cn('glass-card rounded-3xl p-6', !decodedInvoice && 'opacity-60')}>
            <h3 className="font-semibold mb-6">{t('invoiceDetails')}</h3>

            {decodedInvoice ? (
              <div className="space-y-4">
                {decodedInvoice.amountMsat && (
                  <div className="rounded-2xl bg-white/5 p-6 text-center">
                    <p className="text-sm text-muted-foreground">{tc('amount')}</p>
                    <p className="text-4xl font-bold value-highlight mt-1">
                      {formatSats(Math.floor(decodedInvoice.amountMsat / 1000))}
                    </p>
                    <p className="text-sm text-muted-foreground">{tc('sats')}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {decodedInvoice.description && (
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">{tc('description')}</p>
                      <p className="text-sm">{decodedInvoice.description}</p>
                    </div>
                  )}

                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{tc('paymentHash')}</p>
                    <p className="font-mono text-xs break-all">{decodedInvoice.paymentHash}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">{t('expiry')}</p>
                      <p className="font-medium">{decodedInvoice.expiry}s</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">{t('created')}</p>
                      <p className="text-sm font-medium">
                        {new Date(decodedInvoice.timestamp * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Node ID */}
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('destinationNode')}</p>
                    <p className="font-mono text-xs break-all">{decodedInvoice.nodeId}</p>
                  </div>

                  {/* Raw data for debugging */}
                  <details className="rounded-xl bg-white/5 p-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {t('viewRawData')}
                    </summary>
                    <pre className="mt-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                      {JSON.stringify(decodedInvoice, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                  <FileCode className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('decodeInvoiceToSeeDetails')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decode Offer */}
      {activeTab === 'offer' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <Gift className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">{t('decodeOffer')}</h3>
                <p className="text-sm text-muted-foreground">{t('bolt12Offer')}</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-2xl bg-accent/5 border border-accent/20 p-4 mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-accent font-medium flex items-center gap-1 mb-1">
                  <Info className="h-3.5 w-3.5" /> {t('whatIsBolt12')}
                </span>
                {t('bolt12Description')} {t('pasteOffer')}{' '}
                <code className="text-foreground bg-white/10 px-1 rounded">lno1</code>{' '}
                {t('toDecodeIt')}
              </p>
            </div>

            <form onSubmit={handleDecodeOffer} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('offer')}
                </label>
                <textarea
                  placeholder="lno1..."
                  value={offerToDecode}
                  onChange={(e) => setOfferToDecode(e.target.value)}
                  className="glass-input w-full px-4 py-3 font-mono text-sm h-32 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !offerToDecode.trim()}
                className="btn-gradient w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5" /> {t('decode')}
                  </>
                )}
              </button>
            </form>
          </div>

          <div className={cn('glass-card rounded-3xl p-6', !decodedOffer && 'opacity-60')}>
            <h3 className="font-semibold mb-6">{t('offerDetails')}</h3>

            {decodedOffer ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-success/10 border border-success/30 p-3 flex items-center justify-center gap-2 text-success font-medium">
                  <Check className="h-4 w-4" />
                  {t('validBolt12Offer')}
                </div>

                {decodedOffer.amount?.amountMsat && (
                  <div className="rounded-2xl bg-white/5 p-6 text-center">
                    <p className="text-sm text-muted-foreground">{tc('amount')}</p>
                    <p className="text-4xl font-bold value-highlight mt-1">
                      {formatSats(Math.floor(decodedOffer.amount.amountMsat / 1000))}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {decodedOffer.description && (
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">{tc('description')}</p>
                      <p className="text-sm">{decodedOffer.description}</p>
                    </div>
                  )}

                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('offerId')}</p>
                    <p className="font-mono text-xs break-all">{decodedOffer.offerId}</p>
                  </div>

                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{tc('nodeId')}</p>
                    <p className="font-mono text-xs break-all">{decodedOffer.nodeId}</p>
                  </div>

                  {/* Raw data for debugging */}
                  <details className="rounded-xl bg-white/5 p-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {t('viewRawData')}
                    </summary>
                    <pre className="mt-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                      {JSON.stringify(decodedOffer, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                  <Gift className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{t('decodeOfferToSeeDetails')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estimate Fees */}
      {activeTab === 'fees' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bitcoin/10">
                <Calculator className="h-6 w-6 text-bitcoin" />
              </div>
              <div>
                <h3 className="font-semibold">{t('estimateFees')}</h3>
                <p className="text-sm text-muted-foreground">{t('inboundLiquidityCosts')}</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="rounded-2xl bg-bitcoin/5 border border-bitcoin/20 p-4 mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-bitcoin font-medium">{t('whatIsLiquidityFee')}</span>{' '}
                {t('liquidityFeeDescription')}
              </p>
            </div>

            <form onSubmit={handleEstimateFees} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('amount')} ({tc('sats')})
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="glass-input w-full px-4 py-3.5 text-lg font-mono"
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
                    <Calculator className="h-5 w-5" /> {t('estimate')}
                  </>
                )}
              </button>
            </form>
          </div>

          <div className={cn('glass-card rounded-3xl p-6', !estimatedFees && 'opacity-60')}>
            <h3 className="font-semibold mb-6">{t('feeEstimate')}</h3>

            {estimatedFees ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 p-6 text-center">
                  <p className="text-sm text-muted-foreground">{t('totalEstimatedFee')}</p>
                  <p className="text-4xl font-bold text-bitcoin mt-2">
                    {formatSats(estimatedFees.miningFeeSat + estimatedFees.serviceFeeSat)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('miningFee')}</p>
                    <p className="font-mono font-medium">
                      {formatSats(estimatedFees.miningFeeSat)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t('serviceFee')}</p>
                    <p className="font-mono font-medium">
                      {formatSats(estimatedFees.serviceFeeSat)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{t('enterAmountToEstimate')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
