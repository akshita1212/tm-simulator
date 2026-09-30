
/* --------------------------------------------------------------------------
   12. Adaptive engine  (§24)
   -------------------------------------------------------------------------- */
function completedList(){ return Object.keys(PROG.completed).map(k => PROG.completed[k]); }

function weakness(){
  const done = completedList();
  const missFlag = {}, missTyp = {}, seenTyp = {};
  let esc = 0, cls = 0, edd = 0, wrongEsc = 0, wrongCls = 0, n = done.length, scoreSum = 0, overReq = 0;
  done.forEach(r => {
    (r.missedFlags || []).forEach(k => missFlag[k] = (missFlag[k]||0) + 1);
    (r.typology || []).forEach(t => { seenTyp[t] = (seenTyp[t]||0)+1; if (!r.typologyHit) missTyp[t] = (missTyp[t]||0)+1; });
    if (r.decision === "escalate") esc++; if (r.decision === "close") cls++; if (r.decision === "edd") edd++;
    if (r.decision === "escalate" && r.outcome === "close") wrongEsc++;
    if (r.decision === "close" && r.outcome === "escalate") wrongCls++;
    scoreSum += r.score || 0;
    overReq += (r.unnecessary || 0);
  });
  return { n, missFlag, missTyp, seenTyp, esc, cls, edd, wrongEsc, wrongCls,
    avg: n ? scoreSum/n : 0, overReqAvg: n ? overReq/n : 0,
    escRate: n ? esc/n : 0, clsRate: n ? cls/n : 0,
    topMissed: Object.keys(missFlag).sort((a,b)=>missFlag[b]-missFlag[a]).slice(0,4) };
}

function adviceLine(){
  const w = weakness();
  if (!w.n) return "Your first cases are drawn across typologies and difficulty levels. The queue adapts once you have completed a few investigations.";
  if (w.wrongCls >= 2) return "You have closed " + w.wrongCls + " cases where the evidence supported escalation. The queue is now weighted toward cases where the indicators are present but understated.";
  if (w.wrongEsc >= 2) return "You have escalated " + w.wrongEsc + " cases that were reasonably explained. The queue is now weighted toward legitimate-but-unusual activity, so that unusual and suspicious stay distinct.";
  if (w.overReqAvg > 2.5) return "You are averaging " + w.overReqAvg.toFixed(1) + " information requests per case that did not bear on the outcome. Upcoming cases reward a narrower, evidence-led investigation.";
  if (w.topMissed.length) return "Indicators you have most often missed: " + w.topMissed.map(k => FLAG_LABEL[k] || k).join(", ") + ". The queue is weighted toward cases where those indicators are decisive.";
  if (w.avg >= 78) return "Your average is " + Math.round(w.avg) + "/100. The queue is moving toward higher-complexity cases with competing explanations.";
  return "Working across typologies. The queue adjusts as patterns appear in your results.";
}

const FLAG_LABEL = {
  structuring:"structuring below thresholds", passthrough:"pass-through behaviour", unrelated:"unrelated counterparties",
  newbene:"newly added beneficiaries", profile:"profile inconsistency", dormant:"dormancy and reactivation",
  thirdparty:"third-party account use", network:"network and device linkage", explanation:"contradicted explanations",
  cash:"cash intensity", volume:"volume step-change", docs:"documentary inconsistency", geo:"geographic risk",
  shell:"shell and nominee structures", sow:"unevidenced source of wealth", rapid:"rapid movement",
  round:"round-value patterns", circular:"circular flows", mixer:"virtual-asset obfuscation",
  nesting:"correspondent nesting", vulnerable:"customer vulnerability", records:"missing records",
  fop:"free-of-payment settlement", norisk:"absence of economic risk", staleKyc:"stale customer profile"
};

