import Link from 'next/link';

/**
 * Frame, like the header — dark gunmetal, panel lines, no merchandise (DESIGN.md §1).
 *
 * Links point at routes later phases build. They are written now because the footer is where
 * people look for shipping and returns before they buy, and discovering that in Phase 10 means
 * rebuilding the information architecture late.
 */
const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All kits', href: '/kits' },
      { label: 'Tools and supplies', href: '/tools' },
      { label: 'Bundles', href: '/bundles' },
      { label: 'New arrivals', href: '/kits?sort=newest' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Track order', href: '/orders/track' },
      { label: 'Shipping', href: '/help/shipping' },
      { label: 'Returns', href: '/help/returns' },
      { label: 'Contact', href: '/help/contact' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'First build', href: '/guides/first-build' },
      { label: 'Tool guide', href: '/guides/tools' },
      { label: 'Panel lining', href: '/guides/panel-lining' },
      { label: 'All guides', href: '/guides' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="on-frame bg-frame-900 text-white">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4 md:px-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-semibold tracking-tight">GUNSNIP</p>
          <p className="max-w-measure text-sm text-frame-muted">
            Gunpla kits, tools and supplies. Shipped across Indonesia.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-2">
            <p className="font-display text-sm font-semibold">{column.heading}</p>
            {column.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="reticle w-fit rounded-sm text-sm text-frame-muted transition-colors duration-fast ease-out hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="border-t border-frame-700">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-frame-muted md:px-6">
          <p>© {new Date().getFullYear()} GunSnip</p>
          <p>Prices in Indonesian rupiah.</p>
        </div>
      </div>
    </footer>
  );
}
