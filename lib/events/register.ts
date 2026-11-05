import type { AlumniAccount } from '@/lib/auth/request';
import {
  OPEN_PAYMENT_STATUSES,
  amountDuePaise,
  jubileeStatusFromPayment,
  statusFromAmounts,
} from '@/lib/events/balance';
import { selectCatalog } from '@/lib/events/catalog-select';
import { type EventCatalog } from '@/lib/events/types';
import { clampGuestMealsToPricing, eventToPricing } from '@/lib/events/pricing';
import { clampPartySize, clampPartySplit, eventPartyBounds } from '@/lib/events/party-bounds';
import { missingColumn } from '@/lib/events/registration-code';
import type { ExistingRegistrationRow } from '@/lib/events/existing-registration';
import {
  calculateEventRegistrationCost,
  guestsFromLegacy,
  legacySummaryFromGuests,
  normalizeGuests,
  validateRegistrationCost,
  type CostCalculationInput,
  type ParkingNeeded,
} from '@/lib/registration';
import {
  formatLocation,
  isValidBatch,
  isValidSection,
  mergeProfilePack,
  readPackedProfile,
} from '@/lib/registration-fields';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import { readRegistrationCode, type RegistrationCodeAdmin } from '@/lib/events/registration-code';
import { normalizePhoneNumber, phoneValidationError, splitE164 } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase-admin';

const REG_SELECT =
  'id,event_id,number_of_guests,alumni_count,food_preference,parking_needed,lunch,dinner,guests,attending,phone_number,payment_status,total_cost_paise,amount_paid_paise';
const REG_SELECT_LEGACY =
  'id,event_id,number_of_guests,food_preference,parking_needed,lunch,dinner,guests,attending,phone_number,payment_status,total_cost_paise,amount_paid_paise';

function profilePayload(me: AlumniAccount) {
  return {
    full_name: me.full_name,
    last_name: me.last_name,
    email: me.email,
    phone_number: me.phone_number,
    batch: me.batch,
    section: me.section,
    current_location: me.current_location,
  };
}

function withBalance(row: {
  total_cost_paise: number;
  amount_paid_paise?: number | null;
  payment_status: string;
}) {
  const amount_paid_paise = Math.max(0, Number(row.amount_paid_paise) || 0);
  const total_cost_paise = Math.max(0, Number(row.total_cost_paise) || 0);
  return {
    amount_paid_paise,
    amount_due_paise: amountDuePaise(total_cost_paise, amount_paid_paise),
    payment_status: row.payment_status,
  };
}

export async function getAccountRegistrationForEvent(
  me: AlumniAccount,
  eventId: string
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const id = String(eventId || '').trim();
  if (!id) return { status: 400, payload: { error: 'eventId is required' } };

  const admin = createAdminClient();
  async function selectOpenReg(columns: string) {
    return admin
      .from('event_registrations')
      .select(columns)
      .eq('event_id', id)
      .eq('account_id', me.id)
      .in('payment_status', [...OPEN_PAYMENT_STATUSES])
      .maybeSingle();
  }
  let { data, error } = await selectOpenReg(REG_SELECT);
  if (error && missingColumn(error)) {
    const legacy = await selectOpenReg(REG_SELECT_LEGACY);
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error('reg get', error);
    return {
      status: 500,
      payload: {
        error:
          error.message || 'Could not load registration. Apply the event_registrations migration.',
      },
    };
  }

  let registrationRow = data;
  if (data) {
    await repriceEventRegistrations(id);
    let refreshed = await selectOpenReg(REG_SELECT);
    if (refreshed.error && missingColumn(refreshed.error)) {
      refreshed = await selectOpenReg(REG_SELECT_LEGACY);
    }
    if (!refreshed.error && refreshed.data) registrationRow = refreshed.data;
  }

  // Always start from session account (already unpacks bio → section/last_name).
  // Overlay DB row; never let a sparse DB profile wipe packed section/last_name.
  let profile: Record<string, unknown> = profilePayload(me);
  const fullProfile = await admin
    .from('alumni_accounts')
    .select('full_name,last_name,email,phone_number,batch,section,current_location,bio')
    .eq('id', me.id)
    .maybeSingle();
  if (!fullProfile.error && fullProfile.data) {
    const row = fullProfile.data as Record<string, unknown>;
    const packed = readPackedProfile(row.bio);
    profile = {
      ...profile,
      ...row,
      section: row.section || packed?.section || profile.section || null,
      last_name: row.last_name || packed?.lastName || profile.last_name || null,
    };
  } else {
    const minProfile = await admin
      .from('alumni_accounts')
      .select('full_name,email,phone_number,batch,current_location,bio')
      .eq('id', me.id)
      .maybeSingle();
    if (!minProfile.error && minProfile.data) {
      const row = minProfile.data as Record<string, unknown>;
      const packed = readPackedProfile(row.bio);
      profile = {
        ...profile,
        ...row,
        section: packed?.section || profile.section || null,
        last_name: packed?.lastName || profile.last_name || null,
      };
    }
  }

  const reg = registrationRow as
    | (ExistingRegistrationRow & {
        id: string;
        event_id: string;
        total_cost_paise: number;
        amount_paid_paise?: number;
      })
    | null;

  const registration_code = reg
    ? await readRegistrationCode(admin as unknown as RegistrationCodeAdmin, reg.id)
    : null;

  return {
    status: 200,
    payload: {
      registration: reg
        ? {
            ...reg,
            ...withBalance(reg),
            registration_code,
          }
        : null,
      profile,
    },
  };
}

