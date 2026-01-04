'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: Record<string, unknown>;
}

interface UseNotificationsReturn {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (options: NotificationOptions) => Notification | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => void;
}

const NOTIFICATION_ENABLED_KEY = 'phoenixd_notifications_enabled';

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if notifications are supported and get current permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermission);

      // Check if user has enabled notifications in our app
      const enabled = localStorage.getItem(NOTIFICATION_ENABLED_KEY) === 'true';
      setIsEnabled(enabled && Notification.permission === 'granted');
    }
  }, []);

  // Request permission from the browser
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result as NotificationPermission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [isSupported]);

  // Enable notifications (request permission if needed)
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    let currentPermission = permission;

    if (currentPermission === 'default') {
      currentPermission = await requestPermission();
    }

    if (currentPermission === 'granted') {
      localStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    }

    return false;
  }, [isSupported, permission, requestPermission]);

  // Disable notifications
  const disableNotifications = useCallback(() => {
    localStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
    setIsEnabled(false);
  }, []);

  // Send a notification
  const sendNotification = useCallback(
    (options: NotificationOptions): Notification | null => {
      if (!isSupported || !isEnabled || permission !== 'granted') {
        return null;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192x192.png',
          badge: options.badge || '/icons/icon-96x96.png',
          tag: options.tag,
          requireInteraction: options.requireInteraction || false,
          silent: options.silent || false,
          data: options.data,
        });

        // Handle notification click - focus the window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);

        return notification;
      } catch (error) {
        console.error('Error sending notification:', error);
        return null;
      }
    },
    [isSupported, isEnabled, permission]
  );

  return {
    permission,
    isSupported,
    isEnabled,
    requestPermission,
    sendNotification,
    enableNotifications,
    disableNotifications,
  };
}

// Helper to format sats for notification
export function formatSatsForNotification(sats: number): string {
  if (sats >= 1_000_000) {
    return `${(sats / 1_000_000).toFixed(2)}M sats`;
  }
  if (sats >= 1_000) {
    return `${(sats / 1_000).toFixed(1)}K sats`;
  }
  return `${sats.toLocaleString()} sats`;
}

// Play notification sound
export function playNotificationSound(): void {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}
