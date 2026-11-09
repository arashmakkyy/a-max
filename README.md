# A.max — Chrome Extension

<p>
  <a href="https://github.com/arashmakkyy/a-max/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/arashmakkyy/a-max?color=0d9488"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0d9488"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-0d9488">
  <img alt="20 AI sites" src="https://img.shields.io/badge/AI%20sites-20-0d9488">
</p>

An open-source, local-first browser extension for exporting AI conversations (PDF, Word, Markdown, PNG,
JSON, TXT, HTML, CSV), recovering prompt drafts, repairing Persian/RTL text and adding a small export
button to every reply — for ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok, Perplexity, Kimi, Poe,
Copilot and more.

**Version:** 1.2.0 — **Author:** Arash Makki — **License:** MIT  
**UI:** React + Vite, Persian RTL by default with an English option.

> **Release status:** installable development build, not a verified public-production release.
> Read [TEST_REPORT.md](./TEST_REPORT.md) for the checks that were actually run and the ones still open,
> and [DELIVERY_REPORT.md](./DELIVERY_REPORT.md) for the item-by-item delivery status (Persian).
> Neither report is included in the installable ZIP.

## Installation / نصب

**From a release (no build):** download `a-max-1.2.0.zip` from the
[latest release](https://github.com/arashmakkyy/a-max/releases/latest). It contains a single folder named
`a-max-<version>` (for example `a-max-1.2.0`).

**From a clone (no build either — `dist/` is committed):** use the folder that contains `manifest.json`.

1. Extract the ZIP archive (or clone this repository).
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the extracted **`a-max-<version>` folder** (the folder containing `manifest.json`).
5. Open a supported AI chat page, reload it once, and click A.max's icon.

The extension loads the prebuilt UI from `dist/`, which is included in the package, so **no build step is needed to install**.

## Rebuilding the UI / ساخت دوبارهٔ رابط کاربری

The interface lives in `app/` (React 19 + Vite 7 + Tailwind 4) and is built into `dist/`:

```bash
cd app
npm install
npm run build
```

`npm run build` runs `scripts/sync-engine.mjs` first, which copies the shared export engine
(`src/engine/*.js` + `src/shared/engine-bridge.js`) into `app/public/engine` so extension pages and the
content script always use the same code. The build emits `dist/index.html`, `dist/assets/*`, `dist/engine/*`
and `dist/fonts/*`. One page serves every entry point through the hash/query:
`#popup`, `#studio`, `#sidepanel`, `#settings` (or `?surface=...`).

## Features in this build

- **New UI everywhere:** popup, preview studio, side panel, settings page and the in-page dock all use the
  React interface (dark carbon/turquoise theme, Persian RTL, 400×600 popup card).
- **Live capture:** popup and side panel read the conversation of the active tab on open; the studio can
  re-capture the tab it was opened from, or receive a fresh capture from the on-page dock.
- **Whole conversation, even before you scroll:** for ChatGPT, Claude, DeepSeek and Qwen the capture asks the
  site's own authenticated API for the full message tree, merges it with what the page has already rendered
  (so code blocks and images survive), and only then walks a virtualised list to force lazy turns to mount.
  If the API refuses, capture silently falls back to the page.
- **In-chat export menu:** every reply gets a 27px icon in its action bar that opens a theme-aware popover with
  PDF, Word, Markdown, PNG, "copy as image", copy Markdown and add-to-SidePanel — keyboard and screen-reader
  friendly, portalled so the message container can never clip it.
- **Eight export formats:** PDF, real OOXML `.docx`, Markdown, PNG (long image, split into a ZIP when
  needed), JSON, TXT, HTML and CSV — plus copy-as-Markdown / TXT / JSON.
- **PDF is searchable:** it prints the vector HTML document through `src/print/print.html`; choose
  “Save as PDF” in the print dialog.
- **Self-hosted Vazirmatn** (`app/public/fonts`, OFL-1.1) — the UI and the print page work offline.
- **Prompt Guard, Persian BiDi repair, floating dock and single-message export** are wired to the shared
  settings record, so the React settings screen and the in-page tools stay in sync.
- **Every prompt draft stays with its own conversation or tab:** an open conversation is keyed by its
  conversation id (ChatGPT/Claude/Gemini/DeepSeek/Qwen/Kimi/Poe/…), while a brand-new chat is keyed by a
  per-tab id kept in `sessionStorage`. Ten tabs on the same “new chat” URL can no longer overwrite or display
  each other's prompt; the guard shows only the active tab's draft and offers a link to the other drafts in
  the vault.
- **Dock dismissal is global:** closing the dock with × hides it in every tab — including tabs opened later —
  until you press “show dock” in the popup.
- **Local-first storage:** settings, snapshots, collections, drafts, history and templates live in
  `chrome.storage.local` (`amtool:v2:*`). A mirror of the shared switches is written to the legacy
  `am_tool_settings_v1` record so the content script keeps working.

## Known limitations / محدودیت‌ها

- Real-site capture is implemented for the supported platforms but has **not** been certified on all of them;
  DOM changes on a host site can still break extraction.
- The full-history adapters were verified against simulated API payloads only; a real ChatGPT/Claude/DeepSeek/Qwen
  session was not available in this environment. Copy-as-image likewise was not exercised with a real clipboard.
- The extension has not yet been run as an unpacked build inside a real Chrome profile in this environment;
  the production bundle, capture contracts, downloads and print payload were verified in a DOM harness and
  in Chromium (see TEST_REPORT.md).
- Very long conversations are split across several PNG pages and downloaded as a ZIP.
- A draft typed in a **new chat that was never sent** is tied to that tab (it survives reload and Chrome's
  session restore). If the tab is closed before the site assigns a conversation id, the draft remains in the
  Prompt vault instead of being auto-restored on a different tab.
- Vazirmatn is bundled as a subset; exotic glyphs fall back to system fonts.
- Formatting parity for complex tables, math and images should be checked per site and per format.

## Security and privacy

No account or cloud backend is involved. Captures, drafts and settings stay in extension storage on this
machine. The exported HTML is sanitized and served with a restrictive CSP; the print host embeds only the
bundled font as a data URL. Do not use unverified builds with confidential prompts without your own review.

## References

- [Original PRD supplied for this redesign](./docs/PRD-Concept-1.md)
- [TEST_REPORT.md](./TEST_REPORT.md) (repository only)
- [DELIVERY_REPORT.md](./DELIVERY_REPORT.md) (repository only)
- [License](./LICENSE)

## Contributing

Bug reports and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please do not
paste real conversation content, tokens or cookies into an issue.

## License

MIT © 2026 [Arash Makki](https://github.com/arashmakkyy). The bundled Vazirmatn font is licensed under
OFL-1.1; see `app/public/fonts`.
