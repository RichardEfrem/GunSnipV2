'use client';

import { useEffect, useState } from 'react';

/**
 * Seconds left until `deadline`, ticking once a second, floored at zero.
 *
 * `null` until the component has mounted. The server and the browser do not agree on what time
 * it is, so rendering a duration during hydration would either mismatch or lock in the server's
 * clock; the caller shows a placeholder for that one frame and the absolute deadline beside it,
 * which is what a visitor without JavaScript is left with anyway.
 *
 * A `useEffect` because this is a timer, not a fetch — nothing here reads from the network.
 */
export function useCountdown(deadline: string): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const expiresAt = Date.parse(deadline);
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  return secondsLeft;
}
