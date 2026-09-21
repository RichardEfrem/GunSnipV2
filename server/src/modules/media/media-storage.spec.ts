import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../common/errors/validation.error.js';
import { AppConfig } from '../../config/app-config.js';
import { validateEnv } from '../../config/env.schema.js';
import { MAX_IMAGE_BYTES, MediaStorage } from './media-storage.js';

describe('MediaStorage', () => {
  let directory: string;
  let storage: MediaStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gunsnip-media-'));
    storage = new MediaStorage(
      new AppConfig(validateEnv({ DATABASE_URL: 'postgresql://unused', ADMIN_KEY: 'k'.repeat(16), MEDIA_DIR: directory })),
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function png(): Promise<{ buffer: Buffer; size: number }> {
    const buffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#2a5bd7' } }).png().toBuffer();
    return { buffer, size: buffer.length };
  }

  it('writes a WebP under its kind, named by UUID, and returns the public path', async () => {
    const stored = await storage.store(await png(), 'reviews');

    expect(stored.url).toMatch(/^\/media\/uploads\/reviews\/[0-9a-f-]{36}\.webp$/);

    const [name] = await readdir(join(directory, 'reviews'));
    const written = await readFile(join(directory, 'reviews', name ?? ''));
    expect((await sharp(written).metadata()).format).toBe('webp');
  });

  it('refuses a file over the size cap without decoding it', async () => {
    await expect(storage.store({ buffer: Buffer.alloc(0), size: MAX_IMAGE_BYTES + 1 }, 'products')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('recognises its own URLs, per kind', async () => {
    const { url } = await storage.store(await png(), 'reviews');

    expect(storage.isStored(url, 'reviews')).toBe(true);
    expect(storage.isStored(url, 'banners')).toBe(false);
    expect(storage.isStored('https://elsewhere.example/cat.webp', 'reviews')).toBe(false);
    expect(storage.isStored('/media/products/mg-exia-0.svg', 'products')).toBe(false);
  });

  it('removes a file it wrote', async () => {
    const { url } = await storage.store(await png(), 'banners');

    await storage.remove(url);

    expect(await readdir(join(directory, 'banners'))).toEqual([]);
  });

  it('never deletes outside what it wrote, however the URL is dressed up', async () => {
    const bystander = join(directory, 'keep.webp');
    await writeFile(bystander, 'x');

    await storage.remove('/media/uploads/../keep.webp');
    await storage.remove('/media/uploads/products/../../keep.webp');
    await storage.remove('/media/uploads/keep.webp');

    expect(await readFile(bystander, 'utf8')).toBe('x');
  });
});
