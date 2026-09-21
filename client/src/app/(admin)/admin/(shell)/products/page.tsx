import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchProducts } from '@/features/admin/api';
import { AdminPageHeader, AdminPanel, AdminTable, Td, Th } from '@/features/admin/components/AdminPanel';
import { AdminListFilters } from '@/features/admin/components/AdminListFilters';
import { CursorPager } from '@/features/admin/components/CursorPager';
import { ProductStatusBadge } from '@/features/admin/components/OrderStatusBadge';
import { buttonStyles } from '@/components/ui/button-styles';
import { ApiError } from '@/lib/api-error';
import { formatDate, formatIdr } from '@/lib/formatters';
import type { AdminProductSummary, CursorPage } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Products' };

/**
 * The product list (FR-ADM-02).
 *
 * **The URL is the state**, the same rule the storefront listing follows (FR-CAT-07) — so a link
 * to "draft tools" is a link an operator can send to a colleague, and the back button works.
 * Nothing here is mirrored into React state.
 */
export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  const params = await searchParams;
  const query = {
    status: single(params.status),
    type: single(params.type),
    q: single(params.q),
    cursor: single(params.cursor),
  };

  let page: CursorPage<AdminProductSummary>;

  try {
    page = await fetchProducts(query);
  } catch (error) {
    return (
      <>
        <AdminPageHeader title="Products" />
        <ErrorState
          title="The product list didn't load"
          description={error instanceof ApiError ? error.message : "The API didn't respond. Try again in a moment."}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Kits and tools, drafts included."
        action={
          // `buttonStyles` rather than a `<Button>` inside a `<Link>`: nesting one interactive
          // element in another is invalid HTML and announces twice (see `button-styles.ts`).
          <Link href="/admin/products/new" className={buttonStyles('primary')}>
            New product
          </Link>
        }
      />

      <AdminListFilters
        basePath="/admin/products"
        search={{ name: 'q', label: 'Search', placeholder: 'Name, slug or SKU', value: query.q }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: query.status,
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'ARCHIVED', label: 'Archived' },
            ],
          },
          {
            name: 'type',
            label: 'Type',
            value: query.type,
            options: [
              { value: 'MODEL_KIT', label: 'Model kits' },
              { value: 'TOOL_SUPPLY', label: 'Tools and supplies' },
            ],
          },
        ]}
      />

      <AdminPanel isFlush className="mt-4">
        {page.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-frame-300">
            Nothing matches those filters. Clear the search, or create the product you were looking for.
          </p>
        ) : (
          <AdminTable className="min-w-[52rem]">
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((product) => (
                <tr key={product.id}>
                  <Td>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="reticle rounded-sm font-medium text-core-blue underline-offset-2 hover:underline"
                    >
                      {product.name}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-frame-300">
                      {product.brandName} · {product.variantCount}{' '}
                      {product.variantCount === 1 ? 'variant' : 'variants'}
                    </div>
                  </Td>
                  <Td>
                    <ProductStatusBadge status={product.status} />
                  </Td>
                  <Td className="text-frame-300">{product.categoryName}</Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums">
                    {product.minPriceIdr === 0 && product.maxPriceIdr === 0 ? (
                      <span className="text-frame-300">—</span>
                    ) : product.minPriceIdr === product.maxPriceIdr ? (
                      formatIdr(product.minPriceIdr)
                    ) : (
                      `${formatIdr(product.minPriceIdr)}+`
                    )}
                  </Td>
                  <Td
                    className={`text-right font-mono tabular-nums ${
                      product.availableQuantity === 0 ? 'text-danger' : ''
                    }`}
                  >
                    {product.availableQuantity}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-frame-300">{formatDate(product.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>

      <CursorPager basePath="/admin/products" params={params} nextCursor={page.nextCursor} />
    </>
  );
}

/** `searchParams` values can arrive as an array when a key repeats; a filter only means one. */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
