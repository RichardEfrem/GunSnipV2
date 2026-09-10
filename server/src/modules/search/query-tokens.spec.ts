import { describe, expect, it } from 'vitest';
import {
  candidatePhrases,
  isSuggestable,
  normalizeQuery,
  toPrefixTerm,
  toQueryTerms,
  tokenize,
  MAX_TERMS,
} from './query-tokens.js';

/**
 * The search rules that do not need a database.
 *
 * These are worth testing directly because every one of them changes what a customer gets back
 * and none of them is visible in a result set: a tokeniser that split `rx-78-2` would quietly
 * turn a precise query into a vague one, and a synonym that matched a single word ahead of the
 * phrase containing it would widen a search nobody asked to widen.
 */

const synonyms = new Map<string, readonly string[]>([
  ['barbatos', ['asw-g-08', 'ibo']],
  ['nu gundam', ['rx-93', 'nu']],
  ['nu', ['rx-93']],
]);

describe('normalizeQuery', () => {
  it('lower-cases, trims and collapses whitespace', () => {
    expect(normalizeQuery('  MG   Barbatos  ')).toBe('mg barbatos');
  });

  it('caps length rather than rejecting, so a pasted paragraph still searches', () => {
    expect(normalizeQuery('a'.repeat(500))).toHaveLength(120);
  });
});

describe('tokenize', () => {
  it('keeps punctuation inside a word', () => {
    // Postgres' text-search parser treats each of these as one token. Splitting them here
    // would turn a part number into three meaningless fragments.
    expect(tokenize('rx-78-2')).toEqual(['rx-78-2']);
    expect(tokenize('1/144 ver.ka')).toEqual(['1/144', 'ver.ka']);
  });

  it('strips punctuation from the edges', () => {
    expect(tokenize('"barbatos", (mg)')).toEqual(['barbatos', 'mg']);
  });

  it('drops anything that was only punctuation', () => {
    expect(tokenize('!!! ??? barbatos')).toEqual(['barbatos']);
  });

  it('caps the number of terms', () => {
    expect(tokenize('a b c d e f g h i j k l')).toHaveLength(MAX_TERMS);
  });
});

describe('candidatePhrases', () => {
  it('offers each word and each adjacent run, so a multi-word synonym can be found', () => {
    expect(candidatePhrases(['nu', 'gundam'])).toEqual(['nu', 'nu gundam', 'gundam']);
  });

  it('is empty for an empty query, so no lookup is made at all', () => {
    expect(candidatePhrases([])).toEqual([]);
  });
});

describe('toQueryTerms', () => {
  it('attaches expansions to the word that matched (FR-SRCH-04)', () => {
    expect(toQueryTerms(['barbatos'], synonyms)).toEqual([
      { phrase: 'barbatos', expansions: ['asw-g-08', 'ibo'] },
    ]);
  });

  it('prefers the longest phrase, so "nu gundam" is not matched as "nu"', () => {
    // Both are in the table. Taking the single word would expand to every RX-93 product and
    // leave "gundam" as a separate required term — a wider search than the customer asked for.
    expect(toQueryTerms(['nu', 'gundam'], synonyms)).toEqual([
      { phrase: 'nu gundam', expansions: ['rx-93', 'nu'] },
    ]);
  });

  it('keeps an unmatched word as a term with no alternatives', () => {
    // Synonyms widen a search; they never replace what was typed. "mg" still has to match.
    expect(toQueryTerms(['mg', 'barbatos'], synonyms)).toEqual([
      { phrase: 'mg', expansions: [] },
      { phrase: 'barbatos', expansions: ['asw-g-08', 'ibo'] },
    ]);
  });

  it('returns nothing for no tokens, so the caller can skip the query entirely', () => {
    expect(toQueryTerms([], synonyms)).toEqual([]);
  });
});

describe('toPrefixTerm', () => {
  it('keeps the word as typed and a stripped form beside it', () => {
    // `token` is concatenated with `:*` and handed to `to_tsquery`, which parses operators out
    // of its argument — so that half must not be able to contain one. `phrase` goes to
    // `plainto_tsquery`, which treats everything as text, so it keeps the hyphens that make
    // `rx-78-2` match the lexemes Postgres actually indexed.
    expect(toPrefixTerm('rx-78-2')).toEqual({ phrase: 'rx-78-2', token: 'rx782' });
    expect(toPrefixTerm("barba' & !x")).toEqual({ phrase: "barba' & !x", token: 'barbax' });
  });

  it('is null when nothing survives, rather than an empty prefix matching everything', () => {
    expect(toPrefixTerm('!!!')).toBeNull();
    expect(toPrefixTerm(undefined)).toBeNull();
  });
});

describe('isSuggestable', () => {
  it('holds the panel back until two characters (FR-SRCH-03)', () => {
    expect(isSuggestable('b')).toBe(false);
    expect(isSuggestable('ba')).toBe(true);
    // Whitespace is not a character someone typed at the catalogue.
    expect(isSuggestable(' b ')).toBe(false);
  });
});
