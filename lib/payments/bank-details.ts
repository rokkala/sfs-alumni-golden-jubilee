/** Pure helpers for offline bank / UPI payment accounts. */

export type PaymentAccountRow = {
  id: string;
  label: string;
  active: boolean;
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!IFSC_RE.test(s)) return null;
  return s;
}

export function buildUpiPayUri(opts: {
  upiId: string;
  amountPaise: number;
  payeeName?: string;
  note?: string;
}): string | null {
  const pa = String(opts.upiId || '').trim();
  const amountPaise = Math.floor(Number(opts.amountPaise) || 0);
  if (!pa || amountPaise <= 0) return null;
  const am = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams();
  params.set('pa', pa);
  const pn = String(opts.payeeName || '').trim();
  if (pn) params.set('pn', pn);
  params.set('am', am);
  params.set('cu', 'INR');
  const tn = String(opts.note || '').trim();
  if (tn) params.set('tn', tn);
  return `upi://pay?${params.toString()}`;
}

export function pickActiveAccount<T extends { active: boolean }>(
  accounts: T[]
): T | null {
  return accounts.find((a) => a.active) || null;
}

/** Return a new list where only `activeId` is active. */
export function withExclusiveActive<T extends { id: string; active: boolean }>(
  accounts: T[],
  activeId: string
): T[] {
  return accounts.map((a) => ({ ...a, active: a.id === activeId }));
}

export type PaymentAccountInput = {
  label: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName?: string | null;
  upiId?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export function assertPaymentAccountInput(body: Record<string, unknown>): {
  label: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string | null;
  upi_id: string | null;
  active: boolean;
  sort_order: number;
} {
  const label = String(body.label || '').trim();
  if (!label) throw new Error('Label is required');

  const account_name = String(body.accountName ?? body.account_name ?? '').trim();
  if (!account_name) throw new Error('Account holder name is required');

  const account_number = String(body.accountNumber ?? body.account_number ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!/^\d{6,18}$/.test(account_number)) {
    throw new Error('Account number must be 6–18 digits');
  }

  const ifsc = normalizeIfsc(body.ifsc);
  if (!ifsc) throw new Error('Valid IFSC is required (e.g. SBIN0001234)');

  const bank_name = String(body.bankName ?? body.bank_name ?? '').trim() || null;
  const upi_id = String(body.upiId ?? body.upi_id ?? '').trim() || null;
  if (upi_id && !upi_id.includes('@')) {
    throw new Error('UPI ID must look like name@bank');
  }

  const active = body.active === true || body.active === 'true';
  const sort_order = Math.trunc(Number(body.sortOrder ?? body.sort_order) || 0);

  return {
    label,
    account_name,
    account_number,
    ifsc,
    bank_name,
    upi_id,
    active,
    sort_order,
  };
}