export async function registerAccountForEvent(
  me: AlumniAccount,
  body: Record<string, unknown>
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (me.role === 'admin') {
    return {
      status: 400,
      payload: { error: 'Committee accounts do not register for the event here' },
    };
  }

  const eventId = String(body.eventId || '').trim();
  if (!eventId) return { status: 400, payload: { error: 'eventId is required' } };

  const admin = createAdminClient();
  const { data: event, error: eventError } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).eq('id', eventId).eq('published', true).maybeSingle()
  );

  if (eventError || !event) {
    return { status: 404, payload: { error: 'Event not found or not published' } };
  }

  const catalog = event as unknown as EventCatalog;
  const parkingNeeded = (['none', '2-wheeler', '4-wheeler'].includes(String(body.parking_needed))
    ? String(body.parking_needed)
    : 'none') as ParkingNeeded;
  const bounds = eventPartyBounds(catalog);
  const rawAlumni = Math.floor(Number(body.alumni_count ?? body.people_count));
  const rawGuestsOnly = Math.floor(Number(body.guest_count));
  const hasSplit = Number.isFinite(rawAlumni) || Number.isFinite(rawGuestsOnly);
  let peopleIn = Number.isFinite(rawAlumni) ? Math.max(0, rawAlumni) : 1;
  let guestsIn = Number.isFinite(rawGuestsOnly) ? Math.max(0, rawGuestsOnly) : 0;
  if (!hasSplit) {
    const rawCount = Math.floor(Number(body.number_of_guests));
    const requested = Number.isFinite(rawCount) ? rawCount : bounds.min;
    const totalHint = clampPartySize(requested, bounds);
    peopleIn = totalHint > 0 ? 1 : 0;
    guestsIn = Math.max(0, totalHint - peopleIn);
  }
  const split = clampPartySplit(peopleIn, guestsIn, bounds);
  const alumniCount = split.people;
  const guestCountOnly = split.guests;
  const peopleHint = split.total;
  if (peopleHint < bounds.min || peopleHint > bounds.max) {
    return {
      status: 400,
      payload: {
        error: `Total attending (people + guests) must be between ${bounds.min} and ${bounds.max}`,
      },
    };
  }
  const pricing = eventToPricing(catalog);
  const guests =
    peopleHint === 0
      ? []
      : clampGuestMealsToPricing(
          pricing,
          Array.isArray(body.guests) && body.guests.length > 0
            ? normalizeGuests(body.guests, peopleHint)
            : guestsFromLegacy(
                peopleHint,
                body.food_preference,
                Boolean(body.lunch),
                Boolean(body.dinner)
              )
        );
  if (guests.length < bounds.min || guests.length > bounds.max) {
    return {
      status: 400,
      payload: {
        error: `Total attending (people + guests) must be between ${bounds.min} and ${bounds.max}`,
      },
    };
  }
  const summary = legacySummaryFromGuests(guests);
  const batchRawForFee = body.batch != null && body.batch !== '' ? Number(body.batch) : null;
  const batchForFee = isValidBatch(batchRawForFee) ? batchRawForFee : me.batch;
  const input = {
    guests,
    parkingNeeded,
    alumniCount,
    guestCount: guestCountOnly,
    batch: batchForFee,
  } satisfies CostCalculationInput;
  if (!validateRegistrationCost(pricing, input)) {
    return {
      status: 400,
      payload: {
        error:
          'Select lunch, dinner, or parking — or ensure your batch has a registration fee for this event',
      },
    };
  }

  const total = calculateEventRegistrationCost(pricing, input);

  const rawPhone = body.phone_number ? String(body.phone_number) : me.phone_number || '';
  const phone =
    normalizePhoneNumber(rawPhone.startsWith('+') ? rawPhone : rawPhone ? `+${rawPhone}` : '') ||
    null;
  if (!phone) {
    return {
      status: 400,
      payload: { error: 'Enter a valid phone number with country code (ISD)' },
    };
  }
  const phoneParts = splitE164(phone);
  const phoneErr = phoneValidationError(phoneParts.isd, phoneParts.national);
  if (phoneErr) {
    return { status: 400, payload: { error: phoneErr } };
  }

  const { data: existing } = await admin
    .from('event_registrations')
    .select('id,payment_status,amount_paid_paise')
    .eq('event_id', eventId)
    .eq('account_id', me.id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  const priorPaid = Math.max(0, Number(existing?.amount_paid_paise) || 0);
  const payment_status = statusFromAmounts(total, priorPaid);
  const amount_due_paise = amountDuePaise(total, priorPaid);

  const row = {
    event_id: eventId,
    account_id: me.id,
    phone_number: phone,
    number_of_guests: guests.length,
    alumni_count: alumniCount,
    food_preference: summary.food_preference,
    parking_needed: input.parkingNeeded,
    lunch: summary.lunch,
    dinner: summary.dinner,
    guests,
    attending: body.attending !== false,
    total_cost_paise: total,
    amount_paid_paise: priorPaid,
    payment_status,
    updated_at: new Date().toISOString(),
  };

  let regId = existing?.id;
  if (existing?.id) {
    let { error } = await admin.from('event_registrations').update(row).eq('id', existing.id);
    if (error && missingColumn(error)) {
      const { alumni_count: _a, ...withoutAlumni } = row;
      const retry = await admin.from('event_registrations').update(withoutAlumni).eq('id', existing.id);
      error = retry.error;
    }
    if (error) {
      console.error('reg update', error);
      return { status: 500, payload: { error: 'Could not update registration' } };
    }
  } else {
    let { data: inserted, error } = await admin
      .from('event_registrations')
      .insert(row)
      .select('id')
      .single();
    if (error && missingColumn(error)) {
      const { alumni_count: _a, ...withoutAlumni } = row;
      const retry = await admin.from('event_registrations').insert(withoutAlumni).select('id').single();
      inserted = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error('reg insert', error);
      return {
        status: 500,
        payload: {
          error:
            error.message || 'Could not save registration. Apply the event_registrations migration.',
        },
      };
    }
    regId = inserted!.id;
  }

  const fullName = String(body.full_name || '').trim() || me.full_name;
  const lastName = String(body.last_name || '').trim();
  const batchRaw = body.batch != null && body.batch !== '' ? Number(body.batch) : null;
  const batch = isValidBatch(batchRaw) ? batchRaw : me.batch;
  const sectionRaw = String(body.section || '').trim();
  const section = isValidSection(sectionRaw) ? sectionRaw : me.section;
  const city = String(body.city || '').trim();
  const country = String(body.country || '').trim();
  const location = formatLocation(city, country) || me.current_location || null;

  const jubilee = catalog.is_primary ? jubileeStatusFromPayment(payment_status) : undefined;
  const corePatch: Record<string, unknown> = {
    full_name: fullName,
    phone_number: phone,
    batch,
    current_location: location,
  };
  if (jubilee) corePatch.jubilee_reg_status = jubilee;

  const { error: coreError } = await admin
    .from('alumni_accounts')
    .update(corePatch)
    .eq('id', me.id);
  if (coreError) console.error('reg account core update', coreError);

  // Prefer real columns when migration is applied; always also pack into bio so
  // Complete payment works before last_name/section exist on alumni_accounts.
  if (lastName || section) {
    const extra: Record<string, unknown> = {};
    if (lastName) extra.last_name = lastName;
    if (section) extra.section = section;
    const { error: extraError } = await admin
      .from('alumni_accounts')
      .update(extra)
      .eq('id', me.id);
    if (extraError) {
      console.error('reg account section/last_name columns', extraError.message);
    }
    const { data: currentBio } = await admin
      .from('alumni_accounts')
      .select('bio')
      .eq('id', me.id)
      .maybeSingle();
    const { error: packedError } = await admin
      .from('alumni_accounts')
      .update({
        bio: mergeProfilePack(currentBio?.bio, {
          section: section || me.section || '',
          lastName: lastName || me.last_name || '',
        }),
      })
      .eq('id', me.id);
    if (packedError) console.error('reg account bio pack', packedError);
  }

  return {
    status: 200,
    payload: {
      ok: true,
      id: regId,
      payment_status,
      total_cost_paise: total,
      amount_paid_paise: priorPaid,
      amount_due_paise,
      jubilee_reg_status: jubilee,
    },
  };
}
