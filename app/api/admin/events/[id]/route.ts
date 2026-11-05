import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import {
  DIET_PRICE_WARNING,
  EVENT_SELECT_MEALS,
  GUEST_FEE_WARNING,
  MEAL_PROVIDED_WARNING,
  PARTY_LIMITS_WARNING,
  selectCatalog,
  withoutDietPrices,
  withoutFeeBatch,
  withoutGuestFee,
  withoutMealProvided,
  withoutPartyLimits,
  withoutRefundEmail,
} from '@/lib/events/catalog-select';
import { DEFAULT_PARTY_MAX, DEFAULT_PARTY_MIN, parsePartyBound } from '@/lib/events/party-bounds';
import { missingColumn } from '@/lib/events/registration-code';
import { normalizeRefundEmail } from '@/lib/events/refund-mailto';
import { EVENT_SELECT_CORE } from '@/lib/events/types';
import { parseNonNegInt, parseOptionalBatchYear } from '@/lib/events/pricing';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import { createAdminClient } from '@/lib/supabase-admin';

type Ctx = { params: { id: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = ctx.params.id;

  const admin = createAdminClient();
  const { data, error } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).eq('id', id).maybeSingle()
  );
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = ctx.params.id;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.summary !== undefined) patch.summary = String(body.summary).trim();
  if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body.starts_at !== undefined) patch.starts_at = String(body.starts_at);
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at ? String(body.ends_at) : null;
  if (body.venue !== undefined) patch.venue = body.venue ? String(body.venue) : null;
  if (body.published !== undefined) patch.published = Boolean(body.published);
  if (body.lunch_paise !== undefined) patch.lunch_paise = parseNonNegInt(body.lunch_paise);
  if (body.dinner_paise !== undefined) patch.dinner_paise = parseNonNegInt(body.dinner_paise);
  if (body.lunch_nonveg_paise !== undefined) patch.lunch_nonveg_paise = parseNonNegInt(body.lunch_nonveg_paise);
  if (body.dinner_nonveg_paise !== undefined) patch.dinner_nonveg_paise = parseNonNegInt(body.dinner_nonveg_paise);
  if (body.lunch_provided !== undefined) patch.lunch_provided = Boolean(body.lunch_provided);
  if (body.dinner_provided !== undefined) patch.dinner_provided = Boolean(body.dinner_provided);
  if (body.parking_2w_paise !== undefined) patch.parking_2w_paise = parseNonNegInt(body.parking_2w_paise);
  if (body.parking_4w_paise !== undefined) patch.parking_4w_paise = parseNonNegInt(body.parking_4w_paise);
  if (body.base_ticket_paise !== undefined) patch.base_ticket_paise = parseNonNegInt(body.base_ticket_paise);
  if (body.guest_fee_paise !== undefined) patch.guest_fee_paise = parseNonNegInt(body.guest_fee_paise);
  if (body.fee_batch_from !== undefined) patch.fee_batch_from = parseOptionalBatchYear(body.fee_batch_from);
  if (body.fee_batch_to !== undefined) patch.fee_batch_to = parseOptionalBatchYear(body.fee_batch_to);
  if (body.fee_batch_paise !== undefined) patch.fee_batch_paise = parseNonNegInt(body.fee_batch_paise);
  if (body.refund_email !== undefined) patch.refund_email = normalizeRefundEmail(body.refund_email);
  if (body.party_min !== undefined) patch.party_min = parsePartyBound(body.party_min, DEFAULT_PARTY_MIN);
  if (body.party_max !== undefined) patch.party_max = parsePartyBound(body.party_max, DEFAULT_PARTY_MAX);
  if (body.is_primary !== undefined) patch.is_primary = Boolean(body.is_primary);

  if (patch.title === '' || patch.summary === '') {
    return NextResponse.json({ error: 'Title and summary cannot be empty' }, { status: 400 });
  }
  if (
    typeof patch.party_min === 'number' &&
    typeof patch.party_max === 'number' &&
    patch.party_min > patch.party_max
  ) {
    return NextResponse.json(
      { error: 'Min people attending cannot be greater than max' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (patch.is_primary === true) {
    await admin.from('event_catalog').update({ is_primary: false }).eq('is_primary', true).neq('id', id);
  }

  let { data, error } = await admin
    .from('event_catalog')
    .update(patch)
    .eq('id', id)
    .select(EVENT_SELECT_MEALS)
    .maybeSingle();
  let warning: string | null = null;
  if (error && missingColumn(error)) {
    const msg = error.message || '';
    const partyMissing = /party_min|party_max/i.test(msg);
    const guestMissing = /guest_fee_paise/i.test(msg);
    const mealProvidedMissing = /lunch_provided|dinner_provided/i.test(msg);
    const retry = await admin
      .from('event_catalog')
      .update(
        withoutGuestFee(
          withoutPartyLimits(
            withoutRefundEmail(
              withoutFeeBatch(withoutDietPrices(withoutMealProvided(patch)))
            )
          )
        )
      )
      .eq('id', id)
      .select(EVENT_SELECT_CORE)
      .maybeSingle();
    data = retry.data as unknown as typeof data;
    error = retry.error;
    warning = partyMissing
      ? PARTY_LIMITS_WARNING
      : guestMissing
        ? GUEST_FEE_WARNING
        : mealProvidedMissing
          ? MEAL_PROVIDED_WARNING
          : DIET_PRICE_WARNING;
  }

  if (error || !data) {
    console.error('admin events patch', error);
    return NextResponse.json({ error: error?.message || 'Could not update event' }, { status: 500 });
  }

  const pricingTouched = [
    'lunch_paise',
    'dinner_paise',
    'lunch_nonveg_paise',
    'dinner_nonveg_paise',
    'lunch_provided',
    'dinner_provided',
    'parking_2w_paise',
    'parking_4w_paise',
    'base_ticket_paise',
    'guest_fee_paise',
    'fee_batch_from',
    'fee_batch_to',
    'fee_batch_paise',
  ].some((key) => body[key] !== undefined);
  if (pricingTouched) await repriceEventRegistrations(id);

  return NextResponse.json(warning ? { ...data, warning } : data);
}
