import sharp from 'sharp';
import { ValidationError } from '../../common/errors/validation.error.js';

/**
 * Turns whatever an operator or a customer uploaded into a WebP the storefront can afford to
 * serve.
 *
 * A phone photo arrives as a 4–8 MB JPEG at 4000px; the same image as an 80-quality WebP capped
 * at 2000px is typically a few hundred KB and indistinguishable on a product page. Doing it once
 * at upload, rather than leaning on `next/image` at request time, means the file on disk is
 * already small — for the optimizer's cache, for a CDN later, and for every backup.
 *
 * The format is decided by decoding the bytes, never by the `Content-Type` the client sent: a
 * multipart part's type is whatever the sender wrote, and a file that does not decode as one of
 * the accepted formats is refused however it was labelled.
 *
 * `sharp` is the one dependency here, and it is here because Node has no image codec of its own.
 */
const ACCEPTED_FORMATS: ReadonlySet<string> = new Set(['jpeg', 'png', 'webp']);

/**
 * Decoding is bounded by pixels, not bytes. A small PNG can declare a 30000×30000 canvas and
 * expand to gigabytes in memory; 50 megapixels is above any real camera a customer holds and far
 * below that.
 */
const MAX_INPUT_PIXELS = 50_000_000;

/** Visually lossless for photographs of plastic; the curve flattens above this and the bytes do not. */
const WEBP_QUALITY = 80;

/** The width of the blur placeholder. It is stretched to fill the frame, so detail is waste. */
const BLUR_WIDTH = 16;

export interface CompressedImage {
  data: Buffer;
  width: number;
  height: number;
  /** A tiny WebP as a data URI, for `next/image`'s `placeholder="blur"` (DESIGN.md §7). */
  blurDataUrl: string;
}

export async function compressToWebp(input: Buffer, maxEdge: number): Promise<CompressedImage> {
  const header = await readHeader(input);

  if (header === undefined || !ACCEPTED_FORMATS.has(header.format)) {
    throw new ValidationError('That file is not an image we accept. Use JPEG, PNG or WebP.', {
      detected: header?.format ?? 'unknown',
    });
  }

  if (header.width * header.height > MAX_INPUT_PIXELS) {
    throw new ValidationError('That image is too large to process. Resize it below 50 megapixels.', {
      width: header.width,
      height: header.height,
    });
  }

  const source = () =>
    sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      // Applies the EXIF orientation before it is stripped, or a portrait phone photo lands sideways.
      .rotate();

  // Metadata — EXIF, GPS, camera serials — is dropped because sharp only keeps it when asked.
  // That matters most for review photos: a customer's picture of their build should not publish
  // the coordinates of their desk.
  const { data, info } = await source()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const blur = await source().resize({ width: BLUR_WIDTH }).webp({ quality: 40 }).toBuffer();

  return {
    data,
    width: info.width,
    height: info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  };
}

interface ImageHeader {
  format: string;
  width: number;
  height: number;
}

/**
 * Reads the header only — no pixels are decoded, so this is cheap even for the bomb it guards
 * against. `undefined` for bytes that are not an image at all, which is the same answer to the
 * caller as an image in the wrong format.
 */
async function readHeader(input: Buffer): Promise<ImageHeader | undefined> {
  try {
    const { format, width, height } = await sharp(input).metadata();
    return { format, width, height };
  } catch {
    return undefined;
  }
}
