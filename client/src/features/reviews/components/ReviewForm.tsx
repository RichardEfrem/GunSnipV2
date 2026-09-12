'use client';

import { useState } from 'react';
import { DIFFICULTIES, type Difficulty } from '@gunsnip/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DIFFICULTY_LABELS } from '@/lib/labels';
import { submitReview } from '../client-api';
import type { ReviewInvite } from '../schema';
import { RatingInput } from './RatingInput';

/**
 * Writing a review against an invite (FR-REV-01, FR-REV-04).
 *
 * The form carries no product: the token decides what is being reviewed, so there is no field
 * here an author could change to review something they never bought. The build questions appear
 * only for a kit — asking how long a nipper took to build is how a form announces it was not
 * written for what you bought.
 *
 * Validation mirrors the server's DTO rather than trying to be cleverer than it. The server is
 * still the authority; this exists so a mistake is caught before a round trip, and its messages
 * say what to do rather than what was wrong.
 */
const MIN_TITLE = 3;
const MIN_BODY = 10;

interface Errors {
  rating?: string;
  authorName?: string;
  title?: string;
  body?: string;
}

export function ReviewForm({ invite }: { invite: ReviewInvite }) {
  const [rating, setRating] = useState(0);
  const [authorName, setAuthorName] = useState(invite.suggestedAuthorName);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [buildHours, setBuildHours] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [tools, setTools] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  function validate(): Errors {
    return {
      rating: rating === 0 ? 'Choose a rating from one to five stars.' : undefined,
      authorName: authorName.trim().length < 2 ? 'Tell us what to call you.' : undefined,
      title: title.trim().length < MIN_TITLE ? 'Give the review a short headline.' : undefined,
      body:
        body.trim().length < MIN_BODY
          ? 'Say a little more — what was the build actually like?'
          : undefined,
    };
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.values(found).some((message) => message !== undefined)) return;

    setIsSubmitting(true);
    setFailure(null);

    try {
      await submitReview({
        token: invite.token,
        rating,
        authorName: authorName.trim(),
        title: title.trim(),
        body: body.trim(),
        // Only ever sent for a kit, and only when given. The server drops them for a tool too,
        // so a stale form cannot put "took 14 hours to build" on a nipper.
        ...(invite.isKit && buildHours !== ''
          ? { buildTimeMinutes: Math.round(Number(buildHours) * 60) }
          : {}),
        ...(invite.isKit && difficulty !== '' ? { experiencedDifficulty: difficulty } : {}),
        ...(invite.isKit && tools.trim() !== ''
          ? { toolsUsed: tools.split(',').map((tool) => tool.trim()).filter((tool) => tool !== '') }
          : {}),
      });

      setIsDone(true);
    } catch {
      setFailure('We could not save that review. The link may already have been used.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return (
      <div className="border border-armor-150 bg-armor-050 p-6">
        <h2 className="font-display text-lg font-semibold">Thank you — that is in.</h2>
        <p className="mt-2 max-w-prose text-sm text-frame-300">
          Every review is read before it goes up, so it will appear on {invite.product.name} shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <RatingInput value={rating} onChange={setRating} error={errors.rating} />

      <Input
        label="Your name"
        value={authorName}
        onChange={(event) => setAuthorName(event.target.value)}
        error={errors.authorName}
        maxLength={60}
        hint="Shown beside the review."
      />

      <Input
        label="Headline"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={errors.title}
        maxLength={120}
        placeholder="Superb inner frame, fiddly hands"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-body" className="text-sm font-medium">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={6}
          aria-describedby={errors.body === undefined ? undefined : 'review-body-error'}
          className="reticle min-h-32 w-full rounded-sm border border-armor-300 bg-armor-000 px-3 py-2 text-sm"
        />
        {errors.body === undefined ? null : (
          <p id="review-body-error" role="alert" className="text-xs text-danger">
            {errors.body}
          </p>
        )}
      </div>

      {invite.isKit ? (
        <fieldset className="flex flex-col gap-4 border border-armor-150 bg-armor-050 p-4">
          <legend className="px-1 text-sm font-medium">About the build</legend>
          <p className="text-xs text-frame-300">
            Optional, and the most useful part of the review for the next builder.
          </p>

          <Input
            label="Hours it took"
            type="number"
            min={0}
            step={0.5}
            value={buildHours}
            onChange={(event) => setBuildHours(event.target.value)}
            isOptional
          />

          <Select
            label="How it felt"
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as Difficulty)}
            options={DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_LABELS[value] }))}
            placeholder="Choose one"
          />

          <Input
            label="Tools you used"
            value={tools}
            onChange={(event) => setTools(event.target.value)}
            hint="Comma separated — God Hand nipper, panel liner"
            isOptional
          />
        </fieldset>
      ) : null}

      {failure === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        Post review
      </Button>
    </form>
  );
}