/* order the candidate pool by what the analyst most needs to see next */
function adaptiveOrder(pool){
  const w = weakness();
  const scored = pool.map(x => {
    let s = Math.random() * 0.9;
    if (w.n){
      const targetLevel = w.avg >= 82 ? 5 : w.avg >= 72 ? 4 : w.avg >= 60 ? 3 : w.avg >= 45 ? 2 : 1;
      s += 2.2 - Math.abs(x.level - targetLevel) * 0.7;
      if (w.wrongCls >= 2 && x.outcome === "escalate") s += 1.4;
      if (w.wrongEsc >= 2 && x.outcome === "close") s += 1.8;
      if (w.escRate > 0.75 && x.outcome !== "escalate") s += 1.2;
      if (w.clsRate > 0.6 && x.outcome === "escalate") s += 1.2;
    } else {
      s += x.level <= 2 ? 1.6 : x.level === 3 ? 0.6 : 0;
    }
    return { x, s };
  });
  scored.sort((a,b) => b.s - a.s);
  /* keep a spread of priorities in the queue rather than 12 criticals */
  const out = [], byPr = { critical:0, high:0, medium:0, low:0 };
  scored.forEach(({x}) => {
    const cap = { critical:3, high:5, medium:5, low:3 }[x.priority] || 4;
    if (byPr[x.priority] < cap){ out.push(x); byPr[x.priority]++; }
  });
  scored.forEach(({x}) => { if (out.indexOf(x) < 0) out.push(x); });
  return out;
}

/* --------------------------------------------------------------------------
   13. Scoring and QA review  (§20, §25, §33)
   -------------------------------------------------------------------------- */
const STOP = new Set(("the a an and or of to in on for with by from is are was were be been that this those these it its as at " +
  "not no than then them they their our your you we he she his her which who whom whose into over under about across within " +
  "without have has had do does did but if when while there here also more most some any all such very can could would should").split(" "));
function tokens(s){ return String(s).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w => w.length > 4 && !STOP.has(w)); }

function matchesFlag(text, flag){
  const t = " " + text.toLowerCase() + " ";
  const key = (FLAG_LABEL[flag.k] || flag.k).toLowerCase();
  if (t.indexOf(key.split(" ")[0]) >= 0 && key.split(" ")[0].length > 4) return true;
  const words = uniq(tokens(flag.t)).filter(w => w.length > 5);
  if (!words.length) return false;
  let hit = 0; words.forEach(w => { if (t.indexOf(w) >= 0) hit++; });
  return hit / words.length >= 0.28 || hit >= 3;
}

const ASSUMPTION_PATTERNS = [
  { re:/\b(is|are)\s+(money laundering|laundering money|a criminal|criminals|guilty)\b/i, t:"States a conclusion of criminality. The analyst records suspicion and escalates; guilt is not an analyst determination." },
  { re:/\b(definitely|certainly|obviously|clearly proves|proves that|without doubt|no doubt)\b/i, t:"Uses absolute language where the evidence supports a qualified statement." },
  { re:/\bconfirmed (sanctions )?match\b/i, t:"Describes a match as confirmed. Check whether the Sanctions Team actually confirmed it." },
  { re:/\b(criminal|drug|terrorist|trafficking) (proceeds|funds|money)\b/i, t:"Characterises the funds as proceeds of a specific crime. State what the evidence shows and identify the typology as potential." },
  { re:/\bthe customer is (a )?(mule|launderer|fraudster|criminal)\b/i, t:"Labels the customer. Describe the account behaviour instead." }
];
const QUALITY_TERMS = ["counterparty","beneficiary","typology","source of funds","source of wealth","expected activity",
  "profile","threshold","review period","pass-through","structuring","escalat","enhanced due diligence","screening",
  "corroborat","reconcil","inconsistent","documentation","evidence","rationale","baseline","materiality"];

