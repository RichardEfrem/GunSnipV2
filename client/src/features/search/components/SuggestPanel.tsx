import Image from 'next/image';
import Link from 'next/link';
import { formatIdr } from '@/lib/formatters';
import type { Suggestions } from '../schema';

/**
 * The autosuggest dropdown (FR-SRCH-03).
 *
 * Presentational on purpose — it takes the suggestions and renders them, and the field above
 * owns the query, the keyboard and the open state. That split is what lets the panel stay a
 * plain function of its props while the interaction lives in one place.
 *
 * Styled as the header's other dropdown is (`NavDropdown`): it descends out of the dark header
 * onto the light armor surface rather than continuing the frame palette, so the two panels that
 * can open from the same bar look like the same mechanism.
 *
 * Rows are real links, so a suggestion can be middle-clicked, copied or opened in a new tab.
 * They are also options inside a listbox, which is what makes the arrow keys mean something to
 * a screen reader rather than being a purely visual highlight.
 */
interface SuggestPanelProps {
  suggestions: Suggestions;
  /** The row the arrow keys are on, or -1. Indexes products then categories, in that order. */
  activeIndex: number;
  /** Ids for `aria-activedescendant`, so the active row can be announced without moving focus. */
  optionId: (index: number) => string;
  onNavigate: () => void;
  id: string;
}

export function SuggestPanel({
  suggestions,
  activeIndex,
  optionId,
  onNavigate,
  id,
}: SuggestPanelProps) {
  const { products, categories } = suggestions;

  if (products.length === 0 && categories.length === 0) {
    return (
      // Keeps the id the input's `aria-controls` points at — a dangling reference is worse than
      // no panel, because a screen reader announces a control that leads nowhere.
      <div
        id={id}
        role="status"
        className="enter-settle on-armor absolute inset-x-0 top-full z-40 mt-1 border border-armor-150 bg-armor-000 px-4 py-6 text-center text-sm text-frame-300 shadow-float"
      >
        Nothing matches “{suggestions.query}” yet — press Enter to search anyway.
      </div>
    );
  }

  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Search suggestions"
      className="enter-settle on-armor absolute inset-x-0 top-full z-40 mt-1 flex flex-col overflow-hidden border border-armor-150 bg-armor-000 text-ink shadow-float"
    >
      {products.map((product, index) => (
        <li key={product.id} id={optionId(index)} role="option" aria-selected={index === activeIndex}>
          <Link
            href={`/products/${product.slug}`}
            onClick={onNavigate}
            tabIndex={-1}
            className={`flex items-center gap-3 px-3 py-2 transition-colors duration-fast ease-out ${
              index === activeIndex ? 'bg-core-blue-tint' : 'hover:bg-core-blue-tint'
            }`}
          >
            <span className="relative size-10 shrink-0 overflow-hidden bg-armor-050">
              {product.image === null ? null : (
                <Image
                  src={product.image.url}
                  alt=""
                  fill
                  sizes="40px"
                  placeholder="blur"
                  blurDataURL={product.image.blurDataUrl}
                  className="object-cover"
                />
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>

            <span className="shrink-0 text-sm tabular-nums text-frame-300">
              {formatIdr(product.priceIdr)}
            </span>
          </Link>
        </li>
      ))}

      {products.length === 0 || categories.length === 0 ? null : (
        <li aria-hidden className="border-t border-armor-150" />
      )}

      {categories.map((category, index) => {
        const rowIndex = products.length + index;

        return (
          <li
            key={category.slug}
            id={optionId(rowIndex)}
            role="option"
            aria-selected={rowIndex === activeIndex}
          >
            <Link
              href={`/${category.slug}`}
              onClick={onNavigate}
              tabIndex={-1}
              className={`flex items-center justify-between gap-3 px-3 py-2 transition-colors duration-fast ease-out ${
                rowIndex === activeIndex ? 'bg-core-blue-tint' : 'hover:bg-core-blue-tint'
              }`}
            >
              <span className="truncate text-sm text-frame-300">
                in <span className="text-ink">{category.name}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-frame-300">
                {category.productCount}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
