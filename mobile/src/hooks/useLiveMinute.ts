import { useEffect, useRef, useState } from 'react';

/** Fires `onTick` each time the wall-clock minute changes (react-keyed like Accueil). Skips the first minute after mount. */
export function useLiveMinute(onTick: () => void) {
  const [liveNow, setLiveNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const last = useRef('');
  useEffect(() => {
    const key = `${liveNow.getHours()}:${liveNow.getMinutes()}`;
    if (last.current === '') {
      last.current = key;
      return;
    }
    if (last.current === key) return;
    last.current = key;
    onTick();
  }, [liveNow, onTick]);
}