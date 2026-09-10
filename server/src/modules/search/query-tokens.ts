/**
 * Turning what someone typed into the terms a search runs on (FR-SRCH-02, FR-SRCH-04).
 *
 * Pure functions over strings, with no database and no Prisma, because this is where the search
 * rules actually live: how a query is split, how far a synonym reaches, and what gets thrown
 * away. All of it is decided here so it can be tested by reading a table of inputs and outputs
 * rather than by seeding a database.
 *
 * The tokens never become SQL text. They are bound as parameters and handed to
 * `plainto_tsquery`, which is what makes an injection impossible rather than merely unlikely —
 * see `search.repository.ts`.
 */

/** Autosuggest waits for this much before asking (FR-SRCH-03). */
export const MIN_SUGGEST_LENGTH = 2;

/**
 * Longer than any real query and short enough that the tokeniser cannot be handed a novel.
 * Truncated rather than rejected: someone who pastes a paragraph meant to search for something
 * inside it, and an error page is a worse answer than the first few words.
 */
export const MAX_QUERY_LENGTH = 120;

/**
 * Each term is another `AND` in the tsquery and another set of bind parameters. Past this the
 * query cannot plausibly match anything anyway — the extra terms only cost planning time.
 */
export const MAX_TERMS = 8;

/** The longest synonym phrase worth looking for: "panel liner", "strike freedom". */
const MAX_PHRASE_WORDS = 3;

/**
 * One thing the customer asked for, and everything it should also match.
 *
 * A term is usually one word, but a synonym phrase — "nu gundam", "panel liner" — is one term
 * spanning several, because that is the unit the expansion applies to. Splitting it would ask
 * for products matching "nu" and separately "gundam", which is most of the catalogue.
 */
export interface QueryTerm {
  /** The words as typed, rejoined. Matched as a phrase. */
  phrase: string;
  /** Alternatives from the synonym table. Empty when nothing matched. */
  expansions: readonly string[];
}

/** Lower-cased, whitespace-collapsed, length-capped. The form every lookup below assumes. */
export function normalizeQuery(raw: string): string {
  return raw.slice(0, MAX_QUERY_LENGTH).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Words, with punctuation trimmed from the edges but kept inside.
 *
 * The inner characters matter more than they look: `rx-78-2`, `1/144` and `ver.ka` are all one
 * word to Postgres' text-search parser, and splitting them here would turn a precise query into
 * a vague one. Leading and trailing punctuation is stripped because it is always noise —
 * `"barbatos"` and `barbatos,` are the same search.
 */
export function tokenize(query: string): string[] {
  return normalizeQuery(query)
    .split(' ')
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => word.length > 0)
    .slice(0, MAX_TERMS);
}

/**
 * Every phrase a synonym could be filed under: each word, and each adjacent run up to
 * `MAX_PHRASE_WORDS`.
 *
 * Generated here and looked up in one query rather than probing the database per word — the
 * synonym table is small and the whole point is to ask it once.
 */
export function candidatePhrases(tokens: readonly string[]): string[] {
  const phrases = new Set<string>();

  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= MAX_PHRASE_WORDS && start + size <= tokens.length; size += 1) {
      phrases.add(tokens.slice(start, start + size).join(' '));
    }
  }

  return [...phrases];
}

/**
 * Tokens plus the synonym table, resolved into the terms a query is built from.
 *
 * **Longest phrase wins, left to right.** With "nu gundam" in the table, the query `mg nu
 * gundam` yields the terms `mg` and `nu gundam` — not three words, and not `nu` matched on its
 * own. Preferring the longer match is what stops a two-word synonym being shadowed by an entry
 * for its first word, and going left to right makes the result deterministic rather than
 * dependent on Map iteration order.
 *
 * A word that matches nothing is still a term. It just has no alternatives, and it still has to
 * match — synonyms widen a search, they never replace what was asked for.
 */
export function toQueryTerms(
  tokens: readonly string[],
  expansionsByPhrase: ReadonlyMap<string, readonly string[]>,
): QueryTerm[] {
  const terms: QueryTerm[] = [];
  let index = 0;

  while (index < tokens.length) {
    const match = longestPhraseAt(tokens, index, expansionsByPhrase);

    if (match === null) {
      terms.push({ phrase: tokens[index] ?? '', expansions: [] });
      index += 1;
      continue;
    }

    terms.push({ phrase: match.phrase, expansions: match.expansions });
    index += match.size;
  }

  return terms;
}

function longestPhraseAt(
  tokens: readonly string[],
  start: number,
  expansionsByPhrase: ReadonlyMap<string, readonly string[]>,
): { phrase: string; size: number; expansions: readonly string[] } | null {
  const longest = Math.min(MAX_PHRASE_WORDS, tokens.length - start);

  for (let size = longest; size >= 1; size -= 1) {
    const phrase = tokens.slice(start, start + size).join(' ');
    const expansions = expansionsByPhrase.get(phrase);

    if (expansions !== undefined && expansions.length > 0) {
      return { phrase, size, expansions };
    }
  }

  return null;
}

/**
 * The word still being typed, in both the forms a search needs it (FR-SRCH-03).
 *
 * Two fields rather than one because the two matching strategies want different text, and
 * neither alone is sufficient — see `toTsquery` in the repository.
 */
export interface PrefixTerm {
  /** As typed, hyphens and all. Goes to `plainto_tsquery` as a complete word. */
  phrase: string;
  /** Letters and digits only, so `:*` can be appended to it. */
  token: string;
}

/**
 * The last word, prepared for prefix matching.
 *
 * The `token` half drops everything but letters and digits rather than escaping it. `to_tsquery`
 * is the one text-search entry point that parses operators out of its argument, so the only
 * argument worth trusting is one that cannot contain an operator in the first place — and a
 * half-typed word is not the place to be clever about `&` and `!`. The `phrase` half keeps the
 * original, which is safe because `plainto_tsquery` treats its whole argument as text.
 *
 * Null when there is no last word, or when nothing survives the stripping — read by the caller
 * as "no prefix term", not as an error.
 */
export function toPrefixTerm(word: string | undefined): PrefixTerm | null {
  if (word === undefined) return null;

  const token = word.replace(/[^\p{L}\p{N}]/gu, '');
  return token.length === 0 ? null : { phrase: word, token };
}

/** Whether autosuggest should fire at all (FR-SRCH-03). */
export function isSuggestable(query: string): boolean {
  return normalizeQuery(query).length >= MIN_SUGGEST_LENGTH;
}
