'use client';

import { useEffect, useState } from 'react';
import { fetchSuggestions } from '../client-api';
import { isSuggestable } from '../query';
import type { Suggestions } from '../schema';

/**
 * Autosuggest for the header field (FR-SRCH-03).
 *
 * **This is the documented exception to CLAUDE.md's "no `useEffect` for data fetching".** That
 * rule exists because a fetch in an effect is nearly always a server fetch written in the wrong
 * place — and it is right nearly always. It cannot be right here: the panel answers a value that
 * has not been submitted and does not exist in the URL, so there is no server render to hang it
 * on. Every other search request in this app is server-side (`features/search/api.ts`); this one
 * is the interaction itself.
 *
 * Three things it has to get right, which is why it is a hook rather than a component body
 * (CLAUDE.md: more than ~2 `useState` and an effect means extract a hook):
 *
 *  1. **Debounce, 250ms** — a request per keystroke would issue six for "barbatos" and show
 *     whichever returned last.
 *  2. **Abort in flight** — even debounced, "barb" can resolve after "barbatos" and overwrite a
 *     better answer with a worse one. The cleanup aborts, so the last query typed is the last
 *     one rendered rather than the last one to arrive.
 *  3. **Keep the previous panel while the next loads** — clearing on every keystroke makes the
 *     dropdown flicker through a state it was never meant to show.
 *
 * Nothing is written to state from the effect body. Below the threshold the answer is *derived*
 * rather than cleared, which is both what `react-hooks/set-state-in-effect` asks for and the
 * simpler description: there is no such thing as a stale suggestion for a query too short to
 * have one.
 */

/** FR-SRCH-03. Long enough to skip the middle of a word, short enough to feel immediate. */
const DEBOUNCE_MS = 250;

export function useSuggestions(query: string): { suggestions: Suggestions | null } {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  useEffect(() => {
    if (!isSuggestable(query)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void load(query, controller, setSuggestions);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { suggestions: isSuggestable(query) ? suggestions : null };
}

/**
 * A failed suggestion is not an error state. The panel is an accelerator, not the only route to
 * a result — someone whose network blipped mid-word should get no dropdown and a working Enter
 * key, not a red box under their cursor. So a failure leaves the last good panel in place.
 */
async function load(
  query: string,
  controller: AbortController,
  setSuggestions: (value: Suggestions) => void,
): Promise<void> {
  try {
    const suggestions = await fetchSuggestions(query, controller.signal);

    // The cleanup aborts on the next keystroke, but a response already in the microtask queue
    // still resolves — this is what stops it painting over a newer answer.
    if (!controller.signal.aborted) setSuggestions(suggestions);
  } catch {
    // Aborts land here too, and an aborted request has a newer one behind it.
  }
}
