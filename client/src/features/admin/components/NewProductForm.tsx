'use client';

import { useActionState, useState } from 'react';
import { TOOL_JOBS } from '@gunsnip/shared';
import { Button } from '@/components/ui/Button';
import { TOOL_JOB_LABELS } from '@/lib/labels';
import { IDLE } from '../action-result';
import { createProductAction } from '../actions';
import type { AdminCategory, ReferenceItem } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminFormGrid, AdminInput, AdminSelect, AdminTextarea } from './AdminField';
import { AdminPanel } from './AdminPanel';

/**
 * The create-product form (FR-ADM-02).
 *
 * **Type-aware**, which FR-ADM-02 asks for: choosing "Model kit" or "Tool" swaps the second half
 * of the form, because the two have genuinely different fields and showing both would offer a
 * `runnerCount` on a paint bottle. The type is the one thing here that cannot be changed later —
 * the API refuses it — so it is asked first and said so plainly.
 *
 * Type is the component's only piece of state. Everything else is an uncontrolled field read out
 * of the `FormData` by the action, which is what keeps a twenty-field form from re-rendering on
 * every keystroke.
 */
interface NewProductFormProps {
  reference: {
    grades: ReferenceItem[];
    scales: ReferenceItem[];
    series: ReferenceItem[];
    brands: ReferenceItem[];
    categories: AdminCategory[];
  };
}

export function NewProductForm({ reference }: NewProductFormProps) {
  const [result, formAction, isPending] = useActionState(createProductAction, IDLE);
  const [type, setType] = useState<'MODEL_KIT' | 'TOOL_SUPPLY'>('MODEL_KIT');

  const categories = reference.categories.filter((category) => category.type === type);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5">
      <AdminPanel title="What is it?">
        <AdminFormGrid>
          <AdminSelect
            label="Type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value === 'TOOL_SUPPLY' ? 'TOOL_SUPPLY' : 'MODEL_KIT')}
            hint="This cannot be changed later — archive and recreate instead."
          >
            <option value="MODEL_KIT">Model kit</option>
            <option value="TOOL_SUPPLY">Tool or supply</option>
          </AdminSelect>

          <AdminInput label="Name" name="name" required minLength={2} maxLength={200} placeholder="MG 1/100 Gundam Exia" />

          <AdminInput
            label="Web address"
            name="slug"
            isOptional
            maxLength={96}
            placeholder="mg-1-100-gundam-exia"
            hint="Left blank, it is built from the name. It never changes on a rename."
          />

          <AdminSelect label="Brand" name="brandId" required>
            <option value="">Choose a brand</option>
            {reference.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </AdminSelect>

          <AdminSelect label="Category" name="categoryId" required>
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {' '.repeat(category.depth * 2)}
                {category.name}
              </option>
            ))}
          </AdminSelect>

          <AdminInput
            label="Tags"
            name="tags"
            isOptional
            placeholder="wing, endless waltz, ver.ka"
            hint="Comma separated. Folded into search alongside the name and series."
          />
        </AdminFormGrid>

        <AdminTextarea
          label="Description"
          name="description"
          isOptional
          maxLength={8000}
          className="mt-4"
          placeholder="What the builder is getting, in their terms."
        />
      </AdminPanel>

      {type === 'MODEL_KIT' ? (
        <AdminPanel title="Kit specification" description="All optional — the rest of the spec is added in the editor.">
          <AdminFormGrid>
            <AdminSelect label="Grade" name="gradeId" isOptional>
              <option value="">None</option>
              {reference.grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </AdminSelect>

            <AdminSelect label="Scale" name="scaleId" isOptional>
              <option value="">None</option>
              {reference.scales.map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.name}
                </option>
              ))}
            </AdminSelect>

            <AdminSelect label="Series" name="seriesId" isOptional>
              <option value="">None</option>
              {reference.series.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name}
                </option>
              ))}
            </AdminSelect>

            <AdminInput
              label="Unit name"
              name="unitName"
              isOptional
              placeholder="Gundam Exia"
              hint="The mobile suit itself, not the product name."
            />

            <AdminInput label="Unit code" name="unitCode" isOptional placeholder="GN-001" hint="Heavily searched." />
          </AdminFormGrid>
        </AdminPanel>
      ) : (
        <AdminPanel title="Tool specification">
          <AdminSelect label="What it is for" name="toolJob" isOptional className="max-w-xs">
            <option value="">None</option>
            {TOOL_JOBS.map((job) => (
              <option key={job} value={job}>
                {TOOL_JOB_LABELS[job]}
              </option>
            ))}
          </AdminSelect>
        </AdminPanel>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" isLoading={isPending}>
          Create draft
        </Button>
        <ActionFeedback result={result} />
      </div>
    </form>
  );
}
