import { NextResponse } from 'next/server';
import { getInrFxRates } from '@/lib/fx/fetch-rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rates, fetchedAt, provider, cached } = await getInrFxRates();
    return NextResponse.json(
      {
        base: 'INR',
        rates,
        fetchedAt,
        provider,
        cached,
        note: 'Estimates only. Payments are charged in INR.',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load exchange rates';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
