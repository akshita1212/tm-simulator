# CamelAML

**Master AML. Think like an analyst.**

CamelAML is a web app for learning transaction monitoring and AML investigation. You work as a
transaction monitoring analyst at one of six kinds of institution. A simulated monitoring engine
gives you a queue of alerts, and you work each one through to a decision that a senior QA
reviewer then scores:

**Alert Queue → Alert triage → Customer 360 → Transactions → Entities and counterparties →
Evidence → Customer information → Analysis → Risk assessment → Disposition → Escalation →
QA review**

It is not a quiz. The app never tells you the conclusion; you have to reach it yourself.

> **This is a training simulation.** Every customer, counterparty, account number, transaction
> and document in the app is fictional. Cases with a *documented basis* take their control
> environment and typology from published enforcement actions. All names, values and
> transactions in those cases are invented, and the source is shown only after you finish.

## Running it

Requires Node.js 18 or later.

```sh
npm install
npm run dev        # development server with reload, http://localhost:5173
npm run build      # production build into dist/
npm start          # serve dist/ with the bundled Node server, http://localhost:3000
npm test           # smoke test: builds all 100 cases and renders every screen
npm run build:single   # optional: one self-contained HTML file in dist-single/
```

## What makes it an app

- **Real URLs.** Every screen has its own address, such as `/queue`,
  `/cases/DOC-104/transactions` or `/cases/DOC-104/entities/2`. Links can be shared and
  bookmarked, reloading keeps you on the same screen, and the browser's back and forward buttons
  work. The single-file build uses `#/` routes instead.
- **Installable and offline.** It is a PWA with a web app manifest and a service worker. It can
  be installed to the dock, home screen or Start menu, it runs in its own window, and it keeps
  working without a network connection.
- **Command palette.** Press ⌘K, Ctrl K or `/` to search alerts, the case library, screens and
  commands.
- **App shell.** A persistent sidebar with a workspace switcher, an account menu, deadline
  notifications, view transitions between screens, and a separate scroll position for each view.
- **Persistent progress.** Your progress is saved in the browser under `camelaml:v1`. Progress
  saved by the earlier single-file version is migrated automatically. Generated practice cases
  are saved too, so they are still there after a reload.

## Brand

| Token | Value | Use |
|---|---|---|
| Primary font | Inter (self-hosted, variable), falling back to SF Pro Display / system-ui | All text |
| Primary gold | `#C9974A` | "AML" in the wordmark, accents on dark surfaces |
| Light gold | `#E2B96F` | Highlights on dark surfaces |
| Near-black | `#111111` | "Camel" in the wordmark, primary buttons, featured cards |
| Dark background | `#0B0B0C` | Sidebar, app chrome, dark mode |
| Off-white | `#F7F6F2` | Page background |
| Secondary gray | `#8A8A87` | Secondary text on dark surfaces, tertiary text |

Some brand colours are too low in contrast for small text on light surfaces, so the tokens
include accessible variants. Gold text on off-white uses `#8C6224` (5.0:1), gold chart marks
use `#B0823A`, and secondary text uses `#66655F` (5.4:1). The pale gold `#C9974A` is used for
text only on dark surfaces, where it reaches 7.5:1. White text is never placed on gold; gold
buttons use near-black text (7.2:1). All of this is documented in `src/styles/tokens.css`.

## Project structure

```
index.html              app entry (Vite)
server.js               zero-dependency production server with SPA fallback
vercel.json             Vercel build, SPA rewrites and cache headers
vite.config.js          build config, PWA, and the camelaml-app plugin
public/brand/           logo mark, app icons, favicons, social card
src/main.js             entry: fonts, styles, app, service worker
src/styles/             tokens, base, shell, components, views
src/app/manifest.json   load order for the application scope
src/app/engine/         core data, ledger composer, case builder, state, scoring
src/app/cases/          the case library (authored, documented-basis, fictional)
src/app/ui/             icons, charts, components, views, command palette, router
scripts/smoke.mjs       headless smoke test
```

The files in `src/app` share one scope: the engine, the case library and the views call each
other directly. The `camelaml-app` Vite plugin compiles them, in the order listed in
`manifest.json`, into a single ES module. Icons come from Lucide and are imported by name, so
the bundle includes only the icons the app uses.

### The case library

The library has 100 curated core cases, all reachable from the Training screen.

| | Count |
|---|---|
| Documented basis (derived from published enforcement actions) | 50 |
| Fictional (written for the simulator) | 50 |
| Level 1 · Junior / 2 · Analyst / 3 · Intermediate / 4 · Senior / 5 · Expert | 20 / 25 / 25 / 20 / 10 |
| Supported outcome — escalate / enhanced due diligence / close | 55 / 20 / 25 |

A quarter of the library is legitimate activity that a monitoring engine cannot tell apart from
laundering without an investigation. Examples include property purchases, inheritances,
business sales, family transfers, investment proceeds, education payments, seasonal trade, and
charitable and humanitarian operations. Those cases are there to teach that **unusual is not the
same as suspicious**.

Beyond the core library, the generator produces unlimited practice cases.

## Deploying

- **Vercel**: import the repo. `vercel.json` sets the Vite build (`npm run build`), the `dist`
  output folder and the rewrites that make deep links work. No other settings are needed.
- **Any Node host** (Render, Railway, Fly.io): run `npm install && npm run build` to build,
  then `npm start` to serve. The server reads `PORT` from the environment.
- **Netlify or another static host**: set the build command to `npm run build` and the publish
  directory to `dist`, and add a rewrite from `/*` to `/index.html`.
