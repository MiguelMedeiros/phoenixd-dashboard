'use client';

import { useEffect, useState } from 'react';
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
import { formatSats, cn, getMempoolUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CloseChannelDialog } from '@/components/close-channel-dialog';
import { useTranslations } from 'next-intl';

export default function ChannelsPage() {
  const t = useTranslations('channels');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingChannel, setClosingChannel] = useState<string | null>(null);
  const [chain, setChain] = useState<string>('mainnet');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, nodeInfo] = await Promise.all([listChannels(), getNodeInfo()]);
        setChannels(channelsData || []);
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
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

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

  const getStateColor = (state: string) => {
    const normalizedState = state.toUpperCase();
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

  const totalCapacity = channels.reduce((acc, ch) => acc + ch.capacitySat, 0);
  const totalBalance = channels.reduce((acc, ch) => acc + ch.balanceSat, 0);
  const totalInbound = channels.reduce((acc, ch) => acc + ch.inboundLiquiditySat, 0);

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{formatSats(totalCapacity)}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{t('totalCapacity')}</span>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold value-highlight">{formatSats(totalBalance)}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lightning/10">
              <ArrowUpFromLine className="h-5 w-5 text-lightning" />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{t('outbound')}</span>
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-success">{formatSats(totalInbound)}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <ArrowDownToLine className="h-5 w-5 text-success" />
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{t('inbound')}</span>
        </div>
      </div>

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
              channel.capacitySat > 0 ? (channel.balanceSat / channel.capacitySat) * 100 : 0;

            return (
              <div key={channel.channelId} className="glass-card rounded-3xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono font-medium">{channel.channelId.slice(0, 16)}...</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {channel.fundingTxId.slice(0, 24)}...
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium',
                      getStateColor(channel.state)
                    )}
                  >
                    {channel.state}
                  </span>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-lightning" />
                      <span className="text-muted-foreground">{t('outbound')}</span>
                      <span className="font-mono font-semibold">
                        {formatSats(channel.balanceSat)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {formatSats(channel.inboundLiquiditySat)}
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
                    {t('total')}: {formatSats(channel.capacitySat)}
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
                      channel.state.toUpperCase() !== 'NORMAL'
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
