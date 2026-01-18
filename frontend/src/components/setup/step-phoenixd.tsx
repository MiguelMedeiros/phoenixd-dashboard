'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Server,
  ExternalLink,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { testSetupPhoenixdConnection } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PhoenixdConnection {
  name: string;
  url: string;
  password: string;
  tested?: boolean;
  nodeId?: string;
  chain?: string;
}

export interface PhoenixdConfig {
  type: 'docker' | 'external';
  connections: PhoenixdConnection[];
}

interface StepPhoenixdProps {
  value: PhoenixdConfig;
  onChange: (value: PhoenixdConfig) => void;
}

export function StepPhoenixd({ value, onChange }: StepPhoenixdProps) {
  const t = useTranslations('setup.phoenixd');
  const [testing, setTesting] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTypeChange = (type: 'docker' | 'external') => {
    onChange({
      type,
      connections:
        type === 'external' && value.connections.length === 0
          ? [{ name: 'External Phoenixd', url: '', password: '' }]
          : value.connections,
    });
  };

  const addConnection = () => {
    onChange({
      ...value,
      connections: [
        ...value.connections,
        { name: `Connection ${value.connections.length + 1}`, url: '', password: '' },
      ],
    });
  };

  const removeConnection = (index: number) => {
    onChange({
      ...value,
      connections: value.connections.filter((_, i) => i !== index),
    });
  };

  const updateConnection = (index: number, updates: Partial<PhoenixdConnection>) => {
    onChange({
      ...value,
      connections: value.connections.map((conn, i) =>
        i === index ? { ...conn, ...updates, tested: false } : conn
      ),
    });
  };

  const testConnection = async (index: number) => {
    const conn = value.connections[index];
    if (!conn.url) return;

    setTesting(index);
    setTestError(null);

    try {
      const result = await testSetupPhoenixdConnection(conn.url, conn.password);

      if (result.success) {
        updateConnection(index, {
          tested: true,
          nodeId: result.nodeId,
          chain: result.chain,
        });
      } else {
        setTestError(result.error || t('testFailed'));
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : t('testFailed'));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleTypeChange('docker')}
          className={cn(
            'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
            value.type === 'docker'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <div
            className={cn(
              'h-14 w-14 rounded-xl flex items-center justify-center',
              value.type === 'docker' ? 'bg-primary/20' : 'bg-muted'
            )}
          >
            <Server
              className={cn(
                'h-7 w-7',
                value.type === 'docker' ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <div className="text-center">
            <span className={cn('font-medium block', value.type === 'docker' && 'text-primary')}>
              {t('dockerTitle')}
            </span>
            <span className="text-xs text-muted-foreground">{t('dockerDesc')}</span>
          </div>
        </button>

        <button
          onClick={() => handleTypeChange('external')}
          className={cn(
            'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
            value.type === 'external'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <div
            className={cn(
              'h-14 w-14 rounded-xl flex items-center justify-center',
              value.type === 'external' ? 'bg-primary/20' : 'bg-muted'
            )}
          >
            <ExternalLink
              className={cn(
                'h-7 w-7',
                value.type === 'external' ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <div className="text-center">
            <span className={cn('font-medium block', value.type === 'external' && 'text-primary')}>
              {t('externalTitle')}
            </span>
            <span className="text-xs text-muted-foreground">{t('externalDesc')}</span>
          </div>
        </button>
      </div>

      {/* Docker Info */}
      {value.type === 'docker' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
          <Zap className="h-5 w-5 text-success flex-shrink-0" />
          <p className="text-sm text-success">{t('dockerInfo')}</p>
        </div>
      )}

      {/* External Connections */}
      {value.type === 'external' && (
        <div className="space-y-4">
          {value.connections.map((conn, index) => (
            <div key={index} className="p-4 rounded-lg border border-border space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {t('connection')} {index + 1}
                </Label>
                {value.connections.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConnection(index)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`name-${index}`}>{t('nameLabel')}</Label>
                  <Input
                    id={`name-${index}`}
                    value={conn.name}
                    onChange={(e) => updateConnection(index, { name: e.target.value })}
                    placeholder={t('namePlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`url-${index}`}>{t('urlLabel')}</Label>
                  <Input
                    id={`url-${index}`}
                    value={conn.url}
                    onChange={(e) => updateConnection(index, { url: e.target.value })}
                    placeholder="http://192.168.1.100:9740"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`password-${index}`}>{t('passwordLabel')}</Label>
                  <Input
                    id={`password-${index}`}
                    type="password"
                    value={conn.password}
                    onChange={(e) => updateConnection(index, { password: e.target.value })}
                    placeholder={t('passwordPlaceholder')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(index)}
                    disabled={!conn.url || testing === index}
                  >
                    {testing === index ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('testing')}
                      </>
                    ) : (
                      t('testConnection')
                    )}
                  </Button>

                  {conn.tested && (
                    <div className="flex items-center gap-2 text-success text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {conn.chain} - {conn.nodeId?.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {testError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{testError}</span>
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={addConnection}>
            <Plus className="h-4 w-4" />
            {t('addConnection')}
          </Button>
        </div>
      )}
    </div>
  );
}
