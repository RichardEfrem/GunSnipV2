'use client';

import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { IDLE, type ActionResult } from '../action-result';
import { deleteImageAction, reorderImagesAction, setPrimaryImageAction, uploadImageAction } from '../actions';
import type { AdminProduct } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminInput } from './AdminField';
import { AdminPanel } from './AdminPanel';

/**
 * Product imagery (FR-ADM-04): upload, reorder, designate a primary, remove.
 *
 * **Reordering is buttons, not drag and drop.** A drag handle needs a keyboard equivalent to be
 * usable at all (DESIGN.md §6), and once that equivalent exists it is this — so the library, the
 * pointer-event handling and the second implementation buy nothing. Up and down move one image
 * past its neighbour and send the whole resulting arrangement, which is what the API expects.
 *
 * `alt` is a required field. DESIGN.md §6 asks for alt text that describes the kit rather than
 * saying "product image", and the only reliable way to get that is to make it impossible to skip.
 */
export function ProductImages({ product }: { product: AdminProduct }) {
  const [uploadResult, uploadAction, isUploading] = useActionState(uploadImageAction.bind(null, product.id), IDLE);
  const [isBusy, startTransition] = useTransition();

  const ids = product.images.map((image) => image.id);

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;

    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];

    startTransition(() => {
      void reorderImagesAction(product.id, next);
    });
  }

  return (
    <AdminPanel title="Images" description="The first image is the one the product card shows.">
      {product.images.length === 0 ? (
        <p className="mb-4 text-sm text-frame-300">
          No images yet. A product needs at least one before it can be published — its card would render empty.
        </p>
      ) : (
        <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.images.map((image, index) => (
            <li key={image.id} className="flex gap-3 rounded-sm border border-armor-150 p-2">
              <Image
                src={image.url}
                alt={image.alt}
                width={80}
                height={80}
                placeholder="blur"
                blurDataURL={image.blurDataUrl}
                className="size-20 shrink-0 rounded-sm object-cover"
              />

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <p className="line-clamp-3 text-xs text-frame-300">{image.alt}</p>

                <div className="flex flex-wrap items-center gap-1">
                  {image.isPrimary ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
                      <Star className="size-3.5 fill-current" aria-hidden />
                      Primary
                    </span>
                  ) : (
                    <IconButton
                      label={`Make image ${index + 1} the primary`}
                      disabled={isBusy}
                      onClick={() => startTransition(() => void setPrimaryImageAction(product.id, image.id))}
                    >
                      <Star className="size-4" aria-hidden />
                    </IconButton>
                  )}

                  <IconButton
                    label={`Move image ${index + 1} earlier`}
                    disabled={isBusy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </IconButton>

                  <IconButton
                    label={`Move image ${index + 1} later`}
                    disabled={isBusy || index === product.images.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </IconButton>

                  <IconButton
                    label={`Remove image ${index + 1}`}
                    isDanger
                    disabled={isBusy}
                    onClick={() => startTransition(() => void deleteImageAction(product.id, image.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={uploadAction} className="flex flex-col gap-4 border-t border-armor-150 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="image-file" className="text-xs font-medium text-frame-300">
              Image file
            </label>
            <input
              id="image-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
              required
              className="text-sm file:mr-3 file:rounded-sm file:border file:border-core-blue file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-core-blue"
            />
          </div>

          <AdminInput
            label="Alt text"
            name="alt"
            required
            minLength={4}
            maxLength={300}
            placeholder="The Exia posed with its GN sword drawn"
            hint="Describe the kit, never “product image”."
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" isLoading={isUploading}>
            Upload image
          </Button>
          <ActionFeedback result={uploadResult as ActionResult} />
        </div>
      </form>
    </AdminPanel>
  );
}

/** An icon-only control still needs a name, so the label is always there for a screen reader. */
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
      className={`reticle rounded-sm p-1.5 transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
        isDanger ? 'text-danger hover:bg-danger-tint' : 'text-frame-300 hover:bg-ink-tint hover:text-ink'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
