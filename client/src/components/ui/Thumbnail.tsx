import Image from 'next/image';
import { cn } from '@/lib/cn';
import { isVectorImage } from '@/lib/image';

/**
 * A product's image, square, on the armor backdrop (DESIGN.md §3.4) — the cart line, the mini
 * cart, the checkout summary and a placed order's lines all draw it the same way.
 *
 * Decorative: wherever it appears the product name sits beside it, so the image carries an empty
 * `alt` rather than announcing the same kit twice.
 */
interface ThumbnailProps {
  src: string | null;
  /** Present for live catalogue images; a placed order's snapshot keeps only the URL. */
  blurDataUrl?: string;
  /** Rendered pixel size, for `sizes`. */
  size: 48 | 80;
  isDimmed?: boolean;
  className?: string;
}

export function Thumbnail({ src, blurDataUrl, size, isDimmed = false, className }: ThumbnailProps) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden bg-armor-050',
        // 80px gives way to 64px on a phone, where the name needs the width more.
        size === 80 ? 'size-16 sm:size-20' : 'size-12',
        isDimmed && 'opacity-60',
        className,
      )}
    >
      {src === null ? null : (
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          placeholder={blurDataUrl === undefined ? 'empty' : 'blur'}
          blurDataURL={blurDataUrl}
          unoptimized={isVectorImage(src)}
          className="object-cover"
        />
      )}
    </div>
  );
}
