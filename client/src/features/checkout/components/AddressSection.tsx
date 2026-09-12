import { CHECKOUT_FIELD_LIMITS } from '@gunsnip/shared';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CheckoutForm } from '../hooks/use-checkout-form';
import type { Region } from '../schema';
import { CheckoutSection } from './CheckoutSection';

/**
 * 2 · Shipping address (FR-CO-03): dependent province → city → district selects from the seeded
 * region tree, then postal code, street and notes.
 *
 * Each select's options arrive from the server render, already filtered by the level above — a
 * choice here saves the draft and asks the server to redraw, which is also what re-prices the
 * delivery options below. The district select appears only where districts are listed; elsewhere
 * the city is the most specific address there is.
 */
interface AddressSectionProps {
  form: CheckoutForm;
  provinces: readonly Region[];
  cities: readonly Region[];
  districts: readonly Region[];
}

const toOptions = (regions: readonly Region[]) => regions.map((region) => ({ value: region.id, label: region.name }));

export function AddressSection({ form, provinces, cities, districts }: AddressSectionProps) {
  const { draft, errors } = form;

  return (
    <CheckoutSection step={2} title="Shipping address">
      <div className="grid gap-4 md:grid-cols-3">
        <div data-field="provinceId">
          <Select
            label="Province"
            placeholder="Choose a province"
            value={draft.provinceId ?? ''}
            onValueChange={form.chooseProvince}
            options={toOptions(provinces)}
            error={errors.provinceId}
          />
        </div>

        <div data-field="cityId">
          <Select
            label="City or regency"
            placeholder={draft.provinceId === null ? 'Choose a province first' : 'Choose a city'}
            value={draft.cityId ?? ''}
            onValueChange={(cityId) => {
              const city = cities.find((candidate) => candidate.id === cityId);
              if (city !== undefined) form.chooseCity(city);
            }}
            options={toOptions(cities)}
            disabled={draft.provinceId === null || cities.length === 0}
            error={errors.cityId}
          />
        </div>

        {form.cityHasDistricts ? (
          <div data-field="districtId">
            <Select
              label="District"
              placeholder="Choose a district"
              value={draft.districtId ?? ''}
              onValueChange={form.chooseDistrict}
              options={toOptions(districts)}
              disabled={districts.length === 0}
              error={errors.districtId}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div data-field="postalCode">
          <Input
            label="Postal code"
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={draft.postalCode}
            error={errors.postalCode}
            onChange={(event) => form.setText('postalCode', event.target.value)}
            onBlur={() => form.blur('postalCode')}
          />
        </div>

        <div data-field="street">
          <Input
            label="Street address"
            name="street"
            autoComplete="street-address"
            hint="Street, building, house number, RT/RW."
            maxLength={CHECKOUT_FIELD_LIMITS.street}
            value={draft.street}
            error={errors.street}
            onChange={(event) => form.setText('street', event.target.value)}
            onBlur={() => form.blur('street')}
          />
        </div>
      </div>

      <div data-field="notes">
        <Input
          label="Notes for the courier"
          name="notes"
          isOptional
          hint="Landmark, gate code, who can receive it."
          maxLength={CHECKOUT_FIELD_LIMITS.notes}
          value={draft.notes}
          error={errors.notes}
          onChange={(event) => form.setText('notes', event.target.value)}
          onBlur={() => form.blur('notes')}
        />
      </div>
    </CheckoutSection>
  );
}
