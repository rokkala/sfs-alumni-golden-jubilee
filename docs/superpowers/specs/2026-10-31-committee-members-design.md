# Committee members — maintenance + public display

**Date:** 2026-10-31  
**Status:** Approved in conversation; awaiting implementation plan  
**Approach:** Dedicated `committee_members` table + Storage photos (not linked to login accounts)

## Goal

Let verified admins maintain alumni committee people (photo and contact details) in Admin, and show the same published list on the public landing page and About the association page so visitors can look people up when needed.

## Out of scope

- Linking rows to `alumni_accounts` / admin logins  
- Per-person bios beyond role  
- Public “contact form” / messaging  
- Non-admin editors  

## Data model

Table `public.committee_members`:

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `full_name` | text not null | |
| `role` | text not null | e.g. President, Secretary |
| `email` | text not null | shown publicly |
| `batch` | integer not null | leaving / batch year |
| `phone_number` | text null | optional; shown publicly when set |
| `photo_path` | text null | Storage object path |
| `photo_url` | text null | Public or signed URL cached for display (implementation may derive from path) |
| `sort_order` | integer not null default 0 | lower first |
| `published` | boolean not null default false | only published appear on public pages |
| `created_at` / `updated_at` | timestamptz | |

- Service role only for writes (same pattern as other alumni tables).  
- Public read via Next.js API using service role, filtering `published = true`.  
- Storage bucket for committee photos (public read of objects, or signed URLs — match whatever memories use if simple; prefer a dedicated `committee-photos` bucket with public read for published assets).

## Admin — `/admin/committee`

- Listed under Committee tools in `AdminShell`.  
- List all members (published + draft), ordered by `sort_order`, then name.  
- Create / edit / delete.  
- Fields: name*, role*, email*, batch*, phone (optional), photo upload/replace/clear, sort order, published toggle.  
- Photo: image upload; store path; show preview in form.  
- No requirement that the person has a portal account.

## Public display

Shared component (e.g. `CommitteeSection`) fed by `GET /api/committee` (published only, sorted).

**Landing (`/`):** section **after the gallery** (lower page — lookup, not hero). Heading e.g. “Alumni Committee”. If zero published members, omit the section (or a one-line “Coming soon” — prefer omit).

**About (`/about-association`):** replace the placeholder “Proposed committee roles” list with the same live grid.

**Card content (public):** photo (or initials placeholder), name, role, batch, mailto link for email, tel link for phone when present.

## APIs

- `GET /api/committee` — public; published rows only.  
- `GET/POST /api/admin/committee` — admin; list / create.  
- `PATCH/DELETE /api/admin/committee/[id]` — admin; update / delete (including photo).  
- Photo upload: multipart on create/update or a small dedicated upload route; admin-gated.

## Validation

- Email format; batch as year-like integer; phone optional but if present normalize/store consistently with existing phone helpers where practical.  
- Photo: image types only; size cap aligned with memories uploads.

## Testing

- Script or API smoke: create unpublished → not on public GET; publish → appears; sort_order respected.  
- Manual: Admin CRUD + landing + about-association render.

## Success criteria

1. Admin can add a committee member with photo and required fields without creating a login.  
2. Unpublished members never appear on `/` or `/about-association`.  
3. Published members show name, role, batch, email, and phone (if set) in both places from one source of truth.
