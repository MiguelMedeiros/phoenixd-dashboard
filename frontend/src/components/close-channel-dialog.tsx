'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CloseChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  chain: string;
  onConfirm: (address: string, feerateSatByte: number) => Promise<void>;
}

export function CloseChannelDialog({
  open,
  onOpenChange,
  channelId,
  chain,
  onConfirm,
}: CloseChannelDialogProps) {
  const [address, setAddress] = useState('');
  const [feeRate, setFeeRate] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTestnet = chain.toLowerCase().includes('testnet');
  const addressPrefix = isTestnet ? 'tb1' : 'bc1';
  const placeholder = isTestnet ? 'tb1q... (testnet address)' : 'bc1q... (mainnet address)';

  const validateAddress = (addr: string): boolean => {
    if (!addr) return false;

    // Basic validation for Bitcoin addresses
    if (isTestnet) {
      // Testnet: tb1, m, n, 2
      return /^(tb1|[mn2])[a-zA-Z0-9]+$/.test(addr);
    } else {
      // Mainnet: bc1, 1, 3
      return /^(bc1|[13])[a-zA-Z0-9]+$/.test(addr);
    }
  };

  const handleConfirm = async () => {
    setError('');

    if (!address) {
      setError('Bitcoin address is required');
      return;
    }

    if (!validateAddress(address)) {
      setError(
        `Invalid ${isTestnet ? 'testnet' : 'mainnet'} address. Should start with ${addressPrefix}`
      );
      return;
    }

    const feeRateNum = parseInt(feeRate);
    if (isNaN(feeRateNum) || feeRateNum < 1) {
      setError('Fee rate must be at least 1 sat/vB');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(address, feeRateNum);
      onOpenChange(false);
      setAddress('');
      setFeeRate('10');
    } catch (err) {
      setError((err as Error).message || 'Failed to close channel');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setAddress('');
      setFeeRate('10');
      setError('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Close Channel
          </DialogTitle>
          <DialogDescription>
            This will close your Lightning channel and send the funds to the Bitcoin address you
            specify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channelId">Channel ID</Label>
            <Input
              id="channelId"
              value={channelId.slice(0, 24) + '...'}
              disabled
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">
              Bitcoin Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              placeholder={placeholder}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Funds will be sent to this address after channel closes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeRate">
              Fee Rate (sat/vB) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="feeRate"
              type="number"
              min="1"
              placeholder="10"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Higher fee = faster confirmation. Recommended: 5-20 sat/vB
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-500">
            <strong>Warning:</strong> Closing a channel is irreversible. Make sure the address is
            correct!
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading || !address}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing...
              </>
            ) : (
              'Close Channel'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
