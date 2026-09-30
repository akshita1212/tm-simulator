
/* --------------------------------------------------------------------------
   23. Case management shell — tabs across the case file
   -------------------------------------------------------------------------- */
const CASE_TABS = [["overview","Alert overview"],["investigate","Investigation actions"],["screening","Screening"],
  ["timeline","Timeline"],["decide","Decision & disposition"]];

function viewCases(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id);
  const tab = CASE_TABS.some(t => t[0] === S.tab) ? S.tab : "overview";
  let h = caseStrip(c);
  h += '<div class="card" style="margin-bottom:16px"><div class="tabs" role="tablist">' +
    CASE_TABS.map(t => '<button role="tab" data-act="tab" data-id="' + t[0] + '" aria-selected="' + (tab===t[0]) + '">' +
      t[1] + '</button>').join("") + '</div></div>';

  if (tab === "overview") h += alertOverview(c);
  else if (tab === "investigate") h += investigationPanel(c);
  else if (tab === "screening") h += screeningPanel(c);
  else if (tab === "timeline") h += timelineTab(c, w);
  else h += decisionTab(c, w);
  return h;
}

function timelineTab(c, w){
  return '<div class="grid g-side"><div>' +
    card("Case audit trail", w.timeline.length
      ? '<ul class="timeline">' + w.timeline.map(t =>
        '<li class="' + esc(t.k||"") + '"><span class="tm">' + esc(t.t) + '</span><span class="dt"></span>' +
        '<span class="tx">' + esc(t.x) + '</span></li>').join("") + '</ul>'
      : '<p class="tiny">No actions recorded yet.</p>') +
    '</div><div class="stack">' +
    card("Why this matters",
      '<p class="tiny">Every analyst action is recorded with a timestamp. The trail evidences what was reviewed and when, ' +
      'which is what a regulator, an auditor or a court would examine if the case were ever revisited. It is also what ' +
      'protects the analyst: a decision that looks wrong later is defensible if the record shows it was reasonable on what ' +
      'was known at the time.</p>') +
    card("Progress", dl([
      ["Status", (STATUS[w.status]||STATUS.new).label],
      ["Assigned", new Date(w.assignedAt).toLocaleString("en-GB", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})],
      ["SLA", slaState(w).label],
      ["Actions taken", String((w.asked||[]).length)],
      ["Transactions flagged", String(w.flags.size)],
      ["Notes recorded", String(w.notes.length)],
      ["Hints used", String(w.hints) + " of 3"]])) +
    '</div></div>';
}

/* --------------------------------------------------------------------------
   24. Decision and disposition  (§19, §20)
   -------------------------------------------------------------------------- */
