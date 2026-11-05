'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { buildUpiPayUri } from '@/lib/payments/bank-details';

export type BankAccountPublic = {
  id: string;
  label: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string | null;
  upi_id: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  account: BankAccountPublic;
  amountPaise: number;
  note?: string;
  /** registration | donation payload fields for FormData */
  source:
    | { type: 'registration'; registrationId: string }
    | { type: 'donation'; causeId: string; message?: string };
  onSubmitted?: (message: string) => void;
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function OfflinePayModal({
  open,
  onClose,
  account,
  amountPaise,
  note,
  source,
  onSubmitted,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [qrSrc, setQrSrc] = useState('');
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const upiUri =
    account.upi_id
      ? buildUpiPayUri({
          upiId: account.upi_id,
          amountPaise,
          payeeName: account.account_name,
          note: note || account.label,
        })
      : null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!open || !upiUri) {
      setQrSrc('');
      return;
    }
    let cancel = false;
    import('qrcode')
      .then((mod) =>
        mod.default.toDataURL(upiUri, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      )
      .then((url) => {
        if (!cancel) setQrSrc(url);
      })
      .catch(() => {
        if (!cancel) setQrSrc('');
      });
    return () => {
      cancel = true;
    };
  }, [open, upiUri]);

  if (!open) return null;

  async function onCopy(label: string, value: string) {
    const ok = await copyText(value);
    setCopied(ok ? label : '');
    if (ok) setTimeout(() => setCopied(''), 1500);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!utr.trim() && !file) {
      setError('Add a UTR reference or a payment screenshot');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('sourceType', source.type);
      fd.set('paymentAccountId', account.id);
      if (utr.trim()) fd.set('utr', utr.trim());
      if (file) fd.set('screenshot', file);
      if (source.type === 'registration') {
        fd.set('registrationId', source.registrationId);
      } else {
        fd.set('causeId', source.causeId);
        fd.set('amountPaise', String(amountPaise));
        if (source.message) fd.set('message', source.message);
      }
      const res = await fetch('/api/payments/offline-proof', { method: 'POST', body: fd });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not submit');
        return;
      }
      onSubmitted?.(
        payload.message ||
          'Submitted for committee verification. You will be confirmed once reviewed.'
      );
      setUtr('');
      setFile(null);
      onClose();
    } catch {
      setError('Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const rows: { label: string; value: string; key: string }[] = [
    { key: 'name', label: 'Account name', value: account.account_name },
    { key: 'number', label: 'Account number', value: account.account_number },
    { key: 'ifsc', label: 'IFSC', value: account.ifsc },
  ];
  if (account.bank_name) {
    rows.push({ key: 'bank', label: 'Bank', value: account.bank_name });
  }
  if (account.upi_id) {
    rows.push({ key: 'upi', label: 'UPI ID', value: account.upi_id });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white border border-outline-variant shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 bg-white border-b border-outline-variant px-5 py-4">
          <div>
            <h2 id={titleId} className="text-headline-sm text-primary">
              Bank / UPI transfer
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Pay {formatInr(amountPaise)} to <strong>{account.label}</strong>, then submit proof.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-label-sm uppercase tracking-wider text-primary">{r.label}</p>
                  <p className="text-body-sm text-on-surface break-all tabular-nums">{r.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onCopy(r.key, r.value)}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-label-sm font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {copied === r.key ? 'Copied' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>

          {account.upi_id ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center">
              <p className="text-label-sm uppercase tracking-wider text-primary mb-3">
                Scan with any UPI app
              </p>
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrSrc}
                  alt={`UPI QR for ${account.upi_id}`}
                  width={220}
                  height={220}
                  className="mx-auto rounded-lg bg-white p-2"
                />
              ) : (
                <p className="text-body-sm text-on-surface-variant">Preparing QR…</p>
              )}
              <p className="text-body-sm text-on-surface-variant mt-2 break-all">{account.upi_id}</p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3 border-t border-outline-variant pt-4">
            <p className="text-body-sm text-on-surface-variant">
              After paying, add UTR and/or a screenshot so the committee can verify.
            </p>
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                UTR / reference (optional)
              </span>
              <input
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                disabled={busy}
                className="mt-1 w-full px-4 py-3 rounded-lg border border-outline-variant text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Bank / UPI reference number"
              />
            </label>
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Screenshot (optional)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-body-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-label-sm file:font-bold file:uppercase file:tracking-wider file:text-on-primary"
              />
            </label>
            {error ? (
              <p className="rounded-lg bg-error-container text-error text-body-sm p-3" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
