/* CamelAML smoke test — `npm test`
   Compiles the application scope exactly as the Vite plugin does, runs it
   under a minimal DOM stub, then builds every case in the library, renders
   every screen against a sample of them, scores a submission and generates
   practice cases. Exits non-zero on the first failure. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(ROOT, "src/app");
const files = JSON.parse(readFileSync(resolve(APP, "manifest.json"), "utf8")).files;
let src = files.map(f => "/* ===== " + f + " ===== */\n" + readFileSync(resolve(APP, f), "utf8")).join("\n");
src = src.replace(/^import\s+(\w+)\s+from\s+"[^"]+\.png";$/gm, 'const $1 = "mark.png";')
         .replace(/import\.meta\.env\.MODE/g, '"test"');
src += "\nexport { CASE_INDEX, getCase, evaluateCase, work, PROG, S, buildQueue, queueRows, generateCase, viewFor, viewLogin, " +
       "submitCase, qaNarrative, INSTITUTIONS, parsePath, sectionPath, applyRoute, paletteItems, render, GENERATED, saveProg, loadProg };\n";

/* --- minimal DOM ------------------------------------------------------------ */
const el = () => ({ innerHTML:"", value:"", style:{ setProperty(){} }, classList:{ toggle(){}, add(){}, remove(){}, contains(){ return false; } },
  setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){}, hasAttribute(){ return false; }, querySelector(){ return null; },
  querySelectorAll(){ return []; }, addEventListener(){}, appendChild(){}, focus(){}, remove(){}, closest(){ return null; },
  scrollTo(){}, getBoundingClientRect(){ return { left:0, top:0, right:0, bottom:0, width:0, height:0 }; } });
const mem = {};
Object.assign(globalThis, {
  window: { addEventListener(){}, scrollTo(){}, matchMedia: () => ({ matches:false }), innerWidth:1280, innerHeight:800 },
  matchMedia: () => ({ matches:false }),
  location: { protocol:"http:", pathname:"/", hash:"" },
  history: { pushState(){}, replaceState(){} },
  localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } },
  confirm: () => false,
  document: { readyState:"complete", title:"", addEventListener(){}, createElement: el, contains: () => false,
    querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(),
    documentElement: el(), body: el(), activeElement:null }
});

const out = resolve(ROOT, "node_modules/.cache/camelaml-smoke.mjs");
mkdirSync(dirname(out), { recursive:true });
writeFileSync(out, src);
const A = await import(pathToFileURL(out).href);

let fails = 0;
const ok = (cond, msg) => { if (!cond){ fails++; console.error("  ✗ " + msg); } };
const step = (name, fn) => { try { fn(); console.log("✓ " + name); } catch (e) { fails++; console.error("✗ " + name + "\n  " + (e.stack || e)); } };

step("case library builds (100 core cases)", () => {
  const core = A.CASE_INDEX.filter(x => x.src !== "generated");
  ok(core.length === 100, "expected 100 core cases, found " + core.length);
  ok(core.filter(x => x.kind === "real").length === 50, "expected 50 documented-basis cases");
  core.forEach(x => {
    const c = A.getCase(x.id);
    ok(c && c.txns.length && c.customer && c.alert, x.id + " did not build");
    ok(c.counterparties && c.graph && c.requests, x.id + " missing investigation data");
  });
});

step("every screen renders", () => {
  A.PROG.onboarded = true; A.PROG.analyst = "Test";
  A.S.screen = "app";
  ok(A.viewLogin().includes("CamelAML"), "welcome screen");
  const views = ["dashboard","queue","mine","customer","txn","entity","cases","notes","evidence","escalations","qa","performance","training"];
  const sample = A.CASE_INDEX.filter((x, i) => i % 7 === 0).map(x => x.id);
  sample.forEach(id => {
    A.S.active = id; A.work(id);
    views.forEach(v => {
      A.S.nav = v; A.S.entityView = null;
      const h = A.viewFor(v);
      ok(typeof h === "string" && h.length > 200, v + " rendered empty for " + id);
      ok(!/undefined|NaN|\[object Object\]/.test(h.replace(/data-[a-z-]+="[^"]*"/g, "")), v + " shows undefined/NaN for " + id);
    });
    A.S.nav = "entity"; A.S.entityView = "0"; A.viewFor("entity");
    ["overview","investigate","screening","timeline","decide"].forEach(t => { A.S.tab = t; A.viewFor("cases"); });
    A.S.tab = "overview";
  });
});

step("routes round-trip", () => {
  const id = A.CASE_INDEX[3].id;
  const r = A.parsePath("/cases/" + encodeURIComponent(id) + "/entities/2");
  ok(r.nav === "entity" && r.id === id && r.entity === "2", "entity route");
  ok(A.parsePath("/investigations").nav === "mine", "investigations route");
  ok(A.parsePath("/welcome").screen === "login", "welcome route");
  ok(A.sectionPath("txn", id) === "/cases/" + encodeURIComponent(id) + "/transactions", "section path");
});

step("scoring and QA", () => {
  const id = A.CASE_INDEX[0].id, c = A.getCase(id), w = A.work(id);
  w.decision = c.outcome || "escalate";
  w.disposition = "Reviewed the alerted activity, the customer profile and the counterparties. ".repeat(6);
  const ev = A.evaluateCase(c, w);
  ok(ev && typeof ev.score === "number" && ev.score >= 0 && ev.score <= 100, "score out of range: " + (ev && ev.score));
  ok(typeof A.qaNarrative(c, ev, w) === "string", "QA narrative");
});

step("practice generator and persistence", () => {
  for (let i = 0; i < 25; i++){
    const id = A.generateCase({});
    const c = A.getCase(id);
    ok(c && c.txns.length > 0, "generated case " + id);
    A.S.active = id; A.viewFor("cases"); A.viewFor("txn");
  }
  A.saveProg();
  const saved = JSON.parse(mem["camelaml:v1"]);
  ok(Object.keys(saved.generated || {}).length >= 25, "generated seeds persisted");
});

step("command palette", () => {
  A.S.active = A.CASE_INDEX[0].id;
  ok(A.paletteItems("").length > 5, "default items");
  ok(A.paletteItems("struct").length > 0, "search items");
});

if (fails){ console.error("\n" + fails + " failure(s)"); process.exit(1); }
console.log("\nAll smoke checks passed.");
