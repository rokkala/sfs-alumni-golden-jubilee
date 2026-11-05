import type { EventCatalog } from '@/lib/events/types';

/** Short admin/public label for alumnus fee, guest fee, and optional batch exception. */
export function registrationFeeLabel(
  event: Pick<
    EventCatalog,
    | 'base_ticket_paise'
    | 'guest_fee_paise'
    | 'fee_batch_from'
    | 'fee_batch_to'
    | 'fee_batch_paise'
  >
): string {
  const defaultFee = Math.max(0, event.base_ticket_paise || 0);
  const guestFee = Math.max(0, Number(event.guest_fee_paise) || 0);
  const from = event.fee_batch_from;
  const to = event.fee_batch_to;
  const rangeFee = Math.max(0, Number(event.fee_batch_paise) || 0);
  const hasRange = from != null || to != null;

  const parts: string[] = [];
  if (!hasRange) {
    if (defaultFee > 0) parts.push(`Alumnus ₹${(defaultFee / 100).toFixed(0)}`);
  } else {
    const rangeText =
      from != null && to != null
        ? `batches ${Math.min(from, to)}–${Math.max(from, to)}`
        : `batch ${from ?? to}`;
    parts.push(`Alumnus ${rangeText} ₹${(rangeFee / 100).toFixed(0)} · others ₹${(defaultFee / 100).toFixed(0)}`);
  }
  if (guestFee > 0) parts.push(`guest ₹${(guestFee / 100).toFixed(0)}`);
  if (parts.length === 0) return '';
  return `Registration fee: ${parts.join(' · ')}`;
}