function evaluateCase(c, w){
  const disp = w.disposition || "";
  const notesText = (w.notes || []).map(n => n.body).join(" ");
  const all = disp + " " + notesText;
  const D = {};

  /* 1. transaction analysis --------------------------------------------- */
  const flagged = Array.from(w.flags || []);
  const key = c.keyTxn || [];
  const hit = flagged.filter(id => key.indexOf(id) >= 0).length;
  const recall = key.length ? hit / key.length : (flagged.length ? 0.5 : 0);
  const precision = flagged.length ? hit / flagged.length : 0;
  const covered = w.viewed && w.viewed.has("txn") ? 1 : 0.55;
  D.txn = clamp((recall * 0.62 + precision * 0.24 + covered * 0.14) * 100, 0, 100);

  /* 2. red flags --------------------------------------------------------- */
  const found = (c.flags || []).filter(f => matchesFlag(all, f));
  const missed = (c.flags || []).filter(f => found.indexOf(f) < 0);
  D.flags = c.flags && c.flags.length ? (found.length / c.flags.length) * 100 : 60;

  /* 3. typology ---------------------------------------------------------- */
  const typHit = (c.typology || []).some(t => {
    const words = tokens(t);
    return words.length && words.filter(x => all.toLowerCase().indexOf(x) >= 0).length / words.length >= 0.4;
  });
  const noTypNeeded = c.outcome === "close";
  D.typ = typHit ? 100 : (noTypNeeded && /no (money laundering )?typolog|not indicat|reasonably explained/i.test(all) ? 92 : 26);

  /* 4. investigation coverage -------------------------------------------- */
  const askedIds = (w.asked || []).map(a => a.id);
  const keyReq = c.keyReq || [];
  const keyHit = keyReq.filter(k => askedIds.indexOf(k) >= 0).length;
  const unnecessary = Math.max(0, askedIds.length - keyHit - 2);
  D.inv = clamp((keyReq.length ? keyHit / keyReq.length : 0.6) * 100 - unnecessary * 5, 0, 100);

  /* 5. evidence handling ------------------------------------------------- */
  let ev = 0;
  if (askedIds.indexOf("sanc") >= 0) ev += 22;
  if (askedIds.indexOf("media") >= 0) ev += 22;
  if (askedIds.indexOf("sofsow") >= 0 || askedIds.indexOf("proof") >= 0) ev += 26;
  if (w.viewed && w.viewed.has("docs")) ev += 16;
  if (w.viewed && w.viewed.has("entities")) ev += 14;
  if (c.sanctions.kind === "potential" && /potential match|not (a )?confirmed|cannot be treated as confirmed/i.test(all)) ev = Math.min(100, ev + 12);
  if (c.media.kind === "unconfirmed" && /uncorroborat|unconfirmed|not evidence|requires? (further )?investigation/i.test(all)) ev = Math.min(100, ev + 12);
  D.ev = clamp(ev, 0, 100);

  /* 6. decision ---------------------------------------------------------- */
  const dec = w.decision;
  const rank = { close:0, edd:1, escalate:2 };
  const dist = Math.abs((rank[dec] != null ? rank[dec] : 1) - rank[c.outcome]);
  D.dec = dec === c.outcome ? 100 : dist === 1 ? 55 : 12;

  /* 7. disposition writing ------------------------------------------------ */
  const words = disp.trim() ? disp.trim().split(/\s+/).length : 0;
  let dq = 0;
  dq += clamp(words / 260, 0, 1) * 30;
  const terms = QUALITY_TERMS.filter(t => disp.toLowerCase().indexOf(t) >= 0).length;
  dq += clamp(terms / 9, 0, 1) * 24;
  const structure = [/alert|rule|trigger/i, /profile|customer|occupation|expected/i, /transaction|credit|debit|counterpart/i,
    /explanation|customer (stated|said)|account given/i, /evidence|document|corroborat|statement/i,
    /recommend|escalat|clos|enhanced due diligence/i];
  dq += (structure.filter(re => re.test(disp)).length / structure.length) * 30;
  const assumptions = ASSUMPTION_PATTERNS.filter(p => p.re.test(disp));
  dq -= assumptions.length * 9;
  if (/contradict|inconsistent with|does not reconcile|not supported by/i.test(disp)) dq += 8;
  if (/however|although|on the other hand|against that/i.test(disp)) dq += 8;
  D.disp = clamp(dq, 0, 100);

  /* 8. documentation ------------------------------------------------------ */
  const noteKinds = uniq((w.notes||[]).map(n => n.kind)).length;
  let doc = clamp((w.notes||[]).length / 5, 0, 1) * 44 + clamp(noteKinds / 5, 0, 1) * 34;
  doc += clamp((w.timeline||[]).length / 14, 0, 1) * 22;
  D.doc = clamp(doc, 0, 100);

  const dims = [
    { k:"txn",   label:"Transaction analysis",            wgt:16, v:D.txn },
    { k:"flags", label:"Red-flag identification",         wgt:16, v:D.flags },
    { k:"typ",   label:"Typology identification",         wgt:11, v:D.typ },
    { k:"inv",   label:"Investigation quality and scope", wgt:13, v:D.inv },
    { k:"ev",    label:"Evidence and screening handling", wgt:11, v:D.ev },
    { k:"dec",   label:"Decision quality",                wgt:17, v:D.dec },
    { k:"disp",  label:"Disposition writing",             wgt:11, v:D.disp },
    { k:"doc",   label:"Documentation and audit trail",   wgt:5,  v:D.doc }
  ];
  const score = Math.round(sum(dims, d => d.v * d.wgt) / sum(dims, d => d.wgt));

  /* traps the analyst fell into */
  const trapsHit = (c.traps || []).filter(t => {
    const words = tokens(t.t).slice(0,6);
    return words.length && words.filter(x => disp.toLowerCase().indexOf(x) >= 0).length >= Math.ceil(words.length*0.5)
      && !/discount|not (itself |in itself )?suspicious|ordinary|expected|consistent with/i.test(disp);
  });

  const critical = [];
  if (dec === "close" && c.outcome === "escalate") critical.push("Case closed where the evidence supported escalation. On these facts the activity remained unexplained and reportable.");
  if (dec === "escalate" && c.outcome === "close") critical.push("Case escalated where the activity was reasonably explained and independently corroborated. Escalating explained activity consumes MLRO capacity and, at scale, degrades the value of reporting.");
  if (c.sanctions.kind === "potential" && /confirmed (sanctions )?match/i.test(disp)) critical.push("A potential sanctions match was described as confirmed. The Sanctions Team owns that determination.");
  if (assumptions.length) assumptions.forEach(a => critical.push(a.t));
  if (!disp.trim()) critical.push("No written disposition was provided. The written record is the deliverable; an undocumented decision cannot be reviewed, audited or relied on.");
  if (askedIds.indexOf("explain") < 0 && c.outcome !== "close" && ROLES[PROG.role].can.requestCustomer)
    critical.push("The customer's own account of the activity was never sought, so the explanation was never tested.");

  const strengths = [];
  if (D.txn >= 75) strengths.push("Transaction selection was accurate — the movements you flagged are the ones that carry the case.");
  if (D.flags >= 75) strengths.push("Most of the indicators present were identified and articulated.");
  if (D.inv >= 78) strengths.push("Investigation was well targeted: the actions taken bore on the outcome.");
  if (D.disp >= 72) strengths.push("The disposition is structured, evidence-led and appropriately qualified.");
  if (dec === c.outcome) strengths.push("Decision matches the risk-based outcome supported by the evidence.");
  if (D.ev >= 75) strengths.push("Screening and evidence were handled properly, including the distinction between information and proof.");
  if (!strengths.length) strengths.push("You reached a decision and recorded it, which is where every investigation has to start.");

  const verdict = score >= 75 ? "Pass" : score >= 60 ? "Borderline" : "Fail";
  const learn = missed.length ? (FLAG_LABEL[missed[0].k] || missed[0].k)
    : D.disp < 60 ? "disposition writing and evidence-led reasoning"
    : D.inv < 60 ? "targeting the investigation" : "maintaining accuracy at higher complexity";

  return { score, verdict, dims, found, missed, typHit, unnecessary, critical, strengths, trapsHit, learn,
    keyHit, keyReqTotal: keyReq.length, askedCount: askedIds.length, words };
}

