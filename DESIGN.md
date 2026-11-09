# A.max — Design System Specification (`DESIGN.md`)

**Author & Creator:** Arash Makki  
**License:** MIT License

> **1.2.0 note:** the product surfaces are now rendered by the React application in `app/` (the
> `a-max-prd` interface). This document describes the tokens and rules that application uses, plus the
> in-page dock that lives in the content script. Implementation source of truth:
> `app/src/index.css` (tokens) and `app/src/components/ui.tsx` (primitives).

## 1. Product Identity & Purpose

**A.max** is an open-source browser utility for Persian and bilingual AI practitioners. It combines:

1. Full-fidelity conversation export (PDF, OOXML `.docx`, Markdown, PNG, JSON, TXT, HTML, CSV).
2. Zero-click prompt persistence with crash recovery.
3. Persian RTL/BiDi repair and writing normalization (ZWNJ, Arabic → Persian letters, input direction).

## 2. Design Language

Dark carbon surfaces with Persian turquoise. Flat cards, 1px hairlines, restrained radius, no decorative
gradients on page chrome; turquoise is reserved for the primary action, active state and focus ring. The
light theme is the same system inverted. The in-page dock follows the same language in a compact pill.

## 3. Color Tokens

All surfaces reference CSS variables so the theme switch is instant and the in-page tools can mirror them.

### Dark (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0F12` | Page canvas |
| `--surface` | `#111827` | Header, cards, toolbars |
| `--raised` | `#1A2229` | Inputs, chips, secondary buttons, popovers |
| `--border` | `#24313A` | 1px hairlines |
| `--text` | `#F1F5F9` | Primary text |
| `--muted` | `#94A3B8` | Metadata, helper text |
| `--primary` | `#14B8A6` | Primary CTA, active tab, focus |
| `--primary-dark` | `#0F766E` | Hover/pressed state |
| `--accent` | `#22D3EE` | Links, highlights |
| `--on-primary` | `#06201D` | Text on turquoise |
| `--success` / `--warning` / `--error` | `#10B981` / `#F59E0B` / `#EF4444` | Status |

### Light

| Token | Value |
|---|---|
| `--bg` | `#F6F8FA` |
| `--surface` | `#FFFFFF` |
| `--raised` | `#EEF2F5` |
| `--border` | `#D6E0E5` |
| `--text` | `#14232B` |
| `--muted` | `#4C6270` |
| `--primary` | `#0F766E` |
| `--accent` | `#0E7490` |

### Semantic status

Green = ready/captured, amber = partial/cached, red = failed, slate = unsupported or not a conversation.
Each status is shown as a dot plus a label — never color alone.

## 4. Typography & BiDi

- **UI / Persian body:** `Vazirmatn` (bundled subset, OFL-1.1), then `Inter`, then `system-ui`.
- **Code:** `ui-monospace, SFMono-Regular, Menlo, Consolas`, always LTR with `unicode-bidi: isolate`.
- **Base size:** 14px, line-height 1.7 for Persian; 13px controls; 11–12px metadata.
- **Direction:** `<html dir="rtl">` for Persian, `ltr` for English; numbers and file names stay LTR.
- Digits may be shown in Persian form in prose; identifiers, URLs and file names keep Latin digits.

## 5. Shape, Spacing and Elevation

- Radius scale: `8px` (chips/small controls), `10px` (buttons/inputs), `12–14px` (cards, dialogs),
  `999px` for the floating dock and status pills.
- Spacing: 4px base grid; 8/12/16px inside cards, 24–32px section gutters.
- Elevation: shadows only on floating layers (toasts, menus, dock). Pages use borders, not shadows.
- Popup is a fixed `400×600` card (`html[data-surface="popup"]`); the side panel is fluid with a
  `min-width: 300px` floor; studio and settings fill the tab.

## 6. Components

- **Buttons:** primary (turquoise fill), secondary (raised fill + border), ghost, danger. Icon buttons are
  32×32 with an `aria-label`.
- **Tabs:** compact segmented control; the active segment uses `--selected` and the primary text color.
- **Cards:** `bg-surface`, 1px border, 12px radius, 16px padding.
- **Inputs/selects:** `bg-raised`, 1px border, focus ring in `--primary`.
- **Toasts:** bottom-center floating stack, 3.8s auto-dismiss, icon + text, color-coded border.
- **Empty states:** icon, one-line title, one-line explanation, and a real action (capture / sample).
- **Export grid:** the four main formats (PDF, DOCX, MD, TXT) stay large and prominent; PNG/JSON/HTML/CSV
  sit behind “more”.

## 7. In-page controls (content script)

- **Floating dock:** fixed bottom-left pill, `rgba(11,15,18,.94)` with blur, 1px `--border`, brand dot,
  a turquoise “استودیو و خروجی” primary button and two ghost utilities (“راست‌چین”, “نیم‌فاصله”).
- **Single-message menu:** raised surface, 8px radius, menu items highlight with turquoise at 12% alpha.
- **Recovery banner:** same surface/border language; primary “بازیابی” and ghost “رد کردن”.
- The dock, menu, banner and toast use `!important` scoped rules in `theme-content.css` so host-site CSS
  cannot leak into them, and nothing else from the app stylesheet is injected into the page.

## 8. Motion & Accessibility

- Transitions are 140–180ms on color/border/shadow only; no looping animation except the loading spinner.
- Focus is always visible (turquoise ring); dialogs trap focus, close on Escape, and restore focus.
- Contrast targets WCAG AA; muted text is not used for essential information. Status is text + icon, not
  color alone. All controls are native buttons/inputs with labels.
