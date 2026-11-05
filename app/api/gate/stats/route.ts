import { NextResponse } from 'next/server';
import { amountDuePaise } from '@/lib/events/balance';
import { partySplitFromStored } from '@/lib/events/party-bounds';
import { requireGateOrAdmin } from '@/lib/gate/access';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const access = await requireGateOrAdmin();
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const eventId = new URL(request.url).searchParams.get('event_id') || '';
  const admin = createAdminClient();

  const selects = [
    'payment_status,number_of_guests,alumni_count,total_cost_paise,amount_paid_paise,checked_in_at,registration_code,alumni_accounts(full_name)',
    'payment_status,number_of_guests,total_cost_paise,amount_paid_paise,checked_in_at,registration_code,alumni_accounts(full_name)',
    'payment_status,number_of_guests,alumni_count,total_cost_paise,amount_paid_paise',
    'payment_status,number_of_guests,total_cost_paise,amount_paid_paise',
  ];

  let rows: Record<string, unknown>[] | null = null;
  let migrationNeeded = false;

  for (const select of selects) {
    let query = admin.from('event_registrations').select(select).order('checked_in_at', { ascending: false });
    if (eventId) query = query.eq('event_id', eventId);
    const { data, error } = await query;
    if (!error) {
      rows = (data || []) as unknown as Record<string, unknown>[];
      migrationNeeded = !select.includes('checked_in_at');
      break;
    }
  }

  if (!rows) {
    return NextResponse.json({ error: 'Could not load stats' }, { status: 500 });
  }

  const splitOf = (r: Record<string, unknown>) =>
    partySplitFromStored(Number(r.number_of_guests) || 0, r.alumni_count as number | null | undefined);

  const recent = migrationNeeded
    ? []
    : rows
        .filter((r) => r.checked_in_at)
        .slice(0, 10)
        .map((r) => {
          const account = Array.isArray(r.alumni_accounts)
            ? r.alumni_accounts[0]
            : (r.alumni_accounts as { full_name?: string } | null);
          const split = splitOf(r);
          return {
            registration_code: r.registration_code,
            full_name: account?.full_name || '—',
            checked_in_at: r.checked_in_at,
            number_of_guests: split.total,
            people_count: split.people,
            guest_count: split.guests,
            attending_total: split.total,
          };
        });

  const people = rows.reduce((n, r) => n + splitOf(r).total, 0);
  const alumniPeople = rows.reduce((n, r) => n + splitOf(r).people, 0);
  const accompanyingGuests = rows.reduce((n, r) => n + splitOf(r).guests, 0);
  const onSite = rows.filter((r) => r.checked_in_at);
  const peopleOnSite = onSite.reduce((n, r) => n + splitOf(r).total, 0);
  const alumniOnSite = onSite.reduce((n, r) => n + splitOf(r).people, 0);
  const guestsOnSite = onSite.reduce((n, r) => n + splitOf(r).guests, 0);

  return NextResponse.json({
    registration_count: rows.length,
    people,
    alumni_people: alumniPeople,
    accompanying_guests: accompanyingGuests,
    checked_in_count: migrationNeeded ? 0 : onSite.length,
    unpaid_count: rows.filter((r) => {
      const due = amountDuePaise(Number(r.total_cost_paise) || 0, Number(r.amount_paid_paise) || 0);
      return due > 0;
    }).length,
    unpaid_attempts: rows.filter((r) => {
      const due = amountDuePaise(Number(r.total_cost_paise) || 0, Number(r.amount_paid_paise) || 0);
      return due > 0;
    }).length,
    people_on_site: peopleOnSite,
    alumni_on_site: alumniOnSite,
    guests_on_site: guestsOnSite,
    recent,
    migration_needed: migrationNeeded,
  });
}
