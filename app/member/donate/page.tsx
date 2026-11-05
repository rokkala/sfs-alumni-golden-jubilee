'use client';

import { FormEvent, useEffect, useState } from 'react';
import AmountWithFx from '@/components/amount-with-fx';
import DonationThanksModal from '@/components/donation-thanks-modal';
import MemberGate from '@/components/member-gate';
import OfflinePayModal, { type BankAccountPublic } from '@/components/offline-pay-modal';
import PortalShell from '@/components/portal-shell';
import {
  DONATION_AMOUNT_CHIPS_PAISE,
  DONATION_MAX_MESSAGE,
  DONATION_MAX_PAISE,
  DONATION_MAX_RUPEES,
} from '@/lib/donations/validate';
import { openRazorpayCheckout } from '@/lib/payments/checkout-client';

type Cause = {
  id: string;
  title: string;
  description: string | null;
};

function formatInrFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function MemberDonatePage() {
  const [causes, setCauses] = useState<Cause[] | null>(null);
  const [causeId, setCauseId] = useState('');
  const [chipPaise, setChipPaise] = useState<number>(DONATION_AMOUNT_CHIPS_PAISE[1]);
  const [customRupees, setCustomRupees] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccountPublic | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineNote, setOfflineNote] = useState('');
  const [success, setSuccess] = useState<{
    amount_paise: number;
    causeTitle: string;
    paymentId: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [causesRes, bankRes] = await Promise.all([
          fetch('/api/donations/causes', { cache: 'no-store' }),
          fetch('/api/payments/bank-details', { cache: 'no-store' }),
        ]);
        const causesPayload = await causesRes.json().catch(() => ({}));
        const bankPayload = await bankRes.json().catch(() => ({}));
        if (!active) return;
        if (!causesRes.ok) {
          setCauses([]);
          setError(causesPayload.error || 'Could not load causes');
          return;
        }
        const list = (causesPayload.causes || []) as Cause[];
        setCauses(list);
        if (list[0]) setCauseId(list[0].id);
        setBankAccount(bankRes.ok ? bankPayload.account || null : null);
      } catch {
        if (active) {
          setCauses([]);
          setError('Could not load causes');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedCause = causes?.find((c) => c.id === causeId) || null;

  function amountPaise(): number | null {
    if (useCustom) {
      const n = Math.round(Number(customRupees) * 100);
      if (!Number.isFinite(n) || n < 100 || n > DONATION_MAX_PAISE) return null;
      return n;
    }
    return chipPaise;
  }

  const payableAmount = amountPaise();
  const canPay = payableAmount != null && payableAmount >= 100 && payableAmount <= DONATION_MAX_PAISE;

  async function onPay(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(null);
    const amount = amountPaise();
    if (!causeId) {
      setError('Choose a cause');
      return;
    }
    if (amount == null || amount < 100 || amount > DONATION_MAX_PAISE) {
      setError(
        useCustom
          ? `Enter a positive amount between ₹1 and ₹${DONATION_MAX_RUPEES.toLocaleString('en-IN')}`
          : 'Choose an amount above ₹0 to pay'
      );
      return;
    }
    setBusy(true);
    try {
      const orderRes = await fetch('/api/donations/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          causeId,
          amountPaise: amount,
          message,
        }),
      });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        setError(order.error || 'Could not start payment');
        return;
      }

      const checkout = await openRazorpayCheckout({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        keyId: order.keyId,
        name: order.name,
        email: order.email,
        contact: order.contact,
        description: order.description || 'Donation',
      });

      if (!checkout) {
        setError('Payment cancelled');
        return;
      }
      if ('failed' in checkout) {
        setError(checkout.message || 'Payment failed');
        return;
      }

      const verifyRes = await fetch('/api/donations/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          donationId: order.donationId,
          razorpay_order_id: checkout.razorpay_order_id,
          razorpay_payment_id: checkout.razorpay_payment_id,
          razorpay_signature: checkout.razorpay_signature,
        }),
      });
      const verified = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setError(verified.error || 'Could not confirm payment');
        return;
      }

      setSuccess({
        amount_paise: verified.amount_paise || amount,
        causeTitle: selectedCause?.title || 'Donation',
        paymentId: checkout.razorpay_payment_id,
      });
    } catch {
      setError('Payment failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Donate" intro="Support a cause that matters to SFS.">
      <MemberGate>
        <DonationThanksModal
          open={Boolean(success)}
          details={success}
          onClose={() => setSuccess(null)}
        />
        <form
          onSubmit={onPay}
          className="rounded-2xl border border-outline-variant bg-white p-5 sm:p-7 max-w-xl space-y-5"
        >
            <div>
              <p className="text-label-sm uppercase tracking-wider text-primary mb-2">Cause</p>
              {causes === null ? (
                <p className="text-body-sm text-on-surface-variant">Loading…</p>
              ) : !causes.length ? (
                <p className="text-body-sm text-on-surface-variant">
                  No active causes yet. Check back soon.
                </p>
              ) : (
                <ul className="space-y-2">
                  {causes.map((c) => (
                    <li key={c.id}>
                      <label
                        className={`flex gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
                          causeId === c.id
                            ? 'border-jubilee-gold-deep bg-jubilee-gold-light/40'
                            : 'border-outline-variant'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cause"
                          className="mt-1 accent-primary"
                          checked={causeId === c.id}
                          onChange={() => setCauseId(c.id)}
                          disabled={busy}
                        />
                        <span className="min-w-0">
                          <span className="block text-body-md text-primary font-semibold">
                            {c.title}
                          </span>
                          {c.description ? (
                            <span className="block text-body-sm text-on-surface-variant mt-0.5">
                              {c.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-label-sm uppercase tracking-wider text-primary mb-2">Amount</p>
              <ul className="space-y-2">
                {DONATION_AMOUNT_CHIPS_PAISE.map((paise) => (
                  <li key={paise}>
                    <label
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
                        !useCustom && chipPaise === paise
                          ? 'border-jubilee-gold-deep bg-jubilee-gold-light/40'
                          : 'border-outline-variant'
                      }`}
                    >
                      <input
                        type="radio"
                        name="donation-amount"
                        className="accent-primary"
                        checked={!useCustom && chipPaise === paise}
                        onChange={() => {
                          setUseCustom(false);
                          setChipPaise(paise);
                        }}
                        disabled={busy}
                      />
                      <span className="text-body-md text-primary font-semibold">
                        {paise === 0 ? 'Zero (₹0)' : formatInrFromPaise(paise)}
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <label
                    className={`flex flex-col gap-2 rounded-xl border px-3 py-3 cursor-pointer ${
                      useCustom
                        ? 'border-jubilee-gold-deep bg-jubilee-gold-light/40'
                        : 'border-outline-variant'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="donation-amount"
                        className="accent-primary"
                        checked={useCustom}
                        onChange={() => setUseCustom(true)}
                        disabled={busy}
                      />
                      <span className="text-body-md text-primary font-semibold">
                        Other Amount (User Enterable Positive Amount)
                      </span>
                    </span>
                    {useCustom ? (
                      <input
                        type="number"
                        min={1}
                        max={DONATION_MAX_RUPEES}
                        step={1}
                        inputMode="numeric"
                        value={customRupees}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setCustomRupees('');
                            return;
                          }
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          setCustomRupees(String(Math.min(DONATION_MAX_RUPEES, Math.max(0, n))));
                        }}
                        disabled={busy}
                        placeholder={`Enter amount in ₹ (max ₹${DONATION_MAX_RUPEES.toLocaleString('en-IN')})`}
                        className="w-full px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary"
                      />
                    ) : null}
                  </label>
                </li>
              </ul>
              {!canPay ? (
                <p className="text-label-sm text-on-surface-variant mt-2">
                  Select ₹1,000 or more (or enter a custom amount) to continue to payment.
                </p>
              ) : null}
            </div>

            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Message (optional)
              </span>
              <textarea
                rows={3}
                maxLength={DONATION_MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface resize-y focus:outline-none focus:border-primary"
                placeholder="A short note with your gift"
              />
              <span className="text-body-sm text-on-surface-variant">
                {message.length}/{DONATION_MAX_MESSAGE}
              </span>
            </label>

            {error ? (
              <p className="rounded-lg bg-error-container text-error text-body-sm p-3">{error}</p>
            ) : null}

            {canPay && payableAmount != null ? (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="text-label-sm uppercase tracking-wider text-primary mb-2">You pay</p>
                <AmountWithFx
                  paise={payableAmount}
                  primaryClassName="text-headline-sm text-jubilee-gold-deep tabular-nums"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={busy || !causes?.length || !canPay}
                className="w-full rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {busy ? 'Opening payment…' : 'Pay with Razorpay'}
              </button>
              {bankAccount ? (
                <button
                  type="button"
                  disabled={busy || !causes?.length || !canPay}
                  onClick={() => {
                    setError('');
                    setOfflineNote('');
                    setOfflineOpen(true);
                  }}
                  className="w-full rounded-lg border border-outline-variant bg-white text-primary px-4 py-3 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Bank / UPI transfer
                </button>
              ) : null}
            </div>
            <p className="text-body-sm text-on-surface-variant text-center">
              {bankAccount
                ? 'Razorpay for instant pay · Bank / UPI for NEFT or scan-and-pay (committee verifies)'
                : 'Secure checkout via Razorpay · UPI and cards'}
            </p>
            {offlineNote ? (
              <p className="rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm p-3">
                {offlineNote}
              </p>
            ) : null}
          </form>
          {bankAccount && payableAmount != null ? (
            <OfflinePayModal
              open={offlineOpen}
              onClose={() => setOfflineOpen(false)}
              account={bankAccount}
              amountPaise={payableAmount}
              note={selectedCause?.title || 'Donation'}
              source={{ type: 'donation', causeId, message }}
              onSubmitted={(msg) => setOfflineNote(msg)}
            />
          ) : null}
      </MemberGate>
    </PortalShell>
  );
}
