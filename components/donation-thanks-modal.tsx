'use client';

import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';

export type DonationThanksDetails = {
  amount_paise: number;
  causeTitle: string;
  paymentId: string;
};

function formatInrFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function GratitudeMark() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-16 w-16"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="40" cy="40" r="38" fill="#efe2cc" stroke="#8a6a3a" strokeOpacity="0.45" strokeWidth="2" />
      <path
        d="M40 54c-9.5-6.8-15.5-12.8-15.5-19.2 0-4.2 3.2-7.3 7.2-7.3 2.4 0 4.6 1.2 6 3.1 1.4-1.9 3.6-3.1 6-3.1 4 0 7.2 3.1 7.2 7.3C53.9 41.2 47.9 47.2 40 54z"
        fill="#8a6a3a"
      />
      <path
        d="M28 28c-2.8-4.2-8-3.6-10.2.6-1.8 3.4-.4 7.6 3.2 10.2"
        stroke="#1e3a5f"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M52 28c2.8-4.2 8-3.6 10.2.6 1.8 3.4.4 7.6-3.2 10.2"
        stroke="#1e3a5f"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DonationThanksModal({
  open,
  details,
  onClose,
}: {
  open: boolean;
  details: DonationThanksDetails | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !details) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-primary/55 backdrop-blur-[3px] cursor-pointer"
        aria-label="Close thank-you dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="donation-thanks-card relative z-[81] w-full sm:max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-jubilee-gold-deep/30 shadow-2xl"
      >
        <div className="relative bg-gradient-to-b from-[#f7efe0] via-surface-paper to-[#f3e8d4] px-6 pt-7 pb-6 sm:px-8">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-jubilee-gold-deep via-[#c4a35a] to-jubilee-gold-deep"
            aria-hidden
          />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 p-2 rounded-lg text-primary/70 hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-jubilee-gold-deep/40"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="donation-thanks-mark mb-4">
              <GratitudeMark />
            </div>
            <p className="text-label-sm uppercase tracking-[0.2em] text-jubilee-gold-deep font-bold">
              With gratitude
            </p>
            <h2
              id={titleId}
              className="mt-3 text-[1.35rem] sm:text-headline-sm leading-snug text-primary font-semibold max-w-[18ch]"
            >
              SFS Alumni Association sincerely appreciates your contribution.
            </h2>
            <p className="mt-4 text-body-md text-on-surface-variant">
              Your gift of{' '}
              <span className="text-primary font-bold">{formatInrFromPaise(details.amount_paise)}</span>
              {' '}supports{' '}
              <span className="text-primary font-semibold">{details.causeTitle}</span>.
            </p>
            <p className="mt-3 text-label-sm text-on-surface-variant/80 break-all max-w-full">
              Reference · {details.paymentId}
            </p>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-jubilee-gold-deep focus:ring-offset-2"
            >
              Donate again
            </button>
            <Link
              href="/member"
              className="flex-1 text-center rounded-lg border border-jubilee-gold-deep/40 bg-white/70 px-4 py-3 text-label-sm uppercase tracking-wider text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-jubilee-gold-deep/50 focus:ring-offset-2"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
