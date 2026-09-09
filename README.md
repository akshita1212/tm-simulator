# Sentinel TM — Transaction Monitoring & AML Investigation Simulator

A single-file, dependency-free web application that simulates working inside a financial
institution's transaction monitoring and AML investigations department.

Open `tm-simulator.html` in any modern browser. No build step, no server, no network calls.

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

Everything lives in `tm-simulator.html`:

| Section | Contents |
|---|---|
| `<style>` | Design system — semantic tokens adapted from Apple's HIG, light/dark/increased-contrast, Dynamic Type scaling |
| Core | Utilities, currency formatting, 6 institution types, 15 monitoring rules, priorities, SLA, statuses, roles |
| `AUTHORED` | Hand-authored deep cases, each with a full ledger, KYC record, progressive-disclosure investigation actions and a written model disposition |
| Ledger composer | Turns compact case seeds into dated, balanced transaction ledgers from declarative segments |
| Case builder | Expands a seed into alert, Customer 360, counterparties, beneficiaries, relationship graph, evidence and investigation actions |
| `SEEDS` | The case library |
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
python3 -c "s=open('tm-simulator.html').read(); i=s.index('<script>')+8; j=s.rindex('</script>'); open('/tmp/_c.js','w').write(s[i:j])"
node --check /tmp/_c.js
```
