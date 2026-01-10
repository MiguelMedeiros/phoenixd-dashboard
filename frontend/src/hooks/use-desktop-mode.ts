import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useDesktopMode() {
  const [isDesktopMode, setIsDesktopMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDesktopMode = async () => {
      try {
        const response = await fetch(`${API_URL}/health`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsDesktopMode(data.desktopMode === true);
        }
      } catch {
        // If we can't reach the API, assume it's not desktop mode
        setIsDesktopMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkDesktopMode();
  }, []);

  return { isDesktopMode, loading };
}
