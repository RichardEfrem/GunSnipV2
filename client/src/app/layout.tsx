import type { Metadata, Viewport } from 'next';
import { fontVariables } from '@/fonts/fonts';
import { BROWSER_THEME_COLOR } from '@/lib/constants';
import '@/styles/globals.css';

export const metadata: Metadata = {
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
