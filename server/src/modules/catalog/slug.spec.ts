import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../common/errors/validation.error.js';
import { resolveSlug, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('MG Gundam Barbatos Lupus Rex')).toBe('mg-gundam-barbatos-lupus-rex');
  });

  it('collapses runs of punctuation rather than leaving empty segments', () => {
    expect(slugify('RG 1/144 — Nu Gundam!!!')).toBe('rg-1-144-nu-gundam');
  });

  it('keeps accented letters as their base letter instead of dropping them', () => {
    expect(slugify('Gundam Épyon')).toBe('gundam-epyon');
  });

  it('never starts or ends with a hyphen', () => {
    expect(slugify('  --Perfect Grade--  ')).toBe('perfect-grade');
  });
});

describe('resolveSlug', () => {
  it('derives from the name when none is supplied', () => {
    expect(resolveSlug('MG Gundam Exia', undefined)).toBe('mg-gundam-exia');
  });

  it('normalises a supplied slug rather than trusting it verbatim', () => {
    expect(resolveSlug('MG Gundam Exia', 'MG Exia Special')).toBe('mg-exia-special');
  });

  it('refuses a name with nothing sluggable in it, rather than inventing an id', () => {
    const attempt = () => resolveSlug('???', undefined);

    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow('give it a slug');
  });

  it('names the supplied value when that is what is unusable', () => {
    expect(() => resolveSlug('MG Gundam Exia', '///')).toThrow('is not a usable web address');
  });
});

describe('uniqueSlug', () => {
  it('returns the slug untouched when it is free', async () => {
    await expect(uniqueSlug('mg-exia', async () => false)).resolves.toBe('mg-exia');
  });

  it('counts upward past the ones already taken', async () => {
    const taken = new Set(['mg-exia', 'mg-exia-2']);

    await expect(uniqueSlug('mg-exia', async (candidate) => taken.has(candidate))).resolves.toBe('mg-exia-3');
  });

  it('gives up rather than looping forever when everything is taken', async () => {
    await expect(uniqueSlug('mg-exia', async () => true, 3)).rejects.toThrow('are all taken');
  });
});
