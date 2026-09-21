import sharp from 'sharp';

/** A small real PNG, for specs that upload an image. Generated rather than committed. */
export async function pngFixture(): Promise<Buffer> {
  return sharp({ create: { width: 120, height: 80, channels: 3, background: '#2a5bd7' } }).png().toBuffer();
}
