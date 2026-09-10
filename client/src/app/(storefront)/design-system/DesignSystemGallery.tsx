'use client';

import { ArrowRight, Heart } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { StockPill } from '@/components/ui/StockPill';
import { selectCardBadges } from '@/lib/badges';
import { formatCount, formatDuration, formatIdr, formatRating } from '@/lib/formatters';

export function DesignSystemGallery() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-armor-150 pb-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-semibold text-core-blue">Frame and armor</p>
          <h1 className="text-3xl">Design system</h1>
          <p className="max-w-measure text-sm text-frame-300">
            Every token and primitive from DESIGN.md, in each state it ships with. Tab through
            the page to check the focus reticle, and switch themes to check contrast.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Colours />
      <Typography />
      <Buttons />
      <Badges />
      <Money />
      <Forms />
      <Overlays />
      <FourStates />
    </div>
  );
}

/* ---------------------------------------------------------------- layout helpers */

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="border-b border-armor-150 py-10">
      <h2 className="text-xl">{title}</h2>
      <p className="mb-6 mt-1 max-w-measure text-sm text-frame-300">{note}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3">
      <p className="w-40 shrink-0 text-xs text-frame-300">{label}</p>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

const SWATCHES = [
  { name: 'frame-900', className: 'bg-frame-900', role: 'Header, footer, tab bar' },
  { name: 'frame-700', className: 'bg-frame-700', role: 'Raised frame surfaces' },
  { name: 'frame-500', className: 'bg-frame-500', role: 'Borders on dark' },
  { name: 'frame-300', className: 'bg-frame-300', role: 'Secondary text' },
  { name: 'armor-000', className: 'bg-armor-000', role: 'Cards, inputs, sheets' },
  { name: 'armor-050', className: 'bg-armor-050', role: 'Page background' },
  { name: 'armor-150', className: 'bg-armor-150', role: 'Panel lines' },
  { name: 'field-border', className: 'bg-field-border', role: 'Control boundaries' },
  { name: 'ink', className: 'bg-ink', role: 'Primary text' },
  { name: 'sortie-red', className: 'bg-sortie-red', role: 'Money and purchase intent' },
  { name: 'core-blue', className: 'bg-core-blue', role: 'Navigation and interaction' },
  { name: 'signal-yellow', className: 'bg-signal-yellow', role: 'Status' },
  { name: 'ok', className: 'bg-ok', role: 'In stock, delivered' },
  { name: 'warn', className: 'bg-warn', role: 'Low stock' },
  { name: 'danger', className: 'bg-danger', role: 'Errors' },
];

function Colours() {
  return (
    <Section
      title="Colour"
      note="Three accents with strict, non-overlapping roles. Red is money, blue is interaction, yellow is status — break that and the palette reads as a circus. Every value here clears the §6 contrast floor in both themes; npm run check:contrast proves it."
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SWATCHES.map((swatch) => (
          <li key={swatch.name} className="border border-armor-150 bg-armor-000">
            <div className={`h-14 ${swatch.className}`} />
            <div className="p-2">
              <p className="font-mono text-xs">{swatch.name}</p>
              <p className="mt-0.5 text-xs text-frame-300">{swatch.role}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Typography() {
  return (
    <Section
      title="Type"
      note="One superfamily in three roles. Condensed is a density decision — a product title has to fit two lines in a five-across grid. Mono is for machine identifiers only."
    >
      <div className="flex flex-col gap-4">
        <p className="font-display text-4xl">Master Grade</p>
        <p className="font-display text-2xl">MG 1/100 RX-93 Nu Gundam Ver.Ka</p>
        <p className="max-w-measure">
          Body copy is IBM Plex Sans at 16px with 1.55 leading, capped at 68 characters so a line
          never outruns the eye on the way back.
        </p>
        <p className="text-sm text-frame-300">
          Secondary text, 14px. Used for metadata and help text.
        </p>
        <p data-machine className="text-sm">
          RX-78-2 · MG-RX93-VKA · GS-260907-4471
        </p>
        <p className="text-xs text-frame-300">
          {formatRating(4.8)} ({formatCount(142)}) · {formatCount(1200)} sold ·{' '}
          {formatDuration(85632)} remaining
        </p>
      </div>
    </Section>
  );
}

function Buttons() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Section
      title="Buttons"
      note="Primary is the only filled and the only chamfered variant, and there is one per view. Loading preserves the button's width so nothing reflows, and a disabled button always says why."
    >
      <Row label="Primary">
        <Button>Add to cart</Button>
        <Button isLoading>Add to cart</Button>
        <Button disabled disabledReason="This kit is out of stock">
          Add to cart
        </Button>
      </Row>
      <Row label="Secondary">
        <Button variant="secondary">Buy now</Button>
        <Button variant="secondary" isLoading>
          Buy now
        </Button>
        <Button variant="secondary" disabled disabledReason="Pick a variant first">
          Buy now
        </Button>
      </Row>
      <Row label="Ghost">
        <Button variant="ghost">Cancel</Button>
        <Button variant="ghost">
          See all <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Row>
      <Row label="Danger">
        <Button variant="danger">Remove</Button>
        <Button variant="danger" disabled disabledReason="Paid orders cannot be cancelled here">
          Cancel order
        </Button>
      </Row>
      <Row label="Live loading">
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true);
            window.setTimeout(() => setIsLoading(false), 1500);
          }}
        >
          Place order
        </Button>
        <p className="text-xs text-frame-300">Click to watch the width hold steady.</p>
      </Row>
    </Section>
  );
}

