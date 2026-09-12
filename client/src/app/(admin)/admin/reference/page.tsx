import type { Metadata } from 'next';
import { fetchReference } from '@/features/admin/api';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { CategoryManager, ReferenceTable } from '@/features/admin/components/ReferenceManager';

export const metadata: Metadata = { title: 'Reference data' };

/**
 * Grades, scales, series, brands and categories (FR-ADM-09).
 *
 * These five tables are what the storefront's filter rail is built from, which is why every
 * panel shows how many products use a row: removing one is a decision, and the API refuses when
 * anything still points at it.
 */
export default async function AdminReferencePage() {
  const { grades, scales, series, brands, categories } = await fetchReference();

  return (
    <>
      <AdminPageHeader
        title="Reference data"
        description="The vocabulary the filter rail is built from. Codes and web addresses never change — only names do."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <ReferenceTable
          table="grades"
          title="Grades"
          description="MG, RG, PG. The code appears in every filter URL."
          items={grades}
          hasCode
          hasDescription
        />

        <ReferenceTable
          table="scales"
          title="Scales"
          description="1/144, 1/100. Not a database enum — 1/144 is not a valid identifier."
          items={scales}
          hasCode
        />

        <ReferenceTable table="series" title="Series" description="Gundam Wing, Iron-Blooded Orphans." items={series} />

        <ReferenceTable table="brands" title="Brands" description="Bandai, Tamiya, Mr. Hobby." items={brands} />

        <CategoryManager categories={categories} className="xl:col-span-2" />
      </div>
    </>
  );
}
