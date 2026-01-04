'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Loader2, AlertCircle, Zap, Keyboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const t = useTranslations('scanner');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return;

    setIsStarting(true);
    setError(null);

    try {
      // Configure scanner to focus only on QR codes for better performance
      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      // Calculate dynamic qrbox size based on container
      const containerWidth = containerRef.current.offsetWidth || 300;
      const qrboxSize = Math.min(containerWidth - 40, 280);

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15, // Higher fps for better scanning on mobile
          qrbox: { width: qrboxSize, height: qrboxSize },
          disableFlip: false, // Allow mirrored scanning
        },
        (decodedText) => {
          // Vibrate on success if supported
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // QR code not found - this is called frequently, ignore
        }
      );

      setHasPermission(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setHasPermission(false);
      if (err instanceof Error) {
        if (err.message.includes('Permission')) {
          setError(t('cameraPermissionDenied'));
        } else if (err.message.includes('NotFound') || err.message.includes('not found')) {
          setError(t('noCameraFound'));
        } else {
          setError(t('cameraError'));
        }
      } else {
        setError(t('cameraError'));
      }
    } finally {
      setIsStarting(false);
    }
  }, [onScan, onClose, stopScanner, t]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
        onClick={() => {
          stopScanner();
          onClose();
        }}
      />

      {/* Scanner Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('scanQrCode')}</h2>
                <p className="text-xs text-white/60">{t('scanToPayDescription')}</p>
              </div>
            </div>
            <button
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Scanner Container */}
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden bg-black aspect-square"
          >
            {/* QR Reader Element */}
            <div id="qr-reader" className="w-full h-full" />

            {/* Loading State */}
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
                <p className="text-sm text-white/70">{t('startingCamera')}</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-white/90 mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    scannerRef.current = null;
                    startScanner();
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
                >
                  {t('tryAgain')}
                </button>
              </div>
            )}

            {/* Scan Frame Overlay */}
            {hasPermission && !error && !isStarting && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner brackets */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                {/* Scan line animation */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>{t('scanInvoiceOrAddress')}</span>
            </div>
          </div>

          {/* Manual Payment Button */}
          <Link
            href="/send"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white font-medium"
          >
            <Keyboard className="h-5 w-5" />
            <span>{t('payManually')}</span>
          </Link>
        </div>
      </div>

      {/* Custom styles for html5-qrcode */}
      <style jsx global>{`
        #qr-reader {
          border: none !important;
          width: 100% !important;
          height: 100% !important;
        }
        #qr-reader video {
          border-radius: 1rem !important;
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        #qr-reader__scan_region {
          background: transparent !important;
          min-height: 250px !important;
        }
        #qr-reader__scan_region img {
          display: none !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
        #qr-reader__dashboard_section {
          display: none !important;
        }
        #qr-reader__camera_selection {
          display: none !important;
        }
        #qr-reader__header_message {
          display: none !important;
        }
        #qr-shaded-region {
          border-width: 50px !important;
        }
      `}</style>
    </>
  );
}