/** The two-per-card cap and its priority order, run through the real rule rather than
 *  hand-placed badges. */
const BADGE_CASES = [
  {
    caption: 'Kit, discounted',
    input: {
      gradeCode: 'MG',
      stockState: 'IN_STOCK',
      availableQuantity: 12,
      discountPercent: 25,
      isNew: true,
      isPreorder: false,
    },
  },
  {
    caption: 'Kit, out of stock — outranks the discount',
    input: {
      gradeCode: 'RG',
      stockState: 'OUT_OF_STOCK',
      availableQuantity: 0,
      discountPercent: 15,
      isNew: true,
      isPreorder: false,
    },
  },
  {
    caption: 'Tool, no grade — two status slots',
    input: {
      gradeCode: null,
      stockState: 'LOW_STOCK',
      availableQuantity: 2,
      discountPercent: null,
      isNew: true,
      isPreorder: false,
    },
  },
  {
    caption: 'Kit, preorder',
    input: {
      gradeCode: 'PG',
      stockState: 'PREORDER',
      availableQuantity: 0,
      discountPercent: null,
      isNew: false,
      isPreorder: true,
    },
  },
] as const;

function Badges() {
  return (
    <Section
      title="Badges"
      note="Six tones, at most two per card, priority: out of stock, then discount, then new, then preorder. The selection is a pure function in lib/badges.ts, so these are the real results and not a mock-up."
    >
      <Row label="All tones">
        <Badge tone="grade">MG</Badge>
        <Badge tone="discount">−25%</Badge>
        <Badge tone="new">New</Badge>
        <Badge tone="preorder">Preorder</Badge>
        <Badge tone="low-stock">2 left</Badge>
        <Badge tone="out-of-stock">Out of stock</Badge>
      </Row>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {BADGE_CASES.map((badgeCase) => (
          <li key={badgeCase.caption} className="border border-armor-150 bg-armor-000 p-3">
            <div className="flex gap-1.5">
              {selectCardBadges(badgeCase.input).map((badge) => (
                <Badge key={badge.tone} tone={badge.tone}>
                  {badge.label}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-frame-300">{badgeCase.caption}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Money() {
  const [quantity, setQuantity] = useState(1);

  return (
    <Section
      title="Money and stock"
      note="Prices are integers everywhere else in the system and only become strings here. Tabular figures keep them aligned down a column. Stock always pairs a dot with a word — colour is never the only signal."
    >
      <Row label="Price sizes">
        <Price amountIdr={1250000} compareAtIdr={1680000} size="lg" />
        <Price amountIdr={1250000} compareAtIdr={1680000} />
        <Price amountIdr={95000} size="sm" />
      </Row>
      <Row label="Stock states">
        <StockPill state="IN_STOCK" availableQuantity={8} />
        <StockPill state="LOW_STOCK" availableQuantity={2} />
        <StockPill state="OUT_OF_STOCK" />
        <StockPill state="PREORDER" />
      </Row>
      <Row label="Quantity">
        <QuantityStepper value={quantity} onChange={setQuantity} max={8} label="MG Nu Gundam" />
        <p className="text-xs text-frame-300">
          Bounded at 8. Both ends explain themselves rather than going dead.
        </p>
      </Row>
    </Section>
  );
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'rating', label: 'Rating' },
  { value: 'unavailable', label: 'Best selling (no data yet)', disabled: true },
];

function Forms() {
  const [sort, setSort] = useState('newest');
  const [isChecked, setIsChecked] = useState(true);
  const [chips, setChips] = useState(['MG', 'Universal Century', 'In stock']);

  return (
    <Section
      title="Forms"
      note="Labels sit above the field and never vanish. Validation happens on blur, errors pair colour with an icon and text, and optional fields are marked so required ones do not have to be."
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Input label="Full name" placeholder="Rafi Pratama" defaultValue="" />
        <Input label="Email" type="email" hint="Order updates go here." defaultValue="" />
        <Input
          label="Phone"
          type="tel"
          error="Enter a phone number starting 08 or +62."
          defaultValue="12345"
        />
        <Input label="Delivery notes" isOptional placeholder="Gate code, landmark…" />
        <Input label="Order number" defaultValue="GS-260907-4471" disabled />
        <Select label="Sort" value={sort} onValueChange={setSort} options={SORT_OPTIONS} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <fieldset className="flex flex-col">
          <legend className="mb-1 text-sm font-medium">Grade</legend>
          <Checkbox label="Master Grade" checked={isChecked} onCheckedChange={setIsChecked} detail="218" />
          <Checkbox label="Real Grade" checked={false} onCheckedChange={() => {}} detail="146" />
          <Checkbox
            label="MGEX"
            checked={false}
            onCheckedChange={() => {}}
            detail="0"
            disabled
          />
        </fieldset>

        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-medium">Applied filters</p>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Chip
                key={chip}
                label={chip}
                onRemove={() => setChips((current) => current.filter((value) => value !== chip))}
              />
            ))}
            {chips.length === 0 ? (
              <p className="text-xs text-frame-300">All cleared. Reload to bring them back.</p>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Overlays() {
  const [bottomSheet, setBottomSheet] = useState(false);
  const [rightSheet, setRightSheet] = useState(false);
  const [dialog, setDialog] = useState(false);

  return (
    <Section
      title="Overlays"
      note="The only three surfaces that genuinely float, and so the only three that carry a shadow instead of a panel line. Each traps focus, closes on Escape and returns focus to whatever opened it."
    >
      <Row label="Surfaces">
        <Button variant="secondary" onClick={() => setBottomSheet(true)}>
          Filter sheet
        </Button>
        <Button variant="secondary" onClick={() => setRightSheet(true)}>
          Mini-cart drawer
        </Button>
        <Button variant="secondary" onClick={() => setDialog(true)}>
          Confirm dialog
        </Button>
      </Row>

      <Sheet
        open={bottomSheet}
        onOpenChange={setBottomSheet}
        title="Filter"
        footer={<Button className="w-full">Show 218 kits</Button>}
      >
        <fieldset className="flex flex-col">
          <legend className="mb-1 text-sm font-medium">Grade</legend>
          <Checkbox label="Master Grade" checked onCheckedChange={() => {}} detail="218" />
          <Checkbox label="Real Grade" checked={false} onCheckedChange={() => {}} detail="146" />
          <Checkbox label="Perfect Grade" checked={false} onCheckedChange={() => {}} detail="24" />
        </fieldset>
        <p className="mt-4 text-xs text-frame-300">
          The apply button counts live as options are ticked, before anything is committed.
        </p>
      </Sheet>

      <Sheet
        open={rightSheet}
        onOpenChange={setRightSheet}
        title="Cart"
        side="right"
        footer={<Button className="w-full">Checkout</Button>}
      >
        <div className="flex items-start gap-3 border-b border-armor-150 pb-4">
          <div className="chamfer size-16 shrink-0 bg-armor-050" />
          <div className="flex flex-col gap-1">
            <p className="font-display font-semibold">MG 1/100 Nu Gundam Ver.Ka</p>
            <Price amountIdr={1250000} size="sm" />
            <StockPill state="IN_STOCK" availableQuantity={8} />
          </div>
        </div>
        <p className="mt-4 text-xs text-frame-300">
          Wired to the cart in Phase 6. The drawer itself is done.
        </p>
      </Sheet>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Cancel this order?"
        description="Reserved stock returns to the catalogue immediately. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Keep order
            </Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Order <span data-machine>GS-260907-4471</span> · {formatIdr(1652000)}
        </p>
      </Dialog>
    </Section>
  );
}

type ListState = 'loading' | 'empty' | 'error' | 'loaded';

const STATES: readonly { value: ListState; label: string }[] = [
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'error', label: 'Error' },
  { value: 'loaded', label: 'Loaded' },
];

const LOADED_ITEMS = [
  { name: 'MG 1/100 RX-93 Nu Gundam Ver.Ka', grade: 'MG', price: 1250000, compareAt: 1680000, stock: 8 },
  { name: 'RG 1/144 RX-78-2 Gundam', grade: 'RG', price: 385000, compareAt: null, stock: 2 },
  { name: 'PG Unleashed 1/60 RX-78-2', grade: 'PG', price: 4250000, compareAt: null, stock: 0 },
] as const;

function FourStates() {
  const [state, setState] = useState<ListState>('loading');

  return (
    <Section
      title="The four states"
      note="Every list, grid and panel ships all four. Skeletons match the loaded dimensions exactly so nothing shifts on arrival; empty and error states each owe a reason and a route out."
    >
      <div role="group" aria-label="Preview state" className="mb-6 flex flex-wrap gap-2">
        {STATES.map((option) => (
          <Button
            key={option.value}
            variant={state === option.value ? 'secondary' : 'ghost'}
            onClick={() => setState(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="border border-armor-150 bg-armor-000">
        {state === 'loading' ? (
          <ul className="divide-y divide-armor-150">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-start gap-3 p-4">
                <Skeleton className="size-16 shrink-0" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {state === 'empty' ? (
          <EmptyState
            title="No kits match these filters."
            description='Try removing "In stock" — 42 Master Grade kits are on preorder.'
            action={
              <>
                <Button variant="secondary">Clear filters</Button>
                <Button variant="ghost">Browse all Master Grade</Button>
              </>
            }
          />
        ) : null}

        {state === 'error' ? (
          <ErrorState
            title="Couldn't load these products."
            description="The catalogue didn't respond. Your cart is safe."
            action={<Button variant="secondary">Try again</Button>}
          />
        ) : null}

        {state === 'loaded' ? (
          <ul className="divide-y divide-armor-150">
            {LOADED_ITEMS.map((item) => (
              <li key={item.name} className="flex items-start gap-3 p-4">
                <div className="chamfer size-16 shrink-0 bg-armor-050" />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-semibold">{item.name}</p>
                    <Badge tone="grade">{item.grade}</Badge>
                  </div>
                  <Price amountIdr={item.price} compareAtIdr={item.compareAt} />
                  <StockPill
                    state={item.stock === 0 ? 'OUT_OF_STOCK' : item.stock <= 5 ? 'LOW_STOCK' : 'IN_STOCK'}
                    availableQuantity={item.stock === 0 ? undefined : item.stock}
                  />
                </div>
                <button
                  type="button"
                  className="reticle grid size-11 place-items-center rounded-sm text-frame-300 transition-colors duration-fast ease-out hover:bg-ink-tint hover:text-ink"
                >
                  <Heart className="size-5" aria-hidden />
                  <span className="sr-only">Save {item.name} to Stash</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
