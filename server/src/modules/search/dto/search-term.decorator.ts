import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_QUERY_LENGTH, normalizeQuery } from '../query-tokens.js';

/**
 * The `?q=` parameter, validated and normalised the same way everywhere it appears.
 *
 * Composed rather than repeated because three endpoints take a query term and TypeScript has no
 * multiple inheritance to give them — the results DTO already extends the listing DTO and the
 * facets DTO already extends the filter DTO, so neither can also extend a shared base. Two
 * hand-copied blocks would eventually disagree about the length cap, and the endpoint that
 * disagreed would be the one nobody tested.
 *
 * Normalising in the transform means everything downstream — the tokeniser, the echoed `query`,
 * the cache key — sees one canonical form. `Barbatos  ` and `barbatos` are one search, not two.
 */
export function IsSearchTerm(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? normalizeQuery(value) : value)),
    IsString(),
    MinLength(1),
    MaxLength(MAX_QUERY_LENGTH),
  );
}
