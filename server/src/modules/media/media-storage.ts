import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/validation.error.js';
import { AppConfig } from '../../config/app-config.js';
import { compressToWebp } from './image-compressor.js';
import { MEDIA_KINDS, type MediaKind } from './media-kind.js';

/**
 * Where every uploaded image goes: product photos (FR-ADM-04), banners (FR-ADM-12) and review
 * photos (FR-REV-01).
 *
 * Files live on the API's own disk, under `MEDIA_DIR/<kind>/<uuid>.webp`, and the API serves them
 * at `MEDIA_PUBLIC_PATH/<kind>/<uuid>.webp` (see `bootstrap.ts`). The stored URL is a path, not an
 * absolute address, so the web app can proxy it same-origin and a CDN later changes the two
 * config values rather than every row.
 *
 * Every upload is re-encoded to WebP before it is written. Nothing the client sent is stored as
 * it arrived — not its bytes, not its name, not its claimed type.
 */

/**
 * The raw upload a client may send. Generous because it is compressed on arrival: a modern phone
 * photo is 4–8 MB, and refusing it would push the resizing onto a customer who has no tool for it.
 * Kept under the web app's 10 MB proxy buffer, which every admin upload passes through.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface StoredImage {
  url: string;
  blurDataUrl: string;
}

export interface UploadedFile {
  buffer: Buffer;
  size: number;
}

/** A name this class wrote: one known kind, a UUID, `.webp`. Nothing else is ever deleted. */
const STORED_NAME = /^(products|banners|reviews)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

@Injectable()
export class MediaStorage {
  constructor(private readonly config: AppConfig) {}

  /**
   * Compresses the file and writes it, returning what to store on the row.
   *
   * The name is a UUID, not the uploader's filename. An uploaded name is attacker-controlled text
   * that would end up in a path and a URL — and two uploads of `front.jpg` would otherwise
   * overwrite each other.
   */
  async store(file: UploadedFile, kind: MediaKind): Promise<StoredImage> {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ValidationError(`That image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, { size: file.size });
    }

    const image = await compressToWebp(file.buffer, MEDIA_KINDS[kind].maxEdge);
    const name = `${kind}/${randomUUID()}.webp`;

    await mkdir(join(this.directory, kind), { recursive: true });
    await writeFile(join(this.directory, name), image.data);

    return { url: `${this.config.mediaPublicPath}/${name}`, blurDataUrl: image.blurDataUrl };
  }

  /**
   * Whether a URL is one this class wrote for `kind`. A review may only carry photos that were
   * uploaded as review photos — not a banner, and not an address on somebody else's server.
   */
  isStored(url: string, kind: MediaKind): boolean {
    const name = this.nameOf(url);
    return name !== undefined && name.startsWith(`${kind}/`);
  }

  /**
   * Deletes the file behind a URL, when it is one we wrote.
   *
   * Best effort on purpose: the row is already gone, and a missing file is not a reason to fail
   * the request the operator actually made. Anything else — a seeded placeholder, a path from
   * before uploads were compressed — was not ours to write, so it is not ours to delete.
   */
  async remove(url: string): Promise<void> {
    const name = this.nameOf(url);
    if (name === undefined) return;

    await unlink(join(this.directory, name)).catch(() => undefined);
  }

  /** The `<kind>/<uuid>.webp` part of a URL, or `undefined` if the URL is not one of ours. */
  private nameOf(url: string): string | undefined {
    const prefix = `${this.config.mediaPublicPath}/`;
    if (!url.startsWith(prefix)) return undefined;

    const name = url.slice(prefix.length);
    // The pattern admits no separators beyond the one, so a stored URL cannot walk out of the directory.
    return STORED_NAME.test(name) ? name : undefined;
  }

  private get directory(): string {
    return resolve(this.config.mediaDir);
  }
}
