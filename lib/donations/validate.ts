/** Preset donation amounts in paise: ₹0, ₹1,000, ₹5,000, ₹10,000. */
export const DONATION_AMOUNT_CHIPS_PAISE = [0, 100_000, 500_000, 1_000_000] as const;

export const DONATION_MIN_PAISE = 100;
export const DONATION_MAX_MESSAGE = 280;

/** Throws Error with member-facing message when invalid. Zero is not payable. */
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
