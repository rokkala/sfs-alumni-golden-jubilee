# Member donations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verified members donate to an admin-managed cause via Razorpay; admins can list donations and maintain causes.

**Architecture:** New `donation_causes` + `donations` tables; member `/member/donate` UI; dedicated create-order/verify APIs mirroring event payments; webhook extended to settle donations by `razorpay_order_id`.

**Tech Stack:** Next.js App Router, Supabase (service role APIs), existing Razorpay helpers (`lib/payments/*`), MemberGate / AdminShell.

**Spec:** `docs/superpowers/specs/2026-10-31-member-donations-design.md`

## Global Constraints

- Member portal only (verified `MemberGate`); no public donate.
- Admins (`role === 'admin'`) cannot complete donation checkout (same as event create-order).
- Amounts in paise; minimum ₹1 (100 paise); chips ₹500 / ₹1000 / ₹2500 / ₹5000.
- Optional message max 280 chars.
- Reuse `openRazorpayCheckout` / signature verify; do not fork a second Checkout.js loader.
- YAGNI: no recurring, no guest, no 80G PDFs.

## Review Focus

- Double-settle (verify + webhook) must stay idempotent on same payment id.
- Inactive / missing cause must 400 before Razorpay order.
- Custom amount below ₹1 or non-integer rupees rejected.
- Webhook must not mark a registration paid when order belongs to a donation (match donation table when reg missing).
- Pending donation without checkout must not appear as paid in admin.

---

### Task 1: Schema + validation helpers

**Files:**
- Create: `supabase/migrations/20261031_donations.sql`
- Create: `lib/donations/validate.ts`
- Create: `scripts/check-donation-validate.mjs`

- [ ] Write migration: `donation_causes`, `donations`, indexes on `account_id`, `cause_id`, `razorpay_order_id`, `payment_status`; enable RLS with no anon policies (service role only); seed three active causes (Golden Jubilee Fund, Student support, Association operations) with sort_order 0–2.
- [ ] Add `assertDonationAmountPaise`, `assertDonationMessage`, `DONATION_AMOUNT_CHIPS_PAISE` in `lib/donations/validate.ts`.
- [ ] Self-check script asserts min amount, chip constants, message max; run `node --experimental-strip-types scripts/check-donation-validate.mjs`.
- [ ] Commit: `Add donations schema and amount validation helpers.`

### Task 2: Mark-paid helper + donation payment APIs

**Files:**
- Create: `lib/donations/mark-paid.ts`
- Create: `app/api/donations/create-order/route.ts`
- Create: `app/api/donations/verify/route.ts`
- Modify: `app/api/payments/webhook/route.ts`
- Modify: `lib/payments/checkout-client.ts` (optional `description` on `CheckoutOrder`)

- [ ] `applyDonationPayment({ donationId, razorpay })` — set `paid`, store razorpay fields; no-op if already same `razorpay_payment_id`.
- [ ] `POST /api/donations/create-order` — `getCurrentAccount`, reject admin role, require verified member; body `{ causeId, amountPaise, message? }`; load active cause; insert pending donation; Razorpay order with notes; return CheckoutOrder shape.
- [ ] `POST /api/donations/verify` — signature + ownership; call `applyDonationPayment`.
- [ ] Webhook: if no registration for `order_id`, look up `donations` and apply donation payment.
- [ ] Allow `description` override in `openRazorpayCheckout` (default remains event copy).
- [ ] Commit: `Add donation Razorpay create-order, verify, and webhook path.`

### Task 3: Member donate screen + portal link

**Files:**
- Create: `app/api/donations/causes/route.ts` (GET active causes for members)
- Create: `app/member/donate/page.tsx`
- Modify: `app/member/page.tsx` (link/card to Donate)
- Modify: `components/portal-shell.tsx` or member nav if a durable link exists there

- [ ] GET causes: auth required; return active causes ordered by sort_order.
- [ ] Build `/member/donate` with MemberGate: cause list, chips + custom, message, Pay → create-order → checkout → verify → success state.
- [ ] Add clear CTA on member home to Donate.
- [ ] Commit: `Add member donate page with Razorpay checkout.`

### Task 4: Admin causes + donations list

**Files:**
- Create: `app/api/admin/donation-causes/route.ts` (+ `[id]` if needed)
- Create: `app/api/admin/donations/route.ts` (GET list join account + cause)
- Create: `app/admin/donations/page.tsx`
- Modify: `components/admin-shell.tsx` (Donations nav item)

- [ ] Admin CRUD for causes (create/update active + sort + copy).
- [ ] Admin read-only list of donations with filters optional (status); show paid and pending.
- [ ] Wire AdminShell link.
- [ ] Commit: `Add admin donations list and cause maintenance.`

### Task 5: Smoke + graphify

- [ ] Run `scripts/check-donation-validate.mjs` and existing payment signature check if present.
- [ ] `graphify update .`
- [ ] Note in commit or PR: apply `20261031_donations.sql` on Supabase before prod use.
- [ ] Commit only if docs/graph changed: `Refresh graph after member donations.`

---

## Execution

After plan approval, run with **subagent-driven-development** (preferred) or **executing-plans** in this workspace.