function qaNarrative(c, ev, w){
  const P = [];
  P.push("Reviewed: " + c.alert.ref + " — " + c.title + ". Analyst decision: " + (OUTCOME_NAME[w.decision] || "none recorded") +
    ". Risk-based outcome supported by the evidence: " + OUTCOME_NAME[c.outcome] + ".");
  if (ev.critical.length) P.push("Critical findings. " + ev.critical.join(" "));
  else P.push("No critical findings. The investigation reached a defensible position on the evidence gathered.");
  P.push("Coverage. " + ev.keyHit + " of " + ev.keyReqTotal + " material investigation steps were taken, from " +
    ev.askedCount + " actions in total" + (ev.unnecessary > 0 ? ", of which approximately " + ev.unnecessary +
    " did not bear on the outcome. Investigative effort is finite and unnecessary requests delay other cases in the queue." : ".") );
  if (ev.missed.length) P.push("Indicators not addressed. " + ev.missed.map(f => f.t).join(". ") + ".");
  if (ev.trapsHit.length) P.push("Points treated as indicators that should have been discounted. " + ev.trapsHit.map(t => t.t).join(" "));
  P.push("Documentation. " + (ev.words ? "The disposition runs to " + ev.words + " words. " : "No disposition was written. ") +
    "The record should let a reader who has never seen the account understand what was reviewed, what was found, what the customer said, what the evidence showed and why the decision follows.");
  P.push("Strengths. " + ev.strengths.join(" "));
  P.push("Recommended focus. " + ev.learn + ".");
  return P.join("\n\n");
}

