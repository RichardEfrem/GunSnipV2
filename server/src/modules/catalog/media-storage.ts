import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/validation.error.js';
import { AppConfig } from '../../config/app-config.js';

/**
 * Where an uploaded product image goes (FR-ADM-04).
 *
 * It goes to the *same* directory the seed's generated placeholders go to, and gets the same
 * kind of URL — `/media/products/<name>`. That is the whole reason there is no image host: one
 * media convention means a seeded product and an uploaded one are indistinguishable to every
 * consumer, and the day a CDN arrives only this file and `image-placeholder.ts` change.
 *
 * The directory is configuration rather than a constant, because a path that reaches across the
 * workspace into `client/public` is a deployment fact, not a business rule.
 */

/** What `next/image` can serve and a browser will render. SVG is accepted because the seed's
 *  own placeholders are SVG, and refusing it would make uploads the odd one out. */
const ACCEPTED: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** Large enough for a 2000px product shot, small enough that a stray upload cannot fill a disk. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * The placeholder `next/image` paints while the real file loads (DESIGN.md §7).
 *
 * A neutral armour grey rather than a colour sampled from the upload: sampling means decoding
 * the image, which means a decoder dependency (`sharp`) earning its place for one cosmetic
 * field. The seed's placeholders derive theirs from the plate they drew; an uploaded photo gets
 * the same family of grey, which is the point — it reads as the frame, not as a wrong guess at
 * the product's colour.
 */
const NEUTRAL_BLUR = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#dde1e7"/></svg>',
).toString('base64')}`;

export interface StoredImage {
  url: string;
  blurDataUrl: string;
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class MediaStorage {
  constructor(private readonly config: AppConfig) {}

  /**
   * Writes the file and returns the URL to store on the image row.
   *
   * The name is a UUID, not the operator's filename. An uploaded name is attacker-controlled
   * text that would end up in a path and a URL — and two operators uploading `front.jpg` for
   * different kits would otherwise overwrite each other.
   */
  async store(file: UploadedFile): Promise<StoredImage> {
    const extension = ACCEPTED[file.mimetype];

    if (extension === undefined) {
      throw new ValidationError(
        `${file.mimetype} is not an image we can serve. Use JPEG, PNG, WebP, AVIF or SVG.`,
        { mimetype: file.mimetype },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new ValidationError(`That image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, { size: file.size });
    }

    const filename = `${randomUUID()}.${extension}`;

    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer);

    return { url: `${this.config.mediaPublicPath}/${filename}`, blurDataUrl: NEUTRAL_BLUR };
  }

  /**
   * Deletes the file behind an image row, when it is one we wrote.
   *
   * Best effort on purpose: the row is already gone, and a missing file is not a reason to fail
   * the request the operator actually made. A URL outside the media path is left alone — it was
   * not ours to write, so it is not ours to delete.
   */
  async remove(url: string): Promise<void> {
    const prefix = `${this.config.mediaPublicPath}/`;
    if (!url.startsWith(prefix)) return;

    const filename = url.slice(prefix.length);
    // No separators, so a stored URL can never walk out of the media directory.
    if (filename.length === 0 || filename.includes('/') || filename.includes('\\') || filename.includes('..')) return;

    await unlink(join(this.directory, filename)).catch(() => undefined);
  }

  private get directory(): string {
    return resolve(this.config.mediaDir);
  }
}
