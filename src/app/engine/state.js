
/* --------------------------------------------------------------------------
   10. Case registry, state and persistence
   -------------------------------------------------------------------------- */
const CASE_INDEX = [];        /* light records for listing */
const CASE_CACHE = {};        /* id -> built case */

function registerCases(){
  AUTHORED.forEach(a => {
    const meta = AUTHORED_META[a.id] || {};
    CASE_INDEX.push({ id:a.id, kind:a.kind, level:a.level, inst:meta.inst || "retail",
      title:a.listTitle, rule:AUTHORED_RULE[a.id] || "PROFILE", outcome:a.outcome,
      priority:meta.priority || "high", src:"authored" });
  });
  SEEDS.forEach(s => {
    CASE_INDEX.push({ id:s.id, kind:s.kind, level:s.level, inst:s.inst, title:s.title,
      rule:s.rule, outcome:s.outcome, priority:s.priority ||
        (s.level >= 4 ? "critical" : s.level >= 2 ? "high" : "medium"), src:"seed" });
  });
}
function getCase(id){
  if (CASE_CACHE[id]) return CASE_CACHE[id];
  const a = AUTHORED.find(x => x.id === id);
  if (a) return (CASE_CACHE[id] = adaptAuthored(a));
  const s = SEEDS.find(x => x.id === id);
  if (s) return (CASE_CACHE[id] = buildCase(s));
  const g = GENERATED[id];
  if (g) return (CASE_CACHE[id] = buildCase(g));
  return null;
}

/* --- persistence: localStorage with an in-memory fallback ---------------- */
let MEM = {};
const store = {
  get(k){ try { const v = localStorage.getItem(k); return v == null ? MEM[k] : v; } catch(e){ return MEM[k]; } },
  set(k, v){ MEM[k] = v; try { localStorage.setItem(k, v); } catch(e){} }
};
const PKEY = "camelaml:v1";
const LEGACY_KEYS = ["sentinel:tm:v1"];
let PROG = {
  onboarded:false, inst:"retail", role:"senior", analyst:"", theme:"", textScale:1,
  completed:{},          /* caseId -> record */
  work:{},               /* caseId -> live working state */
  queue:[],              /* assigned alert records */
  genCount:0, seenTypologies:[], sessionStart:Date.now(), lastNav:"dashboard"
};
function saveProg(){
  try {
    const copy = Object.assign({}, PROG);
    copy.work = {};
    Object.keys(PROG.work).forEach(k => {
      const w = PROG.work[k];
      copy.work[k] = Object.assign({}, w, { flags: Array.from(w.flags || []), viewed: Array.from(w.viewed || []) });
    });
    /* practice cases are generated from a seed; keep the seed so they survive a reload */
    copy.generated = GENERATED;
    store.set(PKEY, JSON.stringify(copy));
  } catch(e){}
}
function loadProg(){
  try {
    let raw = store.get(PKEY);
    if (!raw) raw = LEGACY_KEYS.map(k => store.get(k)).find(Boolean);
    if (!raw) return;
    const p = JSON.parse(raw);
    const gen = p.generated || {};
    delete p.generated;
    PROG = Object.assign(PROG, p);
    Object.keys(gen).forEach(id => {
      if (GENERATED[id]) return;
      GENERATED[id] = gen[id];
      if (!CASE_INDEX.some(x => x.id === id)){
        const g = gen[id];
        CASE_INDEX.push({ id, kind:"generated", level:g.level, inst:g.inst, title:g.title, rule:g.rule,
          outcome:g.outcome, priority:g.priority, src:"generated" });
      }
    });
    Object.keys(PROG.work || {}).forEach(k => {
      const w = PROG.work[k];
      w.flags = new Set(w.flags || []);
      w.viewed = new Set(w.viewed || []);
    });
  } catch(e){}
}
function resetProg(){
  PROG = { onboarded:false, inst:"retail", role:"senior", analyst:"", theme:PROG.theme, textScale:PROG.textScale,
    completed:{}, work:{}, queue:[], genCount:0, seenTypologies:[], sessionStart:Date.now(), lastNav:"dashboard" };
  Object.keys(CASE_CACHE).forEach(k => delete CASE_CACHE[k]);
  Object.keys(GENERATED).forEach(k => delete GENERATED[k]);
  for (let i = CASE_INDEX.length - 1; i >= 0; i--) if (CASE_INDEX[i].src === "generated") CASE_INDEX.splice(i, 1);
  saveProg();
}

