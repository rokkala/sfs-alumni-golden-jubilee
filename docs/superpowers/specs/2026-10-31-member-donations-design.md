# Member donations (cause + Razorpay) — design

**Status:** Approved in conversation (2026-10-31)  
**Audience:** Verified alumni (member portal only)

## Goal

Let logged-in alumni donate to a **named cause** via Razorpay, with records for admin and a clear thank-you after payment.

## Out of scope (v1)

- Guest / public donate
- Recurring subscriptions
- Add-on donation during event registration
- Tax certificates / 80G PDFs
- Offline / cash recording (admin can mark later if needed in v2)

## Data model

### `donation_causes`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid pk | |
| title | text not null | e.g. Golden Jubilee Fund |
| description | text | short blurb on donate screen |
| active | boolean default true | inactive hidden from members |
| sort_order | int default 0 | |
| created_at / updated_at | timestamptz | |

Seed 1–3 causes (committee can edit).

### `donations`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid pk | |
| account_id | uuid fk alumni_accounts | required |
| cause_id | uuid fk donation_causes | required |
| amount_paise | int not null | ≥ 100 (₹1) |
| message | text | optional, max ~280 |
| payment_status | text | `pending` \| `paid` \| `failed` |
| razorpay_order_id | text | |
| razorpay_payment_id | text | |
| razorpay_signature | text | |
| created_at / updated_at | timestamptz | |

RLS: no anon access; service role for APIs. Members never read others’ donations via client keys.

## Member UX

- Route: `/member/donate` behind `MemberGate` (verified).
- Link from member home (and optionally portal nav).
- Flow: pick active cause → amount chips ₹500 / ₹1,000 / ₹2,500 / ₹5,000 + custom (≥ ₹1) → optional message → Pay → Razorpay Checkout → verify → success with amount, cause, payment id.
- Admins may donate if they are verified members using a non-admin payment path, **or** block admin role from paying (match event create-order: committee accounts do not pay). Prefer **same rule as events**: `role === 'admin'` cannot checkout donations (avoids mixed keys / test confusion). Committee uses a personal alumni account to donate.

## Payments

Parallel to event registration, not shared order endpoint:

1. `POST /api/donations/create-order` — auth member, validate cause + amount, insert `donations` row `pending`, create Razorpay order (`notes.donation_id`, `notes.cause_id`), store `razorpay_order_id`.
2. Client `openRazorpayCheckout` (extend description / optional `description` param).
3. `POST /api/donations/verify` — signature check, mark `paid`, store payment ids.
4. Webhook: extend existing `/api/payments/webhook` to also match `donations.razorpay_order_id` when registration unmatched (idempotent mark paid).

## Admin

- `/admin/donations` — table: date, member name/email, cause, amount, status, Razorpay payment id.
- `/admin/donation-causes` or section on same page — CRUD causes (title, description, active, sort).

## Copy / trust

- Page title: Donate  
- One sentence: support the selected cause for SFS / alumni association.  
- No tax promise in v1.

## Success criteria

- Verified member can complete a live/test Razorpay payment against an active cause.
- Admin sees the paid row.
- Zero-amount and inactive causes rejected server-side.
- Webhook or verify alone is enough to settle (either path idempotent).
