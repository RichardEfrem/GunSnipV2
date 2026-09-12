import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchReference } from '@/features/admin/api';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { NewProductForm } from '@/features/admin/components/NewProductForm';

export const metadata: Metadata = { title: 'New product' };

/**
 * Creating a product (FR-ADM-02).
 *
 * Only what a product cannot exist without. Everything else — variants, images, the kit spec,
 * build requirements — is added in the editor, because a form asking for all of it at once is a
 * form nobody finishes, and none of it can be validated before the product has an id anyway.
 */
export default async function NewProductPage() {
  const reference = await fetchReference();

  return (
    <>
      <AdminPageHeader
        title="New product"
        description="It starts as a draft. Add variants and an image, then publish."
        action={
          <Link href="/admin/products" className="reticle self-center rounded-sm text-sm text-core-blue hover:underline">
            Back to products
          </Link>
        }
      />

      <NewProductForm reference={reference} />
    </>
  );
}
