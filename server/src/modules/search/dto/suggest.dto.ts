import { IsInt, IsOptional, Max, Min, MinLength } from 'class-validator';
import { ToInt } from '../../../common/transforms/query.js';
import { MIN_SUGGEST_LENGTH } from '../query-tokens.js';
import { IsSearchTerm } from './search-term.decorator.js';

/**
 * An autosuggest request (FR-SRCH-03).
 *
 * The two-character floor is enforced here rather than only in the client. The debounce is a
 * client concern — it decides *when* to ask — but "one character is not a search" is a rule
 * about the endpoint, and a rule that lives only in the browser is one a script can ignore. A
 * single character matches most of the catalogue and returns the least useful panel possible.
 */
export class SuggestDto {
  @IsSearchTerm()
  @MinLength(MIN_SUGGEST_LENGTH)
  readonly q!: string;

  /** Rows in the panel. Small by default: a dropdown longer than the fold is a results page. */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(10)
  readonly limit?: number;
}
