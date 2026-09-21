'use client';

import { CircleAlert, ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useId } from 'react';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { IMAGE_UPLOAD_ACCEPT } from '@/lib/constants';
import type { ReviewPhotoDraft } from '../hooks/use-review-photos';
import { MAX_REVIEW_PHOTOS } from '../schema';

/**
 * Photos on a review (FR-REV-01): pick, see each one upload, describe it, or drop it.
 *
 * Every photo that made it up gets its own description field. It is required — a photo on a
 * product page with no alternative text is invisible to a screen reader (PRD §12) — and the
 * label says so in terms of what it is for rather than as a rule.
 */
interface ReviewPhotoPickerProps {
  photos: ReviewPhotoDraft[];
  canAddMore: boolean;
  onAdd: (files: FileList | null) => void;
  onDescribe: (key: string, alt: string) => void;
  onRemove: (key: string) => void;
  /** Set by the form on submit, when a photo is still uploading or has no description. */
  error?: string;
}

export function ReviewPhotoPicker({ photos, canAddMore, onAdd, onDescribe, onRemove, error }: ReviewPhotoPickerProps) {
  const inputId = useId();

  return (
    <fieldset className="flex flex-col gap-4 border border-armor-150 bg-armor-050 p-4">
      <legend className="px-1 text-sm font-medium">
        Photos <span className="font-normal text-frame-300">(optional)</span>
      </legend>
      <p className="text-xs text-frame-300">
        Up to {MAX_REVIEW_PHOTOS}. JPEG, PNG or WebP, up to 8 MB each — they are compressed when they upload.
      </p>

      {photos.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {photos.map((photo, index) => (
            <li key={photo.key} className="flex items-start gap-3">
              <PhotoPreview photo={photo} />

              <div className="min-w-0 flex-1">
                {photo.status === 'ready' ? (
                  <Input
                    label={`Describe photo ${index + 1}`}
                    value={photo.alt}
                    onChange={(event) => onDescribe(photo.key, event.target.value)}
                    maxLength={200}
                    hint="Read aloud to people who cannot see it — “The finished Exia, panel lined”."
                  />
                ) : photo.status === 'uploading' ? (
                  <p className="truncate pt-2 text-sm text-frame-300" role="status">
                    Uploading {photo.name}…
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 pt-2 text-sm text-danger" role="alert">
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                      {photo.name}: {photo.message}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRemove(photo.key)}
                title={`Remove photo ${index + 1}`}
                className="reticle mt-1 rounded-sm p-1.5 text-frame-300 transition-colors duration-fast ease-out hover:bg-ink-tint hover:text-ink"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Remove photo {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAddMore ? (
        <label
          htmlFor={inputId}
          // The input is visually hidden, so the focus ring it would draw goes on its label instead.
          className="inline-flex cursor-pointer items-center gap-2 self-start rounded-sm border border-core-blue px-3 py-2 text-sm font-medium text-core-blue has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-core-blue has-focus-visible:outline-solid"
        >
          <ImagePlus className="size-4" aria-hidden />
          Add photos
          <input
            id={inputId}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              onAdd(event.target.files);
              // Cleared so picking the same file again after removing it still fires a change.
              event.target.value = '';
            }}
          />
        </label>
      ) : null}

      {error === undefined ? null : (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </fieldset>
  );
}

function PhotoPreview({ photo }: { photo: ReviewPhotoDraft }) {
  if (photo.status === 'uploading') return <Skeleton className="size-20 shrink-0" />;

  if (photo.status === 'failed') {
    return <div className="size-20 shrink-0 rounded-sm border border-danger bg-danger-tint" aria-hidden />;
  }

  return (
    <Image
      src={photo.url}
      // Described by the field beside it; repeating the text here would read it twice.
      alt=""
      width={80}
      height={80}
      className="size-20 shrink-0 rounded-sm border border-armor-150 object-cover"
    />
  );
}
