# Committee members Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Admin CRUD for committee members with photos; publish the same list on `/` (after gallery) and `/about-association`.

**Architecture:** `committee_members` table + `committee-photos` Storage bucket; service-role APIs; shared `CommitteeSection` component.

**Tech Stack:** Next.js 14, Supabase (Postgres + Storage), existing AdminShell / requireVerifiedAdmin.

**Spec:** `docs/superpowers/specs/2026-10-31-committee-members-design.md`

## Global Constraints

- Fields: name*, role*, email*, batch*, phone optional, photo, sort_order, published  
- Public cards show email + phone when set  
- Omit landing/about section when zero published rows  

## Tasks

### Task 1: Migration + helpers + check script
- [x] SQL: table + storage bucket  
- [x] `lib/committee/*` validate/paths/publicUrl  
- [x] `scripts/check-committee-validate.mjs`  

### Task 2: APIs
- [x] `GET /api/committee` (published + signed/public URLs)  
- [x] Admin list/create + `[id]` patch/delete with photo upload  

### Task 3: Admin UI + public UI
- [x] `/admin/committee` + AdminShell link  
- [x] `CommitteeSection` on `/` after gallery and on `/about-association`  

### Task 4: Verify + ship
- [x] tsc + check script; commit/push; remind migration  
