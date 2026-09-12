import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProduct, fetchProducts, fetchReference } from '@/features/admin/api';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { ProductEditor } from '@/features/admin/components/ProductEditor';
import { ApiError } from '@/lib/api-error';

export const metadata: Metadata = { title: 'Edit product' };

/**
 * The product editor (FR-ADM-02 … FR-ADM-06).
 *
 * A Server Component that fetches everything the editor needs and hands it down as props. The
 * interactive pieces are Client Components further in, which is the rule CLAUDE.md sets: push
 * `'use client'` as far down the tree as possible, so the spec form and the image list do not
 * ship the whole editor's JavaScript.
 *
 * The tool list is fetched here too, because the build-requirement editor (FR-ADM-06) needs
 * something to choose from and a client-side search would be a `useEffect` fetch — which this
 * project does not do.
 */
export default async function AdminProductPage({ params }: PageProps<'/admin/products/[productId]'>) {
  const { productId } = await params;

  // Only the fetches are in the try. JSX is not rendered where it is constructed, so a catch
  // around it would not see a rendering error — it would only swallow the one it was written for.
  let loaded: [
    Awaited<ReturnType<typeof fetchProduct>>,
    Awaited<ReturnType<typeof fetchReference>>,
    Awaited<ReturnType<typeof fetchProducts>>,
  ];

  try {
    loaded = await Promise.all([
      fetchProduct(productId),
      fetchReference(),
      // Published tools only: a requirement pointing at a draft would render a dead link on the
      // product page. 100 is every tool the seed has and more than the shop is likely to carry.
      fetchProducts({ type: 'TOOL_SUPPLY', status: 'PUBLISHED', limit: 100 }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  const [product, reference, tools] = loaded;

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={`${product.type === 'MODEL_KIT' ? 'Model kit' : 'Tool or supply'} · /${product.slug}`}
        action={
          <Link href="/admin/products" className="reticle self-center rounded-sm text-sm text-core-blue hover:underline">
            Back to products
          </Link>
        }
      />

      <ProductEditor product={product} reference={reference} tools={tools.items} />
    </>
  );
}
