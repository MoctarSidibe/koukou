import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useOfflineQueue } from '@/offline';

/**
 * Pousse automatiquement la file offline dès qu'il reste des captures en
 * attente (la session étant en ligne) . Ne rend rien. Déclenché uniquement
 * sur une transition (connexion, ou nouvel op en attente) pour éviter toute
 * boucle de flush pendant une panne réseau.
 */
export function OfflineAutoSync() {
  const { farmId } = useAuth();
  const sync = useOfflineQueue(farmId);
  const pending = sync.pending.length;
  const prevPending = useRef(0);

  useEffect(() => {
    const wasEmpty = prevPending.current === 0;
    prevPending.current = pending;

    const newlyPending = wasEmpty && pending > 0;
    if (newlyPending) {
      void sync.flush();
    }
  }, [pending, sync]);

  return null;
}