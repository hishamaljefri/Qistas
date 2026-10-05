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
| Logic | `lib/api.ts`, `lib/types.ts`, `hooks/*` | no | **no** |

Rules that keep this swappable:
- Components use token class names only (`bg-surface`, `text-muted`, `border-line`, `bg-primary`,
  `rounded-card`, `rounded-control`), never raw colors like `#123456` or `bg-green-700`.
- No component fetches data itself except via `lib/api.ts` / `hooks/`.
- All user-facing text lives in `lib/text.ts`.

## Screens and states to design

1. **Analyze case** (`/`): form (description, gender, optional names, privacy note) → loading
   (15–90 s, needs a reassuring progress state) → error (server busy / backend down) → result.
2. **Result**: expected outcome + likelihood badge (مرتفع/متوسط/منخفض), entitlements table with
   formulas and total, missing information, analysis, facts, legal issues, recommended steps,
   cited articles (expandable text), "what was sent to the AI" (masked text), disclaimer + KB date.
3. **Law search** (`/search`): query box → result cards → empty state.
4. **Article** (`/articles/[id]`): full text, source, status badge (repealed / merged + note).

Constraints: Arabic, right-to-left (`dir="rtl"`), long legal text (line height matters), must
work on mobile, light and dark mode.
