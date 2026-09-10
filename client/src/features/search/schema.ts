import { z } from 'zod';
import { SEARCH_STRATEGIES } from '@gunsnip/shared';
import { paginatedSchema, productSummarySchema } from '@/features/catalog/schema';

/**
 * The search API's responses (CLAUDE.md non-negotiable #4).
 *
 * The results page reuses the catalogue's own `productSummarySchema` and `paginatedSchema`
 * rather than declaring its own — a search result *is* a product card, and two schemas for one
 * shape would drift the first time a field was added to the card (FR-SRCH-06).
 */
export const searchResultsSchema = paginatedSchema(productSummarySchema).extend({
  query: z.string(),
  strategy: z.enum(SEARCH_STRATEGIES),
  didYouMean: z.string().nullable(),
});

export type SearchResults = z.infer<typeof searchResultsSchema>;

export const suggestionsSchema = z.object({
  query: z.string(),
  products: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      // Integer rupiah on the wire as everywhere else (PRD A2).
      priceIdr: z.int(),
      image: z
        .object({ url: z.string(), alt: z.string(), blurDataUrl: z.string() })
        .nullable(),
    }),
  ),
  categories: z.array(
    z.object({ name: z.string(), slug: z.string(), productCount: z.int() }),
  ),
});

export type Suggestions = z.infer<typeof suggestionsSchema>;
export type ProductSuggestion = Suggestions['products'][number];
