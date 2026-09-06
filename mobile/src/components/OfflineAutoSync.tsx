import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useOfflineQueue } from '@/offline';

/**
 * Pousse automatiquement la file offline dès que la session redevient en
 * ligne (mode live) et qu'il reste des captures en attente. Ne rend rien.
 * Déclenché uniquement sur une transition (connexion, ou nouvel op en
 * attente) pour éviter toute boucle de flush pendant une panne réseau.
 */
export function OfflineAutoSync() {
  const { mode, farmId } = useAuth();
  const sync = useOfflineQueue(farmId);
  const pending = sync.pending.length;
  const prevLive = useRef<boolean | null>(null);
  const prevPending = useRef(0);

  useEffect(() => {
    const liveNow = mode === 'live';
    const wasLive = prevLive.current ?? false;
    const wasEmpty = prevPending.current === 0;
    prevLive.current = liveNow;
    prevPending.current = pending;

    const justConnected = liveNow && !wasLive && pending > 0;
    const newlyPending = liveNow && wasLive && wasEmpty && pending > 0;
    if (justConnected || newlyPending) {
      void sync.flush();
    }
  }, [mode, pending, sync]);

  return null;
}