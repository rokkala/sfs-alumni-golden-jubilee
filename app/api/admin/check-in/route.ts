import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { amountDuePaise } from '@/lib/events/balance';
import {
  issueMissingPaidCodes,
  missingColumn,
  normalizeRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { partySplitFromStored } from '@/lib/events/party-bounds';
import {
  formatGuestMealCounts,
  guestMealCounts,
  guestsFromLegacy,
  normalizeGuests,
} from '@/lib/registration';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const code = normalizeRegistrationCode(new URL(request.url).searchParams.get('code') || '');
  if (!code) {
    return NextResponse.json({ error: 'Enter a registration ID' }, { status: 400 });
  }

  const admin = createAdminClient();
  await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);
  const selectWithAlumni =
    'registration_code,number_of_guests,alumni_count,food_preference,lunch,dinner,guests,payment_status,total_cost_paise,amount_paid_paise,event_catalog(title),alumni_accounts(full_name)';
  const selectLegacy =
    'registration_code,number_of_guests,food_preference,lunch,dinner,guests,payment_status,total_cost_paise,amount_paid_paise,event_catalog(title),alumni_accounts(full_name)';
  let { data, error } = await admin
    .from('event_registrations')
    .select(selectWithAlumni)
    .eq('registration_code', code)
    .maybeSingle();
  if (error && missingColumn(error)) {
    const retry = await admin
      .from('event_registrations')
      .select(selectLegacy)
      .eq('registration_code', code)
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error && missingColumn(error)) {
    return NextResponse.json(
      { error: 'Registration IDs are not stored yet. Run the registration code migration in Supabase.' },
      { status: 503 }
    );
  }
  if (error) {
    console.error('check-in', error);
    return NextResponse.json({ error: 'Could not look up that ID' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'No registration for that ID' }, { status: 404 });
  }

  const row = data as {
    registration_code: string;
    number_of_guests: number;
    alumni_count?: number | null;
    food_preference?: string | null;
    lunch?: boolean;
    dinner?: boolean;
    guests?: unknown;
    payment_status: string;
    total_cost_paise: number;
    amount_paid_paise?: number;
    event_catalog: { title: string } | { title: string }[] | null;
    alumni_accounts: { full_name: string } | { full_name: string }[] | null;
  };
  const account = Array.isArray(row.alumni_accounts) ? row.alumni_accounts[0] : row.alumni_accounts;
  const event = Array.isArray(row.event_catalog) ? row.event_catalog[0] : row.event_catalog;
  const amount_paid_paise = Math.max(0, Number(row.amount_paid_paise) || 0);
  const total_cost_paise = Math.max(0, Number(row.total_cost_paise) || 0);
  const guests =
    Array.isArray(row.guests) && row.guests.length > 0
      ? normalizeGuests(row.guests, row.number_of_guests)
      : guestsFromLegacy(row.number_of_guests, row.food_preference, Boolean(row.lunch), Boolean(row.dinner));
  const split = partySplitFromStored(row.number_of_guests, row.alumni_count);

  return NextResponse.json({
    registration_code: row.registration_code,
    full_name: account?.full_name || '—',
    number_of_guests: row.number_of_guests,
    people_count: split.people,
    guest_count: split.guests,
    attending_total: split.total,
    meals: formatGuestMealCounts(guestMealCounts(guests)),
    event_title: event?.title || 'Event',
    payment_status: row.payment_status,
    amount_paid_paise,
    amount_due_paise: amountDuePaise(total_cost_paise, amount_paid_paise),
  });
}
