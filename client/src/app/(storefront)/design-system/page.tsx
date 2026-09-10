import type { Metadata } from 'next';
import { DesignSystemGallery } from './DesignSystemGallery';

export const metadata: Metadata = {
  title: 'Design system',
  description: 'Every token and primitive, in every state, in both themes.',
};

/**
 * The Phase 1 exit criterion, kept as a live page rather than a screenshot: every primitive in
 * all four states (DESIGN.md §4.5), in both themes, keyboard-navigable. It is the fastest way
 * to notice that a token change broke something three screens away.
 */
export default function DesignSystemPage() {
  return <DesignSystemGallery />;
}