/* --------------------------------------------------------------------------
   14. Unlimited case generator  (§22)
   -------------------------------------------------------------------------- */
const GENERATED = {};
const GEN_PATTERNS = [
  { p:"structuring", rule:"STRUCT", typ:["Structuring","Cash placement below reporting thresholds"], out:"escalate",
    flow:(r,t)=>[{t:"in",n:rInt(r,10,20),lo:Math.round(t*0.84),hi:Math.round(t*0.985),m:"Cash",cp:"@sites",ch:"Branch counter",desc:"Cash deposit",days:rInt(r,14,26)},
                 {t:"sweep",ratio:0.92,parts:rInt(r,1,3),to:"@entities",m:"Transfer",ch:"Internet banking",desc:"Transfer"}] },
  { p:"funnel", rule:"FUNNEL", typ:["Funnel account","Money mule network"], out:"escalate",
    flow:(r,t)=>[{t:"in",n:rInt(r,14,26),lo:Math.round(t*0.12),hi:Math.round(t*0.42),m:"Instant payment",cp:"@people",ch:"Mobile",desc:"Payment received",days:rInt(r,9,18)},
                 {t:"sweep",ratio:0.95,parts:2,to:"@entities",m:"Transfer",ch:"Mobile",desc:"Onward transfer"}] },
  { p:"passthrough", rule:"PASSTHRU", typ:["Pass-through account","Layering"], out:"escalate",
    flow:(r,t)=>[{t:"pair",n:rInt(r,6,12),lo:Math.round(t*0.5),hi:t*2,m:"Wire",cp:"@entities",to:"@entities",lag:0,keep:0.03,ch:"SWIFT",desc:"Wire",days:rInt(r,10,20)}] },
  { p:"rapid", rule:"RAPID", typ:["Rapid movement of funds","Layering"], out:"escalate",
    flow:(r,t)=>[{t:"single",dir:"C",lo:t*8,hi:t*16,m:"Wire in",cp:"@entities",ch:"SWIFT",desc:"Incoming wire"},
                 {t:"out",n:rInt(r,4,8),lo:t,hi:t*3,m:"Wire out",cp:"@entities",ch:"SWIFT",desc:"Outgoing wire",days:4}] },
  { p:"dormant", rule:"DORMANT", typ:["Dormant account reactivation","Possible account takeover"], out:"escalate",
    flow:(r,t)=>[{t:"in",n:1,exact:Math.round(t*0.05),m:"Interest",cp:"INTEREST CREDIT",ch:"System",desc:"Interest"},
                 {t:"gap",days:rInt(r,300,700)},
                 {t:"out",n:rInt(r,5,10),lo:Math.round(t*0.8),hi:Math.round(t*0.99),m:"Faster Payment",cp:"@people",ch:"Internet banking",desc:"Payment",days:rInt(r,5,12)}] },
  { p:"geo", rule:"GEO", typ:["Higher-risk jurisdiction exposure","Cross-border layering"], out:"escalate",
    flow:(r,t)=>[{t:"in",n:rInt(r,5,10),lo:t,hi:t*4,m:"SWIFT",cp:"@entities",cc:["AE","TR","CY","PA","HK"],ch:"SWIFT",desc:"Incoming",days:rInt(r,12,24)},
                 {t:"out",n:rInt(r,4,9),lo:t,hi:t*3,m:"SWIFT",cp:"@entities",cc:["AE","HK","VG"],ch:"SWIFT",desc:"Outgoing",days:rInt(r,12,22)}] },
  { p:"circular", rule:"CIRCULAR", typ:["Circular fund flow","Related-party layering"], out:"edd",
    flow:(r,t)=>[{t:"cycle",cycles:rInt(r,3,5),n:3,lo:t,hi:t*2,m:"Transfer",cp:"@entities",to:"@entities",ratio:0.98,every:rInt(r,12,25),ch:"Internet banking",desc:"Inter-company"}] },
  { p:"round", rule:"ROUND", typ:["Round-value transaction clustering"], out:"edd",
    flow:(r,t)=>[{t:"in",n:rInt(r,8,15),lo:t,hi:t*3,round:Math.round(t/2)*2,m:"Transfer",cp:"@entities",ch:"Internet banking",desc:"Payment received",days:rInt(r,16,28)},
                 {t:"out",n:rInt(r,4,8),lo:t,hi:t*4,round:Math.round(t/2)*2,m:"Transfer",cp:"@entities",ch:"Internet banking",desc:"Payment",days:rInt(r,16,26)}] },
  { p:"crypto", rule:"CRYPTO", typ:["Virtual-asset layering"], out:"edd",
    flow:(r,t)=>[{t:"out",n:rInt(r,5,10),lo:t,hi:t*4,m:"SEPA out",cp:"@entities",ch:"SEPA",desc:"Virtual asset purchase",days:rInt(r,14,24)},
                 {t:"in",n:rInt(r,6,12),lo:t,hi:t*4,m:"SEPA in",cp:"@entities",cc:["SC","EE","LT","VG"],ch:"SEPA",desc:"Sale proceeds",days:rInt(r,14,24)}] },
  { p:"profile", rule:"PROFILE", typ:["Activity inconsistent with profile"], out:"edd",
    flow:(r,t)=>[{t:"in",n:rInt(r,10,20),lo:t,hi:t*5,m:"Transfer",cp:"@people",ch:"Mobile",desc:"Payment received",days:rInt(r,18,28)},
                 {t:"out",n:rInt(r,5,10),lo:t,hi:t*4,m:"Transfer",cp:"@entities",ch:"Mobile",desc:"Payment",days:rInt(r,16,26)}] },
  { p:"legitimate", rule:"VELOCITY", typ:["None indicated — activity is explained and evidenced"], out:"close",
    flow:(r,t)=>[{t:"in",n:rInt(r,3,6),lo:t,hi:t*2,m:"Transfer",cp:"@entities",ch:"Internet banking",desc:"Receipt",days:rInt(r,10,20)},
                 {t:"single",dir:"C",lo:t*10,hi:t*24,m:"Transfer",cp:"SOLICITOR CLIENT ACCOUNT",ch:"Internet banking",desc:"Completion proceeds"},
                 {t:"out",n:1,lo:t*9,hi:t*20,m:"Transfer",cp:"INVESTMENT PLATFORM — CLIENT MONEY",ch:"Internet banking",desc:"Investment"}] }
];
const GEN_OCC = ["Restaurant owner","Taxi operator","Freelance designer","Care worker","Property landlord","Pharmacist",
  "Construction contractor","Import agent","Online retailer","Logistics coordinator","Beautician","Music teacher",
  "Insurance broker","Dental practice owner","Software contractor","Wholesale grocer","Travel agent","Fitness studio owner"];