const DECISIONS = [
  { id:"close", label:"Close — activity reasonably explained", tone:"green",
    body:"The activity is unusual against the profile but is explained, and the explanation is supported by evidence you have tested. Closing does not mean nothing happened; it means there is no reasonable ground for suspicion." },
  { id:"edd", label:"Request information / enhanced due diligence", tone:"orange",
    body:"Material concerns remain unresolved and the outstanding information is identifiable and obtainable. Use this where the evidence supports neither closure nor escalation." },
  { id:"escalate", label:"Escalate to the MLRO", tone:"red",
    body:"Reasonable grounds for knowledge or suspicion remain after investigation. Escalation refers the matter to the MLRO for a decision on external reporting." }
];
function decisionTab(c, w){
  const role = ROLES[PROG.role];
  const done = PROG.completed[c.id];
  let h = '';
  if (done) return completedPanel(c, w, done);

  h += card("Decision",
    '<p class="page-lead">You are not determining whether an offence has been committed. You are deciding whether, on the ' +
    'evidence you have gathered, there are reasonable grounds to suspect — and documenting that decision so it can be reviewed.</p>' +
    '<div class="stack">' + DECISIONS.map(d => {
      const blocked = (d.id === "edd" && !role.can.edd);
      return '<button class="chip" data-act="decide" data-id="' + d.id + '" aria-pressed="' + (w.decision===d.id) + '"' +
        (blocked ? " disabled" : "") + ' style="display:block;text-align:left;border-radius:12px;padding:13px;height:auto">' +
        '<div class="row" style="margin-bottom:5px">' + pill(d.label, d.tone) +
        (blocked ? ' <span class="tiny">not permitted for your role</span>' : "") + '</div>' +
        '<div style="font-size:var(--t-foot);opacity:.85;line-height:1.55">' + esc(d.body) + '</div></button>'; }).join("") +
    '</div>' +
    (w.decision === "escalate" && role.can.recommendSar
      ? '<label class="switch" style="margin-top:14px"><input type="checkbox" id="sarRec"' + (w.sarRecommended?" checked":"") + '>' +
        '<span class="track"></span><span>Also recommend that the MLRO consider a SAR/STR</span></label>' +
        '<div class="callout info" style="margin-top:10px">A recommendation is not a report. The MLRO decides whether to ' +
        'report, and the institution — not the analyst — makes any external disclosure. Do not tip off the customer.</div>'
      : "") );

  h += card("Professional case disposition",
    '<p class="page-lead">Write the disposition as the permanent record of the investigation. Cover the alert trigger, the ' +
    'customer profile, the relevant transactions, the indicators identified, what you did, what the customer said, the ' +
    'evidence supporting and contradicting that account, your risk assessment, the potential typology and your decision.</p>' +
    '<div class="chipbar" style="margin-bottom:12px">' +
      ["Alert trigger","Customer profile","Relevant transactions","Key indicators","Investigation performed",
       "Customer explanation","Supporting evidence","Contradictory evidence","Risk assessment","Potential typology","Decision"]
      .map(x => '<span class="chip static">' + esc(x) + '</span>').join("") + '</div>' +
    '<textarea class="inp" id="dispo" rows="16" placeholder="Begin with what the rule measured and what the numbers actually are…">' +
      esc(w.disposition) + '</textarea>' +
    '<div class="row tiny" style="margin-top:8px"><span id="wc">' +
      (w.disposition.trim() ? w.disposition.trim().split(/\s+/).length : 0) + ' words</span>' +
      '<span class="tb-grow"></span><span class="dim">Assessed for accuracy, objectivity, clarity, evidence-led reasoning, ' +
      'terminology, completeness and unsupported assumptions.</span></div>' +
    '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn primary lg" data-act="submit"' + (w.decision ? "" : " disabled") + '>Submit for QA review</button>' +
      '<button class="btn" data-act="savedisp">Save draft</button>' +
      '<button class="btn ghost" data-act="hint">Request a hint (' + (3 - w.hints) + ' left)</button></div>' +
    (w.hints ? '<div class="callout warn" style="margin-top:12px"><strong>Hints used: ' + w.hints + '.</strong> ' +
      (c.hints||[]).slice(0, w.hints).map(x => '<div style="margin-top:6px">' + esc(x) + '</div>').join("") + '</div>' : ""));

  const missing = [];
  if (!w.flags.size) missing.push("no transactions have been flagged as relevant");
  if (!(w.asked||[]).length) missing.push("no investigation actions have been taken");
  if (askedIds(w).indexOf("sanc") < 0) missing.push("sanctions screening has not been run");
  if (askedIds(w).indexOf("media") < 0) missing.push("adverse media research has not been run");
  if (!w.notes.length) missing.push("no investigation notes have been recorded");
  if (missing.length) h += '<div class="callout warn">Before you submit — ' + esc(missing.join("; ")) +
    '. You may submit anyway; QA reviews what you did, not what you intended.</div>';
  return h;
}

/* --------------------------------------------------------------------------
   25. Submission, QA result and training report  (§25, §33)
   -------------------------------------------------------------------------- */
function submitCase(){
  const c = getCase(S.active), w = work(c.id);
  if (!w.decision) return toast("Select a decision first.");
  const disp = $("#dispo");
  if (disp) w.disposition = disp.value;
  const ev = evaluateCase(c, w);
  const minutes = Math.max(1, Math.round((Date.now() - (w.startedAt || w.assignedAt)) / 60000));
  const breached = Date.now() > w.dueAt;
  w.qa = { ev, narrative: qaNarrative(c, ev, w) };
  w.submittedAt = Date.now();
  w.status = w.decision === "escalate" ? "escalated" : w.decision === "edd" ? "pending" : "closed";
  logIt(c.id, "Decision recorded: " + OUTCOME_NAME[w.decision], "d");
  logIt(c.id, "Disposition submitted for QA review", "d");
  PROG.completed[c.id] = {
    id:c.id, ref:c.alert.ref, title:c.title, customer:c.customer.name, level:c.level, kind:c.kind,
    inst:c.inst, rule:c.alert.ruleId, decision:w.decision, outcome:c.outcome, score:ev.score, verdict:ev.verdict,
    dims:ev.dims.map(d => ({k:d.k,v:Math.round(d.v)})), missedFlags:ev.missed.map(f=>f.k),
    foundFlags:ev.found.map(f=>f.k), typology:c.typology, typologyHit:ev.typHit,
    unnecessary:ev.unnecessary, requests:(w.asked||[]).length, minutes, breached,
    hints:w.hints, when:Date.now(), qaSeen:false, learn:ev.learn, sar:w.sarRecommended
  };
  PROG.seenTypologies = uniq(PROG.seenTypologies.concat(c.typology));
  PROG.queue = (PROG.queue||[]).filter(id => id !== c.id);
  saveProg();
  S.tab = "decide"; S.nav = "cases";
  render();
  scrollPanelTop(true);
}

