'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  ExternalLink,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Loader2,
} from 'lucide-react';
import { listChannels, closeChannel, getNodeInfo, type Channel } from '@/lib/api';
import { cn, getMempoolUrl } from '@/lib/utils';
import { useCurrencyContext } from '@/components/currency-provider';
import { useToast } from '@/hooks/use-toast';
import { CloseChannelDialog } from '@/components/close-channel-dialog';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { useTranslations } from 'next-intl';

export default function ChannelsPage() {
  const t = useTranslations('channels');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { formatValue } = useCurrencyContext();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingChannel, setClosingChannel] = useState<string | null>(null);
  const [chain, setChain] = useState<string>('mainnet');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsData, nodeInfo] = await Promise.all([listChannels(), getNodeInfo()]);
      // Filter out invalid channels (missing required properties)
      const validChannels = (channelsData || []).filter(
        (ch) => ch && ch.channelId && ch.state && typeof ch.capacitySat === 'number'
      );
      setChannels(validChannels);
      setChain(nodeInfo.chain || 'mainnet');
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: te('failedToLoadChannels'),
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tc, te]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing channels data...');
      setTimeout(fetchData, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchData]);

  const openCloseDialog = (channelId: string) => {
    setSelectedChannelId(channelId);
    setCloseDialogOpen(true);
  };

  const handleCloseChannel = async (address: string, feerateSatByte: number) => {
    setClosingChannel(selectedChannelId);
    try {
      await closeChannel({
        channelId: selectedChannelId,
        address,
        feerateSatByte,
      });
      toast({ title: t('channelClosing'), description: t('closeInitiated') });
      const data = await listChannels();
      setChannels(data || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: (error as Error).message || t('closeFailed'),
      });
      throw error;
    } finally {
      setClosingChannel(null);
    }
  };

  const getStateColor = (state: string | undefined) => {
    const normalizedState = (state || '').toUpperCase();
    switch (normalizedState) {
      case 'NORMAL':
        return 'bg-success/10 text-success';
      case 'SYNCING':
      case 'WAIT_FOR_FUNDING_CONFIRMED':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'CLOSING':
      case 'CLOSED':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-white/10 text-foreground';
    }
  };

  const totalCapacity = channels.reduce((acc, ch) => acc + (ch.capacitySat || 0), 0);
  const totalBalance = channels.reduce((acc, ch) => acc + (ch.balanceSat || 0), 0);
  const totalInbound = channels.reduce((acc, ch) => acc + (ch.inboundLiquiditySat || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Stats Grid */}
      <StatCardGrid columns={3}>
        <StatCard
          label={t('totalCapacity')}
          value={formatValue(totalCapacity)}
          icon={Layers}
          variant="primary"
        />
        <StatCard
          label={t('outbound')}
          value={formatValue(totalBalance)}
          icon={ArrowUpFromLine}
          variant="warning"
        />
        <StatCard
          label={t('inbound')}
          value={formatValue(totalInbound)}
          icon={ArrowDownToLine}
          variant="success"
        />
      </StatCardGrid>

      {/* Channels List */}
      {channels.length === 0 ? (
        <div className="glass-card rounded-3xl p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">{t('noChannelsYet')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('channelsCreatedAutomatically')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => {
            const balancePercent =
              (channel.capacitySat || 0) > 0
                ? ((channel.balanceSat || 0) / (channel.capacitySat || 1)) * 100
                : 0;

            return (
              <div key={channel.channelId} className="glass-card rounded-3xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono font-medium">
                        {channel.channelId?.slice(0, 16) || 'N/A'}...
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {channel.fundingTxId?.slice(0, 24) || 'N/A'}...
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium',
                      getStateColor(channel.state)
                    )}
                  >
                    {channel.state || 'UNKNOWN'}
                  </span>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-lightning" />
                      <span className="text-muted-foreground">{t('outbound')}</span>
                      <span className="font-mono font-semibold">
                        {formatValue(channel.balanceSat)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {formatValue(channel.inboundLiquiditySat || 0)}
                      </span>
                      <span className="text-muted-foreground">{t('inbound')}</span>
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lightning to-bitcoin transition-all"
                      style={{ width: `${balancePercent}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('total')}: {formatValue(channel.capacitySat)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => window.open(getMempoolUrl(chain, channel.fundingTxId), '_blank')}
                    className="glass-button flex-1 flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('viewOnMempool')}
                  </button>
                  <button
                    onClick={() => openCloseDialog(channel.channelId)}
                    disabled={
                      closingChannel === channel.channelId ||
                      (channel.state || '').toUpperCase() !== 'NORMAL'
                    }
                    className="glass-button flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {closingChannel === channel.channelId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        {t('close')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Close Channel Dialog */}
      <CloseChannelDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        channelId={selectedChannelId}
        chain={chain}
        onConfirm={handleCloseChannel}
      />
    </div>
  );
}
