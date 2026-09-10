import { prisma } from '../client.ts';
import { PROVINCES } from '../data/regions.ts';

/**
 * Province → city → district, for the dependent selects in checkout (FR-CO-03).
 *
 * The shipping zone is set on the province and read by the quote service through the parent
 * chain, so a city added later inherits the right rate without anyone remembering to set it.
 */
export async function seedRegions(): Promise<number> {
  let count = 0;

  for (const province of PROVINCES) {
    const created = await prisma.addressRegion.create({
      data: { level: 'PROVINCE', name: province.name, shippingZone: province.zone },
    });
    count += 1;

    for (const city of province.cities) {
      const createdCity = await prisma.addressRegion.create({
        data: {
          level: 'CITY',
          name: city.name,
          parentId: created.id,
          postalCode: city.postalCode ?? null,
        },
      });
      count += 1;

      if (city.districts === undefined) continue;

      await prisma.addressRegion.createMany({
        data: city.districts.map((name) => ({
          level: 'DISTRICT' as const,
          name,
          parentId: createdCity.id,
        })),
      });
      count += city.districts.length;
    }
  }

  return count;
}
