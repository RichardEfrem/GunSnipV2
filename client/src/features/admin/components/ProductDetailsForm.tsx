'use client';

import { DIFFICULTIES, TOOL_JOBS } from '@gunsnip/shared';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { DIFFICULTY_LABELS, TOOL_JOB_LABELS } from '@/lib/labels';
import { IDLE } from '../action-result';
import { updateProductAction } from '../actions';
import type { AdminCategory, AdminProduct, ReferenceItem } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminFormGrid, AdminInput, AdminSelect, AdminTextarea } from './AdminField';
import { AdminPanel } from './AdminPanel';

/**
 * A product's fields (FR-ADM-02), type-aware like the create form.
 *
 * The type itself is not editable and is carried as a hidden field so the action knows which
 * group to send. Changing it would strand the product's grade, its requirements and every order
 * line that snapshotted it as a kit — the API refuses, and the form does not offer.
 */
interface ProductDetailsFormProps {
  product: AdminProduct;
  reference: {
    grades: ReferenceItem[];
    scales: ReferenceItem[];
    series: ReferenceItem[];
    brands: ReferenceItem[];
    categories: AdminCategory[];
  };
}

export function ProductDetailsForm({ product, reference }: ProductDetailsFormProps) {
  const [result, formAction, isPending] = useActionState(
    updateProductAction.bind(null, product.id),
    IDLE,
  );

  const isKit = product.type === 'MODEL_KIT';
  const categories = reference.categories.filter((category) => category.type === product.type);

  return (
    <form action={formAction}>
      <input type="hidden" name="productType" value={product.type} />

      <AdminPanel
        title="Details"
        action={
          <div className="flex items-center gap-3">
            <ActionFeedback result={result} />
            <Button type="submit" variant="secondary" isLoading={isPending}>
              Save
            </Button>
          </div>
        }
      >
        <AdminFormGrid>
          <AdminInput label="Name" name="name" defaultValue={product.name} required minLength={2} maxLength={200} />

          <AdminInput
            label="Web address"
            name="slug"
            defaultValue={product.slug}
            maxLength={96}
            hint="Changing this breaks existing links. Leave it alone unless you mean to."
          />

          <AdminSelect label="Brand" name="brandId" defaultValue={product.brand.id} required>
            {reference.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </AdminSelect>

          <AdminSelect label="Category" name="categoryId" defaultValue={product.category.id} required>
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
            defaultValue={product.tags.join(', ')}
            isOptional
            hint="Comma separated."
            className="sm:col-span-2"
          />
        </AdminFormGrid>

        <AdminTextarea
          label="Description"
          name="description"
          defaultValue={product.description ?? ''}
          isOptional
          maxLength={8000}
          className="mt-4"
        />

        {isKit && product.kit !== null ? (
          <>
            <h3 className="mb-3 mt-6 font-display text-xs font-semibold uppercase tracking-wide text-frame-300">
              Kit specification
            </h3>

            <AdminFormGrid>
              <AdminSelect label="Grade" name="gradeId" defaultValue={product.kit.gradeId ?? ''} isOptional>
                <option value="">None</option>
                {reference.grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </AdminSelect>

              <AdminSelect label="Scale" name="scaleId" defaultValue={product.kit.scaleId ?? ''} isOptional>
                <option value="">None</option>
                {reference.scales.map((scale) => (
                  <option key={scale.id} value={scale.id}>
                    {scale.name}
                  </option>
                ))}
              </AdminSelect>

              <AdminSelect label="Series" name="seriesId" defaultValue={product.kit.seriesId ?? ''} isOptional>
                <option value="">None</option>
                {reference.series.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name}
                  </option>
                ))}
              </AdminSelect>

              <AdminSelect
                label="Difficulty"
                name="difficulty"
                defaultValue={product.kit.difficulty ?? ''}
                isOptional
              >
                <option value="">None</option>
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {DIFFICULTY_LABELS[difficulty]}
                  </option>
                ))}
              </AdminSelect>

              <AdminInput label="Unit name" name="unitName" defaultValue={product.kit.unitName ?? ''} isOptional />
              <AdminInput label="Unit code" name="unitCode" defaultValue={product.kit.unitCode ?? ''} isOptional />

              <AdminInput
                label="Runners"
                name="runnerCount"
                type="number"
                min={0}
                max={200}
                defaultValue={product.kit.runnerCount ?? ''}
                isOptional
              />
              <AdminInput
                label="Parts"
                name="partCount"
                type="number"
                min={0}
                max={50000}
                defaultValue={product.kit.partCount ?? ''}
                isOptional
              />
              <AdminInput
                label="Release year"
                name="releaseYear"
                type="number"
                min={1950}
                max={2100}
                defaultValue={product.kit.releaseYear ?? ''}
                isOptional
              />
              <AdminInput
                label="Build time"
                name="runtimeMinutesEst"
                type="number"
                min={0}
                defaultValue={product.kit.runtimeMinutesEst ?? ''}
                isOptional
                hint="Minutes, as the box estimates it."
              />

              <AdminInput
                label="Includes"
                name="includes"
                defaultValue={product.kit.includes.join(', ')}
                isOptional
                hint="Comma separated: weapons, stands, extra hands."
                className="sm:col-span-2"
              />
            </AdminFormGrid>
          </>
        ) : null}

        {!isKit ? (
          <AdminSelect
            label="What it is for"
            name="toolJob"
            defaultValue={product.tool?.toolJob ?? ''}
            isOptional
            className="mt-4 max-w-xs"
          >
            <option value="">None</option>
            {TOOL_JOBS.map((job) => (
              <option key={job} value={job}>
                {TOOL_JOB_LABELS[job]}
              </option>
            ))}
          </AdminSelect>
        ) : null}
      </AdminPanel>
    </form>
  );
}
