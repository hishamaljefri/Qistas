# QISTAS frontend: design handoff

The current interface is intentionally plain: it is functional scaffolding, built so the
visual design can be replaced later (e.g. with a design produced in Claude Design) without
touching application logic.

## Layers

| Layer | Files | Contains styling? | Change when redesigning? |
|---|---|---|---|
| Design tokens | `app/globals.css` | yes: colors, radii, font (light + dark) | **yes** |
| UI primitives | `components/ui/*` (Button, Card, Field, Badge, Alert, Spinner) | yes: the only components with visual decisions | **yes** |
| Screens | `components/case/*`, `components/law/*`, `app/**/page.tsx`, `app/layout.tsx` | layout only (spacing, grid), built from primitives + token classes | layout/composition only |
| Copy (all Arabic text) | `lib/text.ts` | no | only to change wording |
| Logic | `lib/api.ts`, `lib/types.ts`, `lib/session.ts`, `hooks/*` | no | **no** |
| **Demo pages (throwaway)** | `app/(demo)/*`, `components/demo/*` | layout only | **replace freely** |

Rules that keep this swappable:
- Components use token class names only (`bg-surface`, `text-muted`, `border-line`, `bg-primary`,
  `rounded-card`, `rounded-control`), never raw colors like `#123456` or `bg-green-700`.
- No component fetches data itself except via `lib/api.ts` / `hooks/`.
- All user-facing text lives in `lib/text.ts`.

## Demo pages (throwaway, to be replaced by your own design)

These exist only to prove the features work. Delete or rewrite them freely; everything they do
goes through `lib/api.ts` and `hooks/useAuth.tsx`, which stay.

| Route | File | Feature |
|---|---|---|
| `/login`, `/register` | `app/(demo)/login`, `app/(demo)/register` | accounts (FR1, FR2) |
| `/cases` | `app/(demo)/cases/page.tsx` | My Cases list (FR12) |
| `/cases/[id]` | `app/(demo)/cases/[id]/page.tsx` + `components/demo/CaseTools.tsx`, `ClaimPanel.tsx` | view / rename / edit + re-analyze / delete (FR12), report PDF (FR13), claim draft + PDF/Word (FR10, FR13) |
| `/admin/users` | `app/(demo)/admin/users/page.tsx` | user roles and activation (FR14) |
| part of `/` | `components/demo/DocumentUpload.tsx` | upload + text extraction with OCR consent (FR4, FR5) |
| header | `components/demo/AuthNav.tsx` | login state, links, logout |

Auth logic to keep when redesigning: `useAuth()` (session, login, register, logout),
`useRequireAuth()` / `<RequireAuth>` (redirect to `/login?next=…`), automatic token refresh while
the user is active (30-minute inactivity timeout), and logout on any 401 response.

## Screens and states to design

1. **Analyze case** (`/`): form (description, gender, optional names, privacy note) → loading
   (15–90 s, needs a reassuring progress state) → error (server busy / backend down) → result.
2. **Result**: expected outcome + likelihood badge (مرتفع/متوسط/منخفض), entitlements table with
   formulas and total, missing information, analysis, facts, legal issues, recommended steps,
   cited articles (expandable text), "what was sent to the AI" (masked text), disclaimer + KB date.
3. **Law search** (`/search`): query box → result cards → empty state.
4. **Article** (`/articles/[id]`): full text, source, status badge (repealed / merged + note).
5. **Login / register**: validation errors, wrong password, deactivated account, session-expired message.
6. **My Cases**: empty state, list with likelihood / total / claim badges.
7. **Case detail**: rename, edit + re-analyze (loading), delete confirmation, download buttons,
   claim form (party details) → generating → claim preview with amounts.
8. **Document upload**: consent checkbox, extracting, consent-required error, extracted text review,
   "text looks garbled → re-read with Gemini".
9. **Admin users**: table with role select and activate/deactivate.

Constraints: Arabic, right-to-left (`dir="rtl"`), long legal text (line height matters), must
work on mobile, light and dark mode.
