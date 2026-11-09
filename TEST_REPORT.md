# A.max 1.2.0 — technical verification report

Date: 2026-11-09 · Build: `release/a-max-1.2.0` (53 files) · Archive: `release/a-max-1.2.0.zip` (399.5 KB)
SHA-256: `914f5621b4b4dd5a2930385c5fde9ad6e5b14bc034cadeaef85713e81b23b523`

This report only states what was actually executed. Every claim is labelled with its
evidence class:

| Label | Meaning |
|---|---|
| **E2E-jsdom** | The shipped production bundle runs inside jsdom with a mocked `chrome.*` API; real DOM events drive the real UI. |
| **Sim-content** | The shipped content scripts + service worker run in jsdom/node:vm against simulated AI-site DOMs and a simulated `chrome` API. |
| **Static** | Source/manifest/CSS assertions executed by a harness (no browser). |
| **Chromium** | Measured in the in-app Chromium (Electron 44 / Chrome 152) against the real bundle or the real CSS. |
| **Live-site** | Measured on chatgpt.com / claude.ai / chat.deepseek.com / chat.qwen.ai with an installed unpacked extension. **None of the items below are in this class.** |

---

## 1. Gates that ran on this build

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` (in `app/`) | pass, exit 0, no diagnostics |
| Production build | `npm run build` | pass — `dist/assets/index-2nkJ4kWf.js`, `index-B_ZT4P2i.css`, `dist/engine/*` (9 synced files) |
| UI / engine harness | `node verify.js` | **154/154** |
| Content-script + SW harness | `node content-verify.js` | **96/96** |
| Package | `npm run package` | pass — 53 files, 399.5 KB ZIP, SHA-256 recorded above; repacking the same tree twice produced an identical archive |
| Syntax | `node --check` on `content.js`, `i18n.js`, `history.js` | pass |
| README links | `node scripts/check-readme-links.mjs` | pass — 20 local links/images resolve |
| README screenshots | headless Chromium capture (2× DPR) | pass — 5 PNGs captured through the chrome-mocked harness |
| CI | `.github/workflows/ci.yml` | mirrors the gates above: `npm ci`, `tsc --noEmit`, `npm run build`, `git diff --exit-code -- dist app/public/engine`, `npm run verify`, link check |

The two harnesses are the only automated evidence in this report; both run the shipped
files, not test doubles of them.

---

## 2. What the harnesses cover

### 2.1 UI / engine harness — 154 checks

- Popup: brand, auto-capture (`AM_PING` → `AM_COLLECT`), title, message count, settings mirror.
- Quick export: real DOCX (OOXML ZIP, `word/document.xml`, version + author metadata), Markdown,
  PDF print host with a stored payload and searchable text, embedded-font CSP.
- Aggregation: duplicate detection dialog, keep-both, per-instance studio hand-off, scoped keys.
- Studio: renders the captured conversation, unknown role shown as unknown and flagged `partial`,
  preview equals the selection, select-all, accessible checkbox names, AI-sites overlay
  (accessible name, focus move, Escape, selection preserved), export produces a file.
- Side panel: collections list, accessible names, reorder persisted, delete, aggregate export
  order/title preserved, no runtime errors.
- Print host: renders payload, consumes the key, clears the fallback, missing-payload message.
- Engine: `AX.version = 1.2.0`, generator labels, unknown role never invented as Assistant,
  JSON/CSV/TXT/HTML/MD labels, CSV formula-injection neutralisation, HTML escaping,
  `javascript:` links dropped, `copyImage` exposed.
- Migration: legacy settings, drafts, history, templates, cached conversations, stable ids,
  corrupt entries skipped, idempotent second load, v2 wins over legacy, timestamps not fabricated.
- New capabilities (static): manifest order/host permissions, history adapters present,
  on-demand injection list, API-before-DOM ordering, global dock flag (write/read/clear),
  27px borderless trigger, fixed frosted popover, light/dark token sets, reduced motion,
  fa/en key parity, copy-as-image wiring, and **no hard-coded Persian UI literals in the
  content script**.
- Prompt Guard isolation: the popup asks the active tab for its draft scope and shows only the
  matching draft; drafts from another conversation and from another new-chat tab stay hidden and
  are counted with a link to the vault; a 1.1 URL-keyed conversation draft still appears on its
  own page, while a 1.1 URL-keyed new-chat draft never leaks into a fresh tab. The page and UI
  copies of the scope rules are compared rule-for-rule.

### 2.2 Content-script harness — 96 checks

- Dock: render, status dot, expanded/minimised, drag + persisted position, close toast,
  `AM_SHOW_DOCK` restore, disabled state refuses to show.
- Drafts: typing saves, badge message sent, dot turns teal, guard-off greys the dot and clears
  the badge.
- Prompt restore: refuses to overwrite typed text, cancel keeps both input and draft,
  confirm replaces.
- Extraction: unknown role kept, capture marked `partial`, generated title flagged and derived
  from the first user prompt.
- In-chat export menu: injection, labelled icon trigger, `aria-haspopup/expanded`,
  portal to `<body>`, `role="menu"` with 7 `menuitem`s, host theme resolution, focus on open,
  ArrowDown, Escape closes and returns focus, exactly one rendered turn exported with its role,
  menu removed after the action, copy-as-image path and toast.
- Full history: ChatGPT adapter walks parents (not abandoned branches) and sends the session
  bearer; DeepSeek adapter follows the active branch, sends the `localStorage` bearer and keeps
  reasoning text; merge keeps server-only turns, does not duplicate rendered turns, keeps
  DOM-only turns in their original slot, prefers richer DOM markdown, re-indexes; scroll
  fallback reports `dom+scroll` and picks up a lazily mounted turn.
- Dock dismissal: close writes the global flag, closed dock is gone, clearing the flag re-shows
  it in an open tab, a freshly loaded tab keeps it hidden, popup re-enable shows it again.
- Service worker: message listener, small turquoise draft dot, dot cleared, studio tab opened
  with sanitised id + tab, scoped preview URL, print payload key, download request sanitised
  (data URL only), empty download rejected.
- Draft isolation across tabs/conversations: two simulated tabs on the same `https://chatgpt.com/`
  URL receive different `tab:` scopes; a prompt typed in tab 2 is stored once under tab 2's scope
  and is absent from tab 8's scope, badge and recovery banner; both tabs keep their own prompt;
  sending in one tab clears only that tab's draft; a conversation page resolves `conv:<id>` and
  is recovered by another tab on the same conversation, never by a new-chat tab; SPA navigation
  moves a still-typed prompt once into the new conversation; 1.1 records behave as above; the
  scope resolver recognises ChatGPT, Claude, Gemini, DeepSeek, Qwen, Perplexity, Kimi and Poe
  conversation URLs and falls back to a per-tab scope for new chats.

---

## 3. Real Chromium evidence

### 3.1 Captured in this pass (in-chat export control)

`.preview/menu.html` (dev-only, excluded from the package) was served and measured in Chromium
at 800×654:

| Measurement | Result |
|---|---|
| Trigger box | 27×27 px, `border-width: 0`, `border-radius: 8px`, opacity 0.58 |
| Popover | `position: fixed`, 252 px wide, 14 px radius, `backdrop-filter: blur(18px) saturate(1.4)`, `z-index: 2147483646` |
| Popover surface | dark `rgba(16,20,24,.94)` / light `rgba(253,253,252,.94)` by host theme |
| Menu contents | 7 `menuitem`s, 32 px rows, 12.5 px labels, monospace tags |
| Horizontal overflow | 0 px |
| Portalled + clamped | yes — geometry set from the trigger rect, clamped 8 px inside the viewport, flips above/below |

**Defect found and fixed here:** the stylesheet reset `inset: auto !important`, which beat the
inline `top/left` and left the popover at its static position (end of `<body>`, y = document
height). The reset was removed and positioning now uses `setProperty(..., 'important')`.
This is the only issue in the new UI that a static check could not have caught.

Screenshots of the dark/Persian and light/English variants were reviewed: frosted surface, chip,
divider before "Add to SidePanel", legible muted tags, no clipping.

### 3.1a README screenshots (this pass)

The five images in `docs/screenshots/` were rendered from the shipped production bundle through a
temporary static server plus a `chrome.*` mock (no unpacked install), then captured with headless
Chrome 152 at `--force-device-scale-factor=2`:

| File | Surface | Result |
|---|---|---|
| `popup-export-fa-dark.png` | Popup, Persian, dark | 4/4 tabs visible and unclipped at 400 px; detected conversation and all eight formats |
| `popup-guard-fa-dark.png` | Popup → Prompt Guard, Persian, dark | active-conversation draft plus the "other drafts" link |
| `studio-en-dark.png` | Studio, English, dark | message selection and live preview, no raw ISO timestamp in the header (source line hidden) |
| `sidepanel-en-dark.png` | Side panel → Prompt vault, English, dark | three tabs fit at 400 px; saved drafts show their conversation |
| `settings-en-light.png` | Settings, English, light | all sections render, no overflow at 1040 px |

Measured after the tab-bar fix: the Persian labels have 0 px overflow and the longest English label
("Prompt Guard") keeps 7 px of slack; the previous compact tabs clipped the fourth tab at 400 px.

### 3.2 Recorded earlier for this build line (unchanged surfaces)

Captured in the previous Chromium session and still valid for the surfaces it covers
(the popup/studio bundle and engine are unchanged since; only content-script files changed):

- Window title `A.max — …`; About shows `1.2.0 (MV3)`, Arash Makki, MIT.
- Studio shows `3 / 3` selection, preview table / `<pre>` / `<code>` render, Vazirmatn loads
  from data URLs (`document.fonts.status === 'loaded'`).
- No horizontal overflow at 1000 px or 360 px viewports.
- Side panel shows its three tabs; cross-surface parity of the captured conversation.
- No console errors in popup, studio, side panel or print host.
- PNG via UI: 131,087 bytes; PNG via engine: 1350×702, 62,593 bytes, valid signature.
- DOCX via UI: 11,039 bytes, 7 OOXML parts, Persian text + code block + 4 `<w:br/>`.

---

## 4. Package facts

- Folder: `release/a-max-1.2.0` — 53 files.
- ZIP entries: `manifest.json`, `dist/`, `icons/`, `src/`, `_locales/`, `LICENSE`, `README.md`,
  `README.fa.md`.
  The two verification reports stay in the repository: they quote this archive's hash, so shipping
  them inside it would make the documented value stale as soon as they were updated.
- `app/`, `docs/`, `reference/`, `node_modules/`, `scripts/`, `.preview/` are **not** packaged
  (the packer copies an explicit allow-list).
- `src/shared/history.js` is present (22,582 bytes) and listed in `content_scripts` before
  `content.js`.
- `src/shared/draft-scope.js` is present and listed at `content_scripts[11]`, before
  `storage.js` (12) and `content.js` (18); the on-demand injection list in
  `app/src/lib/chrome.ts` matches the manifest order.
- All five version declarations agree on `1.2.0`; the packer refuses to build otherwise.
- Archive timestamps are fixed (`SOURCE_DATE_EPOCH` can override), so the same sources always
  produce the same ZIP and the recorded SHA-256 is reproducible.

---

## 5. Not verified — explicit limits

1. **Live-site capture (QA-17, BUG-03/12, QA-22).** No unpacked install in a normal Chrome
   profile was possible. ChatGPT/Claude/DeepSeek/Qwen adapters were exercised only with
   synthesised payload shapes; selectors, auth headers and virtualised lists were not hit on the
   real services. A site change can still break an adapter, and the code then falls back to DOM
   capture by design.
2. **Real Chrome surfaces (QA-31).** `chrome.sidePanel.open`, `chrome.action` popup sizing,
   `options_ui`, service-worker restart and context menus are not reachable from the harness.
   The side-panel *surface* is verified at DOM level; the Chrome *host* is not.
3. **PDF visual output (BUG-08, QA-32).** The print host and its payload are verified; the
   actual "Save as PDF" rasterisation (page breaks, Persian shaping in the PDF) was not produced
   and inspected in this pass.
4. **Long-image completeness (QA-21).** The split/`16384 px` capping logic exists and a normal
   PNG was produced, but a conversation long enough to force multi-part output was not rendered.
5. **Clipboard image write (new feature).** `navigator.clipboard.write` + `ClipboardItem` cannot
   run in jsdom; only the wiring, the `MULTI_PART` guard and the toast were tested.
6. **Real v1.1 profile upgrade (BUG-02).** Migration is verified against seeded legacy storage,
   not against a real pre-1.2 profile with user data.
7. **Accessibility audit (QA-30).** Names, focus order, Escape and a measured 6.28:1 contrast
   ratio were checked; no axe-core/WCAG 2.2 AA audit was run.
8. **Screen readers (QA-30).** ARIA attributes are asserted, but no NVDA/JAWS/VoiceOver session
   was performed.
9. **Downloads and badge on a real profile (BUG-13, QA-32).** The badge style and the download
   request are asserted; the real `chrome.downloads` write and the rendered toolbar badge were
   not observed.
10. **Real multi-tab Chrome session (Prompt Guard isolation).** The fix was exercised with two
    independent jsdom windows sharing one `chrome.storage.local` and separate `sessionStorage`
    (the browser's per-tab partition), not with ten real ChatGPT tabs in Chrome. Chrome's actual
    SPA navigation timing and session-storage restore after a crash were not observed.

---

## 6. Claim boundary

154 UI/engine checks, 96 content-script checks, the migration suite and the Chromium
measurements prove that this package builds, renders, migrates legacy data, routes every action,
produces valid DOCX/PNG/Markdown/JSON/CSV/HTML payloads, fetches full history from a
site-shaped API when one answers, degrades to DOM capture when it does not, keeps the dock
hidden across tabs until re-enabled, keeps each prompt draft attached to its own conversation or
tab instead of the last writer, and injects a working, keyboard-accessible in-chat export menu.

They do **not** prove that extraction works on a live ChatGPT/Claude/DeepSeek/Qwen page today,
that Chrome's side panel and print tab behave identically to the harness, or that the clipboard
image path succeeds on a real machine.

Treat 1.2.0 as an installable candidate for manual QA.
