# Sentinel TM — Transaction Monitoring & AML Investigation Simulator

A single-file, dependency-free web application that simulates working inside a financial
institution's transaction monitoring and AML investigations department.

Open `index.html` in any modern browser. No build step, no server, no network calls.
It is a static page, so it also deploys as-is to Vercel, Netlify or GitHub Pages with no
configuration — the file is named `index.html` so that the site root serves it.

> **This is a training simulation.** Every customer, counterparty, account number, transaction
> and document in the application is fictional. Cases marked *documented basis* take their
> control environment and typology from published enforcement actions; all names, values and
> transactions in those cases are invented, and the source is disclosed only after the
> investigation is complete.

## What it does

The user signs in as an AML Transaction Monitoring Analyst at one of six institution types,
receives a multi-case alert queue from a simulated monitoring engine, and works the alerts:

**Alert Queue → Alert triage → Customer 360 → Transaction investigation → Entity and
counterparty investigation → Evidence gathering → Customer information → Analysis →
Risk assessment → Case disposition → Escalation → QA review**

It is not a quiz. The system never states a conclusion; the analyst has to reach one.

## Structure

Everything lives in `index.html`:

| Section | Contents |
|---|---|
| `<style>` | Design system — semantic tokens adapted from Apple's HIG, light/dark/increased-contrast, Dynamic Type scaling |
| Core | Utilities, currency formatting, 6 institution types, 15 monitoring rules, priorities, SLA, statuses, roles |
| `AUTHORED` | Hand-authored deep cases, each with a full ledger, KYC record, progressive-disclosure investigation actions and a written model disposition |
| Ledger composer | Turns compact case seeds into dated, balanced transaction ledgers from declarative segments |
| Case builder | Expands a seed into alert, Customer 360, counterparties, beneficiaries, relationship graph, evidence and investigation actions |
| `SEEDS` | The case library — 92 seeds expanded by the builder, plus the 8 hand-authored cases |

### The case library

100 curated core cases, all reachable from the Training screen:

| | Count |
|---|---|
| Documented basis (derived from published enforcement actions) | 50 |
| Fictional (written for the simulator) | 50 |
| Level 1 · Junior / 2 · Analyst / 3 · Intermediate / 4 · Senior / 5 · Expert | 20 / 25 / 25 / 20 / 10 |
| Supported outcome — escalate / enhanced due diligence / close | 55 / 20 / 25 |

A quarter of the library is legitimate activity a monitoring engine cannot distinguish from
laundering without investigation — property purchases, inheritances, business sales, family
transfers, investment proceeds, education payments, seasonal trade, charitable and humanitarian
operations. Learning that **unusual is not the same as suspicious** is the point of those cases.

Beyond the core library, the generator produces unlimited practice cases from combinations of
customer profile, product, geography, transaction pattern, counterparty network, typology,
explanation and evidence.
| Engine | Adaptive case selection, QA scoring rubric, unlimited practice-case generator |
| Views | Dashboard, Alert Queue, My Investigations, Customer 360, Transaction Search, Entity Search, Case Management, Investigation Notes, Evidence & Documents, Escalations, QA Review, Performance, Training |

State persists to `localStorage` under `sentinel:tm:v1`, with an in-memory fallback.

## Design

Built against Apple Human Interface Guidelines principles: semantic colour tokens defined for
light, dark and increased-contrast contexts; system font stack with a desktop-density type
scale; colour never used alone to carry meaning (every status pairs a colour with a word or
glyph, and graph node kinds are distinguished by shape); translucent sidebar and toolbar
materials over the content layer; scroll-edge treatment instead of hard chrome borders;
progressive disclosure throughout; text scalable to 200% without truncation; responsive down
to a mobile tab-bar layout.

## Development

The file is assembled from parts during development but ships as one file. To verify the
script after editing:

```sh
python3 -c "s=open('index.html').read(); i=s.index('<script>')+8; j=s.rindex('</script>'); open('/tmp/_c.js','w').write(s[i:j])"
node --check /tmp/_c.js
```

## Deploying

The repository is a single static page with no dependencies, so any static host serves it
directly from the repository root with no build command and no framework preset:

- **Vercel** — import the repo, framework preset *Other*, leave build and output settings empty.
- **Netlify** — no build command, publish directory `.`.
- **GitHub Pages** — Settings → Pages → deploy from branch, root.
