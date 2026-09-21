import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../common/errors/validation.error.js';
import { compressToWebp } from './image-compressor.js';

/**
 * Something shaped like a photograph: a smooth gradient with a little sensor noise. A flat colour
 * compresses to nothing in any format and pure noise does not compress at all, so neither says
 * anything about what happens to a real upload.
 */
async function photo(width: number, height: number, format: 'jpeg' | 'png' | 'webp' | 'gif'): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        const base = ((x + y * (channel + 1)) / (width + height * 3)) * 255;
        pixels[(y * width + x) * 3 + channel] = Math.max(0, Math.min(255, base + ((seed >>> 16) % 17) - 8));
      }
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } }).toFormat(format).toBuffer();
}

describe('compressToWebp', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('re-encodes %s as WebP', async (format) => {
    const result = await compressToWebp(await photo(300, 200, format), 2000);

    expect((await sharp(result.data).metadata()).format).toBe('webp');
    expect(result).toMatchObject({ width: 300, height: 200 });
  });

  it('shrinks the longest edge to the cap, keeping the aspect ratio', async () => {
    const result = await compressToWebp(await photo(3000, 1500, 'jpeg'), 1000);

    expect(result).toMatchObject({ width: 1000, height: 500 });
  });

  it('never enlarges an image smaller than the cap', async () => {
    const result = await compressToWebp(await photo(120, 80, 'png'), 2000);

    expect(result).toMatchObject({ width: 120, height: 80 });
  });

  it('comes out smaller than a lossless original', async () => {
    const original = await photo(800, 800, 'png');

    expect((await compressToWebp(original, 2000)).data.length).toBeLessThan(original.length);
  });

  it('turns the EXIF orientation into pixels, then drops the metadata', async () => {
    // Stored landscape, tagged "rotate 90°" — how a phone saves a portrait photo.
    const tagged = await sharp(await photo(400, 200, 'jpeg'))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await compressToWebp(tagged, 2000);
    const metadata = await sharp(result.data).metadata();

    expect(result).toMatchObject({ width: 200, height: 400 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('carries a tiny WebP blur placeholder', async () => {
    const { blurDataUrl } = await compressToWebp(await photo(400, 400, 'jpeg'), 2000);

    expect(blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect(blurDataUrl.length).toBeLessThan(1000);
  });

  it('refuses a format outside JPEG, PNG and WebP, whatever it was labelled', async () => {
    await expect(compressToWebp(await photo(20, 20, 'gif'), 2000)).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses an SVG, which is a document rather than a picture', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');

    await expect(compressToWebp(svg, 2000)).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses bytes that are not an image at all', async () => {
    await expect(compressToWebp(Buffer.from('definitely not a jpeg'), 2000)).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a canvas too large to decode safely, before decoding it', async () => {
    // A 10000×6000 single-colour PNG is tiny on disk and 60 megapixels in memory.
    const bomb = await sharp({ create: { width: 10_000, height: 6_000, channels: 3, background: '#000' } })
      .png()
      .toBuffer();

    await expect(compressToWebp(bomb, 2000)).rejects.toThrow(/megapixels/);
  });
});