function generateCase(opts){
  opts = opts || {};
  PROG.genCount++;
  const id = "GEN-" + String(PROG.genCount).padStart(4, "0") + "-" + Date.now().toString(36).slice(-4);
  const rnd = seedRand(id);
  const instId = opts.inst || PROG.inst;
  const I = inst(instId), ccy = I.ccy;
  const level = opts.level || rInt(rnd, 1, 5);
  let pats = GEN_PATTERNS.slice();
  if (opts.pattern) pats = pats.filter(p => p.p === opts.pattern);
  if (opts.outcome) pats = pats.filter(p => p.out === opts.outcome);
  if (!pats.length) pats = GEN_PATTERNS.slice();
  const P = rPick(rnd, pats);
  const unit = ccy === "INR" ? rInt(rnd, 9000, 46000) : ccy === "USD" || ccy === "GBP" || ccy === "EUR" ? rInt(rnd, 900, 4600) : rInt(rnd, 900, 4600);
  const threshold = I.thresholds.cash;
  const occ = rPick(rnd, GEN_OCC);
  const pool = ccy === "INR" ? "IN" : ccy === "GBP" ? "UK" : ccy === "EUR" ? "EU" : "US";
  const nm = nameGen(rnd, pool);
  const legit = P.out === "close";
  const monthly = Math.round(unit * rInt(rnd, 2, 5));

  const seed = {
    id, kind:"generated", level, inst:instId, ccy, rule:P.rule, outcome:P.out,
    title: (legit ? "Explained step-change — " : "") + P.p.charAt(0).toUpperCase() + P.p.slice(1) + " pattern — " + occ.toLowerCase(),
    priority: level >= 4 ? "critical" : level >= 2 ? "high" : "medium",
    cust:{ name:nm, age:String(rInt(rnd,24,63)), since: rPick(rnd,["Mar 2018","Jul 2020","Nov 2021","Feb 2023","Sep 2019","Jan 2017"]),
      occ:occ, employer: legit ? "Self-employed — " + occ.toLowerCase() : "Self-employed", income: money(monthly, ccy) + " per month (declared)",
      city: rPick(rnd, I.geos), cc: ccy === "INR" ? "IN" : ccy === "GBP" ? "GB" : ccy === "EUR" ? "DE" : "US",
      ctype: rPick(rnd, I.customerTypes), risk: level >= 4 ? "high" : "low", product: rPick(rnd, I.products),
      expTurn: money(monthly, ccy) + " – " + money(Math.round(monthly*1.6), ccy) + " per month",
      expTypes:"Trading receipts, supplier payments, personal drawings", expCtry: I.geos.slice(0,2).join(" and "),
      expCps:"A stable set of trade counterparties and one payroll relationship",
      expCash: threshold ? "Modest — below " + money(Math.round(threshold*0.3), ccy) + " per month" : "None expected",
      sof: occ + " income", sow:"Business ownership", kycDate: rPick(rnd,["2021","2022","2023"]),
      priorAlerts: rnd() > 0.7 ? "One prior alert closed without escalation" : "None recorded",
      summary:"a " + occ.toLowerCase() + " with a declared monthly turnover of " + money(monthly, ccy) + "." },
    gen:{ start: iso(addD(new Date(), -rInt(rnd, 40, 200))), pool, cc: ccy === "INR" ? "IN" : ccy === "GBP" ? "GB" : ccy === "EUR" ? "DE" : "US",
      openBal: monthly, sites:["Main branch","North branch","Retail park branch","City centre branch"],
      flow: P.flow(rnd, P.p === "structuring" ? threshold : unit) },
    explain: legit
      ? "\"The large receipt is the completion money from selling my previous property. My solicitor sent it and I moved it straight into an investment account. I can send you the completion statement.\""
      : rPick(rnd, ["\"This is all normal business for me, trade has been busy. I can get you invoices if you need them.\"",
          "\"A friend asked me to move some money for him because his own account was frozen. I did not take anything for it.\"",
          "\"These are payments from customers. I do not always issue an invoice for small jobs.\"",
          "\"I am investing on behalf of some family members, we pool the money together.\""]),
    proof: legit
      ? "Customer produced the solicitor's completion statement, the land registry entry for the sale, and the investment platform confirmation. All three reconcile to the account to the currency unit."
      : rPick(rnd, ["Nothing was produced within the period allowed.",
          "Two invoices were produced. Neither carries a tax registration number and neither counterparty can be traced.",
          "A handwritten list of names and amounts was produced with no supporting records."]),
    flags: legit
      ? [{k:"volume",t:"A single receipt many times the size of any prior credit"},{k:"newcp",t:"Counterparty not previously seen on the relationship"}]
      : [{k:P.p,t:"Activity matches the " + P.p + " pattern the rule was written to detect"},
         {k:"profile",t:"Turnover materially above the profiled expectation of " + money(monthly, ccy) + " a month"},
         {k:"unrelated",t:"Counterparties do not appear in the customer's declared expected-counterparty list"},
         {k:"docs",t:"No documentation was produced that reconciles to the account"}],
    traps: legit
      ? [{t:"A large one-off receipt is not an indicator once its source is evidenced. Property completion proceeds arriving from a solicitor's client account are among the most readily verifiable sources there are."}]
      : [{t:"The channel and the product are ordinary for this customer segment. The pattern is what matters, not the payment rail."}],
    typology: P.typ,
    reveal:{ what:"A practice case generated to exercise the " + P.p + " pattern at level " + level + " in a " + I.short.toLowerCase() + " context.",
      facts:"Entirely fictional. Generated for practice. The pattern reflects typologies described in published FATF and FIU material; no real case, institution or person is depicted.",
      sources:[{ l:"FATF — methods and trends", u:"https://www.fatf-gafi.org/en/publications/Methodsandtrends.html" }] }
  };
  GENERATED[id] = seed;
  CASE_INDEX.push({ id, kind:"generated", level, inst:instId, title:seed.title, rule:P.rule,
    outcome:P.out, priority:seed.priority, src:"generated" });
  saveProg();
  return id;
}
