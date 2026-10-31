export const DONATION_AMOUNT_CHIPS_PAISE = [50000, 100000, 250000, 500000] as const;

export const DONATION_MIN_PAISE = 100;
export const DONATION_MAX_MESSAGE = 280;

/** Throws Error with member-facing message when invalid. */
export function assertDonationAmountPaise(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < DONATION_MIN_PAISE) {
    throw new Error('Donation must be at least ₹1');
  }
  if (n > 10_000_000_00) {
    throw new Error('Donation amount is too large');
  }
  return n;
}

/** Empty → null; otherwise trimmed string ≤ MAX. */
export function assertDonationMessage(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.length > DONATION_MAX_MESSAGE) {
    throw new Error(`Message must be ${DONATION_MAX_MESSAGE} characters or fewer`);
  }
  return raw;
}
