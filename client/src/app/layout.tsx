import type { Metadata, Viewport } from 'next';
import { fontVariables } from '@/fonts/fonts';
import { BROWSER_THEME_COLOR } from '@/lib/constants';
import { env } from '@/lib/env';
import '@/styles/globals.css';

export const metadata: Metadata = {
  // Lets every page declare its canonical as a path and have Next resolve it against this
  // origin (FR-PDP-14). Without it a relative canonical is dropped rather than resolved.
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: 'GunSnip', template: '%s · GunSnip' },
  description: 'Gunpla kits, tools and supplies, shipped across Indonesia.',
};

export const viewport: Viewport = {
  themeColor: BROWSER_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