function completedPanel(c, w, rec){
  const ev = w.qa ? w.qa.ev : null;
  rec.qaSeen = true; saveProg();
  let h = '';
  const tone = rec.verdict === "Pass" ? "green" : rec.verdict === "Borderline" ? "orange" : "red";
  h += '<div class="grid g4" style="margin-bottom:16px">' +
    tile("QA score", rec.score + " / 100", "Senior AML QA review", tone === "green" ? "green" : tone === "orange" ? "orange" : "red") +
    tile("Result", rec.verdict, "pass threshold 75") +
    tile("Your decision", (OUTCOME_NAME[rec.decision]||"").split(" —")[0], rec.decision === rec.outcome ? "matches the supported outcome" : "differs from the supported outcome",
      rec.decision === rec.outcome ? "green" : "red") +
    tile("Handling time", rec.minutes + " min", rec.breached ? "SLA breached" : "within SLA", rec.breached ? "red" : "green") +
    '</div>';

  if (ev) h += card("QA scorecard",
    ev.dims.map(d => '<div class="scorebar"><span>' + esc(d.label) + ' <span class="dim2">(' + d.wgt + '%)</span></span>' +
      '<span class="bar"><i style="width:' + Math.round(d.v) + '%;background:var(--' +
      (d.v >= 75 ? "green" : d.v >= 55 ? "orange" : "red") + ')"></i></span>' +
      '<span class="right num">' + Math.round(d.v) + '</span></div>').join(""));

  if (w.qa) h += card("Senior AML QA reviewer — written review",
    '<div style="white-space:pre-wrap;line-height:1.7">' + esc(w.qa.narrative) + '</div>');

  if (ev){
    h += '<div class="grid g2">';
    h += card("Indicators you identified (" + ev.found.length + ")", ev.found.length
      ? '<ul style="margin:0;padding-left:18px">' + ev.found.map(f => '<li style="margin-bottom:5px">' + esc(f.t) + '</li>').join("") + '</ul>'
      : '<p class="tiny">None of the indicators present were articulated in your notes or disposition.</p>');
    h += card("Indicators missed (" + ev.missed.length + ")", ev.missed.length
      ? '<ul style="margin:0;padding-left:18px">' + ev.missed.map(f => '<li style="margin-bottom:5px">' + esc(f.t) + '</li>').join("") + '</ul>'
      : '<p class="tiny">You addressed every indicator present in this case.</p>');
    h += '</div>';
    if (c.traps && c.traps.length) h += card("Points that should have been discounted",
      '<ul style="margin:0;padding-left:18px">' + c.traps.map(t => '<li style="margin-bottom:5px">' + esc(t.t) + '</li>').join("") + '</ul>');
  }

  /* the reveal — only after submission */
  h += card("Case reveal",
    '<div class="row" style="margin-bottom:12px">' + kindPill(c.kind) + levelPill(c.level) +
      pill("Supported outcome: " + (OUTCOME_NAME[c.outcome]||"").split(" —")[0], c.outcome === "escalate" ? "red" : c.outcome === "edd" ? "orange" : "green") + '</div>' +
    '<h4 class="eyebrow" style="margin-bottom:6px">What this case was</h4><p>' + esc(c.reveal.what || "") + '</p>' +
    '<h4 class="eyebrow" style="margin:16px 0 6px">Potential typology</h4>' +
    '<div class="chipbar">' + c.typology.map(t => '<span class="chip static">' + esc(t) + '</span>').join("") + '</div>' +
    (c.reveal.facts ? '<h4 class="eyebrow" style="margin:16px 0 6px">Documented basis and what was invented</h4>' +
      '<div class="callout info">' + esc(c.reveal.facts) + '</div>' : "") +
    ((c.reveal.sources||[]).length ? '<h4 class="eyebrow" style="margin:16px 0 6px">Sources</h4><ul style="margin:0;padding-left:18px">' +
      c.reveal.sources.map(s => '<li><a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.l) + '</a></li>').join("") + '</ul>' : ""));

  h += '<div class="grid g2">' +
    card("Model disposition", '<div class="paper" style="white-space:pre-wrap">' + esc(c.model || "") + '</div>') +
    card("Your disposition", '<div class="paper" style="white-space:pre-wrap">' + esc(w.disposition || "— no disposition was written —") + '</div>') +
    '</div>';

  h += card("Training report",
    dl([["Investigation score", rec.score + " / 100 (" + rec.verdict + ")"],
        ["Decision recorded", OUTCOME_NAME[rec.decision] || "—"],
        ["Risk-based outcome supported by the evidence", OUTCOME_NAME[rec.outcome]],
        ["Red flags identified", String(rec.foundFlags.length)],
        ["Red flags missed", String(rec.missedFlags.length)],
        ["Information requests made", String(rec.requests)],
        ["Requests that did not bear on the outcome", String(rec.unnecessary)],
        ["Potential typology", rec.typology.join("; ")],
        ["Typology identified", rec.typologyHit ? "Yes" : "No"],
        ["Hints used", String(rec.hints)],
        ["Handling time", rec.minutes + " minutes" + (rec.breached ? " — SLA breached" : " — within SLA")],
        ["Recommended learning area", rec.learn]]) +
    '<div class="btn-row" style="margin-top:16px">' +
    '<button class="btn primary" data-act="nextcase">Take the next alert</button>' +
    '<button class="btn" data-act="nav" data-id="performance">Performance profile</button>' +
    '<button class="btn ghost" data-act="nav" data-id="queue">Back to the queue</button></div>');
  return h;
}
