import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import type { CreateBannerDto, UpdateBannerDto } from './dto/write-banner.dto.js';
import type { ReorderDto } from './dto/reorder.dto.js';
import { MediaStorage, type StoredImage, type UploadedFile } from '../media/media-storage.js';
import { BannerRepository, type AdminBanner } from './banner.repository.js';

/**
 * Banner and home-rail curation (FR-ADM-12, FR-PROMO-04).
 *
 * The only rule worth a service: a banner's window has to make sense. Both dates are optional —
 * a banner with neither is simply on while `isActive` is true — but an end before a start is a
 * banner that will never show, and an operator who has just scheduled a campaign should be told
 * that now rather than wondering next week why the home page never changed.
 *
 * The image is uploaded on its own first and the banner then names the URL it was given, because
 * a banner's other fields are JSON with dates, booleans and integers that multipart would flatten
 * into strings. A failed save after a successful upload leaves an unreferenced file — invisible
 * and reclaimable, the same trade product images make. A file the banner stops pointing at, by
 * replacement or deletion, is removed.
 */
@Injectable()
export class BannerAdminService {
  constructor(
    private readonly banners: BannerRepository,
    private readonly media: MediaStorage,
  ) {}

  async uploadImage(file: UploadedFile | undefined): Promise<Pick<StoredImage, 'url'>> {
    if (file === undefined) throw new ValidationError('No image file was attached.', {});

    const { url } = await this.media.store(file, 'banners');
    return { url };
  }

  async list(): Promise<AdminBanner[]> {
    return this.banners.listAll();
  }

  async create(dto: CreateBannerDto): Promise<AdminBanner> {
    const window = this.window(dto.startsAt, dto.endsAt);

    return this.banners.create({
      title: dto.title,
      subtitle: dto.subtitle ?? null,
      imageUrl: dto.imageUrl,
      alt: dto.alt,
      href: dto.href,
      position: dto.position ?? (await this.banners.nextPosition()),
      ...window,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdateBannerDto): Promise<AdminBanner> {
    const existing = await this.require(id);

    // Resolved against what is stored, because a partial update may move either end.
    const window = this.window(
      dto.startsAt === undefined ? existing.startsAt : dto.startsAt,
      dto.endsAt === undefined ? existing.endsAt : dto.endsAt,
    );

    const updated = await this.banners.update(id, {
      ...(dto.title === undefined ? {} : { title: dto.title }),
      ...(dto.subtitle === undefined ? {} : { subtitle: dto.subtitle }),
      ...(dto.imageUrl === undefined ? {} : { imageUrl: dto.imageUrl }),
      ...(dto.alt === undefined ? {} : { alt: dto.alt }),
      ...(dto.href === undefined ? {} : { href: dto.href }),
      ...(dto.position === undefined ? {} : { position: dto.position }),
      ...window,
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    });

    if (updated.imageUrl !== existing.imageUrl) await this.media.remove(existing.imageUrl);

    return updated;
  }

  /** The whole arrangement, checked to be a permutation — the same contract as image reordering. */
  async reorder(dto: ReorderDto): Promise<AdminBanner[]> {
    const existing = (await this.banners.listAll()).map((banner) => banner.id);
    const sent = new Set(dto.ids);

    if (sent.size !== dto.ids.length || sent.size !== existing.length || !existing.every((id) => sent.has(id))) {
      throw new ValidationError('The new order has to list every banner exactly once.', {
        expected: existing.length,
        received: dto.ids.length,
      });
    }

    return this.banners.reorder(dto.ids);
  }

  async remove(id: string): Promise<void> {
    const banner = await this.require(id);

    await this.banners.remove(id);
    await this.media.remove(banner.imageUrl);
  }

  private window(
    startsAt: string | null | undefined,
    endsAt: string | null | undefined,
  ): { startsAt: Date | null; endsAt: Date | null } {
    const start = startsAt === undefined || startsAt === null ? null : new Date(startsAt);
    const end = endsAt === undefined || endsAt === null ? null : new Date(endsAt);

    if (start !== null && end !== null && end <= start) {
      throw new ValidationError('A banner has to finish after it starts, or it will never show.', {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
    }

    return { startsAt: start, endsAt: end };
  }

  private async require(id: string): Promise<AdminBanner> {
    const banner = await this.banners.findById(id);
    if (banner === null) throw new NotFoundError('No banner with that id.', { id });

    return banner;
  }
}
