import type { AdminCategory, AdminProduct, AdminProductSummary, ReferenceItem } from '../schema';
import { AdminPanel } from './AdminPanel';
import { ProductDetailsForm } from './ProductDetailsForm';
import { ProductImages } from './ProductImages';
import { ProductRequirementsEditor } from './ProductRequirementsEditor';
import { ProductStatusControls } from './ProductStatusControls';
import { ProductVariants } from './ProductVariants';

/**
 * The product editor's layout (FR-ADM-02 … FR-ADM-06).
 *
 * A Server Component holding five Client Components, each owning one job and one form. Splitting
 * them this way is what makes the editor usable: a variant edit posts and revalidates without
 * touching the spec form's unsaved text, because they are genuinely separate submissions rather
 * than one enormous form with a single Save at the bottom.
 */
interface ProductEditorProps {
  product: AdminProduct;
  reference: {
    grades: ReferenceItem[];
    scales: ReferenceItem[];
    series: ReferenceItem[];
    brands: ReferenceItem[];
    categories: AdminCategory[];
  };
  tools: AdminProductSummary[];
}

export function ProductEditor({ product, reference, tools }: ProductEditorProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <ProductDetailsForm product={product} reference={reference} />
        <ProductVariants product={product} />
        <ProductImages product={product} />

        {product.type === 'MODEL_KIT' ? (
          <ProductRequirementsEditor product={product} tools={tools} />
        ) : (
          <AdminPanel title="Build requirements">
            <p className="text-sm text-frame-300">
              Only a model kit has build requirements — this is the tool that gets required, not the thing that
              requires one.
            </p>
          </AdminPanel>
        )}
      </div>

      {/* Publishing sits apart from the fields because it is not a field edit: it is the decision
          that puts the product in front of customers (FR-ADM-02). */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <ProductStatusControls product={product} />
      </div>
    </div>
  );
}
