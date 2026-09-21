import type { Metadata } from 'next';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchVouchers } from '@/features/admin/api';
import { AdminListFilters } from '@/features/admin/components/AdminListFilters';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { CursorPager } from '@/features/admin/components/CursorPager';
import { VoucherManager } from '@/features/admin/components/VoucherManager';
import { ApiError } from '@/lib/api-error';
import type { AdminVoucher, CursorPage } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Vouchers' };

/** Voucher CRUD with a usage counter (FR-ADM-10). */
export default async function AdminVouchersPage({ searchParams }: PageProps<'/admin/vouchers'>) {
  const params = await searchParams;
  const query = { isActive: single(params.isActive), q: single(params.q), cursor: single(params.cursor) };

  let page: CursorPage<AdminVoucher>;

  try {
    page = await fetchVouchers(query);
  } catch (error) {
    return (
      <>
        <AdminPageHeader title="Vouchers" />
        <ErrorState
          title="The voucher list didn't load"
          description={error instanceof ApiError ? error.message : "The API didn't respond. Try again in a moment."}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Vouchers"
        description="A voucher that has been redeemed cannot be deleted — switch it off instead."
      />

      <AdminListFilters
        basePath="/admin/vouchers"
        search={{ name: 'q', label: 'Search', placeholder: 'Code', value: query.q }}
        selects={[
          {
            name: 'isActive',
            label: 'Switched on',
            value: query.isActive,
            options: [
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
            ],
          },
        ]}
      />

      <VoucherManager vouchers={page.items} className="mt-4" />

      <CursorPager basePath="/admin/vouchers" params={params} nextCursor={page.nextCursor} />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
