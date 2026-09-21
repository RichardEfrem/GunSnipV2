'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api-error';
import { IMAGE_UPLOAD_ACCEPT, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/constants';
import { uploadReviewPhoto } from '../client-api';
import { MAX_REVIEW_PHOTOS } from '../schema';

/**
 * The photos on a review being written (FR-REV-01).
 *
 * Each photo uploads the moment it is picked, so by the time the customer has written their
 * review the slow part is already done — and a photo the API refuses is reported beside that
 * photo, not as a failed review after everything else was typed.
 *
 * Nothing is held back to be uploaded on submit. The review names the URLs the API returned,
 * which is the only kind of photo URL the API will accept on a review.
 */
export type ReviewPhotoDraft =
  | { key: string; status: 'uploading'; name: string }
  | { key: string; status: 'ready'; url: string; alt: string }
  | { key: string; status: 'failed'; name: string; message: string };

const ACCEPTED_TYPES = new Set(IMAGE_UPLOAD_ACCEPT.split(','));

export function useReviewPhotos(token: string) {
  const [photos, setPhotos] = useState<ReviewPhotoDraft[]>([]);

  function replace(key: string, next: ReviewPhotoDraft): void {
    setPhotos((current) => current.map((photo) => (photo.key === key ? next : photo)));
  }

  async function upload(key: string, file: File): Promise<void> {
    if (!ACCEPTED_TYPES.has(file.type)) {
      replace(key, { key, status: 'failed', name: file.name, message: 'Use a JPEG, PNG or WebP photo.' });
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      replace(key, { key, status: 'failed', name: file.name, message: 'This photo is over 8 MB.' });
      return;
    }

    try {
      const { url } = await uploadReviewPhoto(token, file);
      replace(key, { key, status: 'ready', url, alt: '' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'This photo could not be uploaded.';
      replace(key, { key, status: 'failed', name: file.name, message });
    }
  }

  /** Adds what fits under the cap and starts every upload at once. */
  function add(files: FileList | null): void {
    if (files === null) return;

    const room = MAX_REVIEW_PHOTOS - photos.length;
    const picked = Array.from(files)
      .slice(0, Math.max(0, room))
      .map((file) => ({ file, key: crypto.randomUUID() }));

    setPhotos((current) => [
      ...current,
      ...picked.map(({ file, key }): ReviewPhotoDraft => ({ key, status: 'uploading', name: file.name })),
    ]);

    for (const { file, key } of picked) void upload(key, file);
  }

  function describe(key: string, alt: string): void {
    setPhotos((current) =>
      current.map((photo) => (photo.key === key && photo.status === 'ready' ? { ...photo, alt } : photo)),
    );
  }

  /** Drops it from the review. The file stays on the server unreferenced, which is harmless. */
  function remove(key: string): void {
    setPhotos((current) => current.filter((photo) => photo.key !== key));
  }

  return {
    photos,
    add,
    describe,
    remove,
    canAddMore: photos.length < MAX_REVIEW_PHOTOS,
    isUploading: photos.some((photo) => photo.status === 'uploading'),
  };
}
