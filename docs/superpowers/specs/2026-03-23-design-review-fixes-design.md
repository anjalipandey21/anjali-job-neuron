# Design Review Fixes — 2026-03-23

Spec for the 7 issues identified in the design review of 2026-03-23. Two critical layout bugs and five warnings covering accessibility, Catppuccin token hygiene, and a data rendering edge case.

---

## Fix 1 — Applications card: mobile overflow menu

**File:** `src/components/Applications.jsx`
**Severity:** Critical

### Problem
At 375px, the action column (status `<select>` + 5 buttons: Tasks, Activity, Notes, View, Remove) collides with the title and company text. The `flexShrink: 0` column is ~290px wide, leaving insufficient space for content at phone widths.

### Solution
Replace the right-side action column with a `•••` toggle button on mobile. The button opens an absolute-positioned dropdown containing the status `<select>` and all action buttons as full-width rows.

**State:** Add `overflowMenuApp` (string | null) to the Applications component — tracks which card's menu is open by `jobId`.

**Card container prerequisite:** The card `<div>` (currently `...C.card, borderLeft, transform, boxShadow`) must have `position: 'relative'` added so the absolute-positioned dropdown anchors to the card, not to a distant ancestor.

**`•••` button placement:** The button is a third sibling inside the outer flex row — i.e., a direct child of the `display: flex, alignItems: flex-start, gap: 12` container alongside the avatar div and the `flex: 1` content div. It sits at `flexShrink: 0` so it never compresses. On desktop (`!isMobile`) this slot renders the existing column layout instead.

The layout becomes:
```
outer flex row
  ├── avatar div (36px circle, flexShrink: 0)
  ├── content div (flex: 1, minWidth: 0)
  │     title + Badge row
  │     company · location · date
  │     notes (if any)
  └── [mobile]  •••  button (flexShrink: 0, position: relative)
      [desktop] action column (flexDirection: column, alignItems: flex-end, flexShrink: 0)
```

**Dropdown (mobile only):**
- `position: absolute; right: 0; top: '100%'; zIndex: 10; minWidth: 180`
- Background: `var(--bg-card)`, border: `1px solid var(--border)`, `borderRadius: 8`, `boxShadow: var(--shadow-md)`, `padding: '8px'`
- Row 1: status `<select>` (`width: '100%'`, `marginBottom: 6`)
- Row 2+: action buttons (Tasks, Activity, Notes, View ↗, Remove) each `width: '100%'`, `textAlign: 'left'`

**Close behaviour:** A fixed transparent backdrop (`position: fixed; inset: 0; zIndex: 9`) renders when any menu is open. Clicking it sets `overflowMenuApp` to null. The dropdown's z-index (10) is well below the existing modal z-indexes (1000/1001) so open modals will always cover the dropdown.

**Desktop:** No change — the existing column layout (`flexDirection: column`, `alignItems: flex-end`) is preserved when `!isMobile`.

---

## Fix 2 — Settings header banner full width

**File:** `src/components/Settings.jsx`
**Severity:** Critical

### Problem
The `<Settings>` return wraps everything in `<div style={{ maxWidth: isMobile ? undefined : 560 }}>`, including the hero banner. At 1200px the banner is capped at 560px, leaving a visible gap to the right.

### Solution
Restructure to render the banner *before* the maxWidth wrapper — matching the pattern in `Applications.jsx` and `Dashboard.jsx`:

```
<div>                          ← no maxWidth, no padding
  <div>hero banner</div>       ← full width
  <div maxWidth=560>           ← constrained content only
    ... cards and form fields
  </div>
</div>
```

The `marginBottom: '2rem'` currently on the banner div is removed; the constrained content div gains `paddingTop: '2rem'` instead (or the first card inside keeps its existing margin).

---

## Fix 3 — Hardcoded hex fallbacks in Settings

**File:** `src/components/Settings.jsx`
**Severity:** Warning

Three `var(--text-muted, #666)` / `var(--text-muted, #888)` instances (lines 85, 100, 114). The `--text-muted` token is defined for both light (`#6c6f85`) and dark (`#a6adc8`) themes in `src/lib/styles.jsx`. The fallbacks are unnecessary and diverge from the Catppuccin palette.

**Change:** Remove the `, #666` and `, #888` fallback values — use `var(--text-muted)` only.

---

## Fix 4 — Applications status select missing aria-label

**File:** `src/components/Applications.jsx`
**Severity:** Warning

The `<select>` for application status has no accessible label. Screen readers cannot identify the control.

**Change:** Add `aria-label="Application status"` to the select element. This applies to both the desktop column layout and the mobile dropdown menu introduced in Fix 1 — both render the same `<select>` so both must carry the attribute.

---

## Fix 5 — Resume file input missing aria-label

**File:** `src/components/Resume.jsx`
**Severity:** Warning

There are two hidden `<input type="file">` elements — one in the empty-state branch (~line 149) and one in the has-resume branch (~line 159). Both have `display: none` but remain in the accessibility tree.

**Change:** Add `aria-label="Upload resume file"` to **both** input elements.

---

## Fix 6 — Resume experience trailing separator

**File:** `src/components/Resume.jsx`
**Severity:** Warning

Experience entries render as `{e.company} · {e.period}`. When `e.period` is null or an empty string, this produces a trailing ` · ` with no date text.

**Change:**
```js
// Before
{e.company} · {e.period}

// After
{e.company}{e.period ? ` · ${e.period}` : ''}
```

Apply the same guard to education entries: `{e.institution}{e.period ? ` · ${e.period}` : ''}` (verify the field names at implementation time — education uses `e.degree` / `e.institution`).

---

## Fix 7 — Dashboard "Recent applications" section heading clips at 375px

**File:** `src/components/Dashboard.jsx`
**Severity:** Warning

The "Recent applications" `<p>` heading (line 148) has no overflow handling. At 375px it can clip without an ellipsis marker if the containing card flex item is constrained.

**Primary change:** Add `overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'` to the heading `<p>`.

**Fallback:** If the clip persists after the above change, also add `minWidth: 0` to the `<div style={C.card}>` parent. Apply whichever is sufficient; apply both if needed.

---

## Files Changed

| File | Fixes |
|---|---|
| `src/components/Applications.jsx` | Fix 1, Fix 4 |
| `src/components/Settings.jsx` | Fix 2, Fix 3 |
| `src/components/Resume.jsx` | Fix 5, Fix 6 |
| `src/components/Dashboard.jsx` | Fix 7 |

## Out of Scope

- No new dependencies
- No changes to Netlify functions, KV store, or auth
- No changes to `src/lib/styles.jsx` or design tokens
- ProfileSelect, Jobs, Sidebar, MainApp not affected
