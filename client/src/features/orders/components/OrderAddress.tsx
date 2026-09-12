import type { Order } from '../schema';

/** Where it is going and who to call (FR-ORD-03) — the address exactly as given at purchase. */
export function OrderAddress({ order }: { order: Order }) {
  const { address, contact } = order;
  const locality = [address.district, address.city, address.province].filter((part) => part !== null).join(', ');

  return (
    <section aria-labelledby="order-address" className="flex flex-col gap-2 border border-armor-150 bg-armor-000 p-4">
      <h2 id="order-address" className="text-lg">
        Delivery address
      </h2>

      <address className="flex flex-col text-sm not-italic">
        <span className="font-medium">{contact.name}</span>
        <span>{address.street}</span>
        <span>
          {locality} {address.postalCode}
        </span>
        <span className="mt-2 text-frame-300">
          {contact.phone} · {contact.email}
        </span>
      </address>

      {address.notes === null ? null : <p className="text-sm text-frame-300">Note: {address.notes}</p>}
    </section>
  );
}