/* --- live working state per case ----------------------------------------- */
function newWork(caseId, opts){
  const c = getCase(caseId);
  const pr = PRIORITY[c.alert.priority] || PRIORITY.medium;
  const now = Date.now();
  const elapsed = (opts && opts.elapsedH != null ? opts.elapsedH : 0) * 3600000;
  return {
    id:caseId, status:"new", opened:false,
    assignedAt: now - elapsed,
    dueAt: now - elapsed + pr.slaH * 3600000,
    flags:new Set(), asked:[], viewed:new Set(), hints:0,
    notes:[], timeline:[], decision:null, disposition:"", sarRecommended:false,
    escalationNote:"", eddRequest:"", qa:null, report:null, startedAt:null, submittedAt:null
  };
}
function work(caseId){
  if (!PROG.work[caseId]) { PROG.work[caseId] = newWork(caseId); saveProg(); }
  return PROG.work[caseId];
}
function slaState(w){
  const now = Date.now(), left = w.dueAt - now, total = w.dueAt - w.assignedAt;
  const usedPct = clamp(1 - left/total, 0, 1);
  return { left, total, usedPct,
    label: left < 0 ? "Overdue " + durHM(left) : durHM(left) + " left",
    tone: left < 0 ? "late" : usedPct > 0.75 ? "warn" : "", overdue: left < 0 };
}

/* --- audit trail (§18) --------------------------------------------------- */
function logIt(caseId, text, kind){
  const w = work(caseId);
  const d = new Date();
  w.timeline.push({ t: d.toTimeString().slice(0,5), ts: d.getTime(), x: text, k: kind || "" });
  saveProg();
}

/* --------------------------------------------------------------------------
   11. Alert queue construction  (§6, §28)
   The queue is multi-case by design: several alerts are live at once, with
   different priorities and different amounts of SLA already consumed, so the
   analyst has to decide what to work first.
   -------------------------------------------------------------------------- */
function buildQueue(force){
  if (!force && PROG.queue && PROG.queue.length) return PROG.queue;
  const instId = PROG.inst;
  let pool = CASE_INDEX.filter(x => x.inst === instId);
  if (pool.length < 8) pool = pool.concat(CASE_INDEX.filter(x => x.inst !== instId));
  const done = PROG.completed;
  const fresh = pool.filter(x => !done[x.id]);
  const ordered = adaptiveOrder(fresh.length ? fresh : pool);
  const take = ordered.slice(0, 12);
  /* stagger how much SLA each alert has already consumed */
  const elapsed = [0, 2, 5, 9, 14, 20, 26, 33, 41, 50, 62, 74];
  PROG.queue = take.map((x, i) => {
    const pr = PRIORITY[x.priority] || PRIORITY.medium;
    const e = Math.min(elapsed[i] || 6, pr.slaH * (i === 3 ? 1.12 : 0.86));
    if (!PROG.work[x.id]) PROG.work[x.id] = newWork(x.id, { elapsedH: e });
    if (i < 3 && PROG.work[x.id].status === "new") PROG.work[x.id].status = "assigned";
    return x.id;
  });
  saveProg();
  return PROG.queue;
}
function queueRows(){
  return (PROG.queue || []).map(id => {
    const c = getCase(id), w = work(id);
    return { c, w, sla: slaState(w) };
  }).filter(r => r.c);
}
