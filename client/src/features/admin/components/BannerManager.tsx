'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Fragment, useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/formatters';
import { IDLE, type ActionResult } from '../action-result';
import { createBannerAction, deleteBannerAction, reorderBannersAction, updateBannerAction } from '../actions';
import type { AdminBanner } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminCheckbox, AdminFormGrid, AdminInput } from './AdminField';
import { AdminPanel, AdminTable, Td, Th } from './AdminPanel';

/**
 * Banner curation (FR-ADM-12, FR-PROMO-04).
 *
 * Reordering is up/down buttons for the same reason the image list uses them: a drag handle
 * needs a keyboard equivalent to be usable at all, and once it exists it is this.
 *
 * `isLive` comes from the server. The rule — switched on, and the clock inside the window — is
 * the storefront's, and a second copy of it here would eventually disagree about which banner is
 * actually showing.
 */
export function BannerManager({ banners }: { banners: AdminBanner[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult>(IDLE);
  const [isBusy, startTransition] = useTransition();

  const ids = banners.map((banner) => banner.id);

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;

    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];

    startTransition(async () => setResult(await reorderBannersAction(next)));
  }

  return (
    <AdminPanel
      title="Banners"
      action={
        <Button variant="secondary" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="size-4" aria-hidden />
          New banner
        </Button>
      }
      isFlush
    >
      {isAdding ? (
        <div className="border-b border-armor-150 bg-armor-050 p-4">
          <BannerForm onDone={() => setIsAdding(false)} />
        </div>
      ) : null}

      {result.status === 'error' ? (
        <div className="border-b border-armor-150 bg-armor-050 px-4 py-3">
          <ActionFeedback result={result} />
        </div>
      ) : null}

      {banners.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-frame-300">
          No banners. The home page renders without the promo rail until there is at least one.
        </p>
      ) : (
        <AdminTable className="min-w-[44rem]">
          <thead>
            <tr>
              <Th>Banner</Th>
              <Th>Links to</Th>
              <Th>Window</Th>
              <Th>Showing</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner, index) => (
              <Fragment key={banner.id}>
                <tr>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Image
                        src={banner.imageUrl}
                        alt={banner.alt}
                        width={64}
                        height={40}
                        className="h-10 w-16 shrink-0 rounded-sm object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{banner.title}</div>
                        {banner.subtitle === null ? null : (
                          <div className="truncate text-xs text-frame-300">{banner.subtitle}</div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-frame-300">{banner.href}</Td>
                  <Td className="whitespace-nowrap text-xs text-frame-300">
                    {banner.startsAt === null && banner.endsAt === null
                      ? 'Always'
                      : `${banner.startsAt === null ? 'Now' : formatDateTime(banner.startsAt)} → ${
                          banner.endsAt === null ? 'No end' : formatDateTime(banner.endsAt)
                        }`}
                  </Td>
                  <Td className="text-xs">
                    {banner.isLive ? (
                      <span className="text-ok">Live</span>
                    ) : (
                      <span className="text-frame-300">{banner.isActive ? 'Scheduled' : 'Off'}</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <IconButton label={`Move ${banner.title} up`} disabled={isBusy || index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Move ${banner.title} down`}
                      disabled={isBusy || index === banners.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === banner.id ? null : banner.id)}
                      aria-expanded={editingId === banner.id}
                      className="reticle rounded-sm px-2 py-1 text-xs text-core-blue hover:underline"
                    >
                      Edit
                    </button>
                    <IconButton
                      label={`Remove ${banner.title}`}
                      isDanger
                      disabled={isBusy}
                      onClick={() => startTransition(async () => setResult(await deleteBannerAction(banner.id)))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </Td>
                </tr>

                {editingId === banner.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-armor-150 bg-armor-050 p-4">
                      <BannerForm banner={banner} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </AdminTable>
      )}
    </AdminPanel>
  );
}

/** `datetime-local` wants `yyyy-mm-ddThh:mm` in the operator's timezone — Jakarta, UTC+7. */
function toLocalInput(iso: string | null): string {
  return iso === null ? '' : new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function BannerForm({ banner, onDone }: { banner?: AdminBanner; onDone: () => void }) {
  const isNew = banner === undefined;
  const [result, formAction, isPending] = useActionState(
    isNew ? createBannerAction : updateBannerAction.bind(null, banner.id),
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AdminFormGrid>
        <AdminInput label="Title" name="title" defaultValue={banner?.title ?? ''} required minLength={2} maxLength={120} />
        <AdminInput label="Subtitle" name="subtitle" defaultValue={banner?.subtitle ?? ''} isOptional maxLength={200} />

        <AdminInput
          label="Image URL"
          name="imageUrl"
          defaultValue={banner?.imageUrl ?? ''}
          required
          maxLength={500}
          placeholder="/media/products/mg-exia-0.svg"
          hint="A path under /media, the same place product images live."
        />

        <AdminInput
          label="Links to"
          name="href"
          defaultValue={banner?.href ?? ''}
          required
          maxLength={500}
          placeholder="/kits?grade=MG"
          hint="A path on this site. Off-site links are refused."
        />

        <AdminInput
          label="Alt text"
          name="alt"
          defaultValue={banner?.alt ?? ''}
          required
          minLength={4}
          maxLength={300}
          className="sm:col-span-2"
          hint="Describe the banner, never “banner image”."
        />

        <AdminInput
          label="Starts"
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalInput(banner?.startsAt ?? null)}
          isOptional
          hint="Jakarta time. Blank means from now."
        />
        <AdminInput
          label="Ends"
          name="endsAt"
          type="datetime-local"
          defaultValue={toLocalInput(banner?.endsAt ?? null)}
          isOptional
          hint="Blank means it runs until switched off."
        />

        <AdminCheckbox label="Switched on" name="isActive" defaultChecked={banner?.isActive ?? true} />
      </AdminFormGrid>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>
          {isNew ? 'Create banner' : 'Save banner'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  isDanger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isDanger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`reticle rounded-sm p-1.5 transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-30 ${
        isDanger ? 'text-danger hover:bg-danger-tint' : 'text-frame-300 hover:bg-ink-tint hover:text-ink'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
