# Contributing to A.max

Thanks for taking the time to help. A.max is a MIT-licensed browser extension; small, focused
contributions are easiest to review.

## Before you start

- **Bugs:** open an issue with the browser version, the site (for example `chat.deepseek.com`), what you
  expected and what happened. Screenshots are useful; **never** paste real prompts, conversation text,
  cookies or tokens.
- **Features:** open an issue first so the scope can be agreed before code is written. Features that
  need a cloud backend (accounts, sync) are out of scope by design — everything stays on the device.
- **Security problems:** report them privately to the maintainer instead of a public issue.

## Development setup

The extension loads the prebuilt UI from `dist/`, so installing needs no toolchain. To change the UI:

```bash
cd app
npm install
npm run build     # rebuilds dist/ and re-syncs src/engine/* into app/public/engine
```

Then reload the unpacked extension in `chrome://extensions`.

## Project layout

| Path | What lives there |
|---|---|
| `manifest.json` | MV3 manifest, content-script load order, host permissions |
| `src/content/content.js` | In-page adapter: dock, in-chat export button, Prompt Guard, Persian BiDi |
| `src/shared/` | Storage schema, platform rules, draft scoping, history API adapters, i18n |
| `src/engine/` | Export engine (DOCX, PDF host, PNG, ZIP, HTML/MD/JSON/CSV) |
| `src/background/service-worker.js` | Badge, downloads, context menu, side panel, message routing |
| `app/` | React 19 + Vite 7 + Tailwind 4 source for every surface (`dist/` is built from here) |
| `docs/`, `TEST_REPORT.md`, `DELIVERY_REPORT.md` | Product requirements and the honest test record |

## Rules of the codebase

1. **No user data leaves the machine.** No telemetry, no analytics, no remote endpoints.
2. **Keep `dist/` in the commit** when you change the UI — the repository must stay installable.
3. **Keep the manifest and `app/src/lib/chrome.ts` in sync.** The on-demand injection list must match
   `content_scripts[0].js` order.
4. **Do not break legacy data.** Drafts, history and settings written by 1.0/1.1 must stay readable.
5. **No hard-coded Persian UI strings in `content.js`.** Add both languages to `src/shared/i18n.js`.
6. **Report tests honestly.** Say which checks ran and on what evidence level; never describe a
   simulated check as a live-site test. `TEST_REPORT.md` explains the labels.

## Pull requests

- One topic per pull request, with a short description of the user-visible change.
- Run `npm run build` in `app/` and `npm run verify` at the repository root before pushing.
- If you touch behaviour covered by `TEST_REPORT.md`, update the report.

By contributing you agree that your contribution is licensed under the MIT License.
