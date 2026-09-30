
/* --------------------------------------------------------------------------
   26. Escalations  (§19, §27)
   -------------------------------------------------------------------------- */
function viewEscalations(){
  const esc_ = completedList().filter(r => r.decision === "escalate");
  const edd = completedList().filter(r => r.decision === "edd");
  const role = ROLES[PROG.role];
  let h = '<p class="page-lead">Escalation refers a matter to the MLRO. The analyst records suspicion and the basis for it; ' +
    'the MLRO decides whether the institution makes an external report. Nothing on this screen is a determination that an ' +
    'offence has been committed, and nothing here may be disclosed to the customer.</p>';

  h += '<div class="grid g4" style="margin-bottom:16px">' +
    tile("Escalated to MLRO", esc_.length, "awaiting MLRO consideration", esc_.length ? "red" : "") +
    tile("SAR/STR recommended", esc_.filter(r => r.sar).length, "analyst recommendation only") +
    tile("In enhanced due diligence", edd.length, "information outstanding", edd.length ? "orange" : "") +
    tile("Escalation accuracy", esc_.length ? Math.round(esc_.filter(r=>r.outcome==="escalate").length/esc_.length*100) + "%" : "—",
      "escalations the evidence supported") + '</div>';

  if (!esc_.length && !edd.length)
    return h + card("", empty("↑","No escalations yet","Cases you escalate or place into enhanced due diligence appear here with their MLRO status."));

  if (esc_.length) h += cardFlush("Escalations to the MLRO",
    '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Customer</th><th>Typology recorded</th>' +
    '<th>SAR/STR recommended</th><th>MLRO position</th><th class="num">QA</th></tr></thead><tbody>' +
    esc_.map(r => '<tr class="clickable" data-act="open" data-id="' + r.id + '">' +
      '<td class="mono">' + esc(r.ref) + '</td><td>' + esc(r.customer) + '</td>' +
      '<td class="dim">' + esc((r.typology||[]).slice(0,2).join("; ")) + '</td>' +
      '<td>' + (r.sar ? pill("Recommended","red") : pill("Not recommended","")) + '</td>' +
      '<td>' + (r.outcome === "escalate"
        ? pill("Accepted — proceeding to MLRO assessment","green")
        : r.outcome === "edd" ? pill("Returned — information outstanding","orange")
        : pill("Returned — activity explained","red")) + '</td>' +
      '<td class="num">' + r.score + '</td></tr>').join("") + '</tbody></table></div>');

  if (edd.length) h += cardFlush("Enhanced due diligence — information outstanding",
    '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Customer</th><th>Outstanding</th><th class="num">QA</th></tr></thead><tbody>' +
    edd.map(r => '<tr class="clickable" data-act="open" data-id="' + r.id + '">' +
      '<td class="mono">' + esc(r.ref) + '</td><td>' + esc(r.customer) + '</td>' +
      '<td class="dim">' + esc(r.learn) + '</td><td class="num">' + r.score + '</td></tr>').join("") + '</tbody></table></div>');

  if (!role.can.recommendSar) h += '<div class="callout warn">Your role cannot recommend SAR/STR consideration. ' +
    'Escalations you raise are reviewed by a senior analyst before they reach the MLRO.</div>';
  return h;
}

/* --------------------------------------------------------------------------
   27. QA review  (§25, §27)
   -------------------------------------------------------------------------- */
function viewQA(){
  const done = completedList().sort((a,b) => b.when - a.when);
  const role = ROLES[PROG.role];
  let h = '<p class="page-lead">Every completed investigation is reviewed against the institution\'s quality framework. ' +
    'The QA record is appended to the case; it never alters the analyst\'s original investigation history.</p>';
  if (role.id === "qa" || role.id === "mlro") h += '<div class="callout info">You are signed in as ' + esc(role.label) +
    '. You may read any completed investigation and its QA record. You cannot edit the analyst\'s notes, flags or disposition.</div>';

  if (!done.length) return h + card("", empty("✓","Nothing has been reviewed yet",
    "Complete an investigation and submit it. The QA reviewer scores investigation quality, risk-based approach, red-flag " +
    "identification, transaction and counterparty analysis, source-of-funds work, evidence handling, decision quality, " +
    "disposition and documentation."));

  const pass = done.filter(d => d.verdict === "Pass").length;
  const avg = Math.round(sum(done, d => d.score)/done.length);
  h += '<div class="grid g4" style="margin-bottom:16px">' +
    tile("Cases reviewed", done.length, "") +
    tile("Average score", avg + " / 100", "", avg >= 75 ? "green" : avg >= 60 ? "orange" : "red") +
    tile("Pass rate", Math.round(pass/done.length*100) + "%", pass + " of " + done.length, pass/done.length >= 0.75 ? "green" : "orange") +
    tile("Critical errors", done.filter(d => d.decision !== d.outcome).length, "decision differed from the supported outcome",
      done.filter(d => d.decision !== d.outcome).length ? "red" : "green") + '</div>';

  /* dimension averages across all reviews */
  const dimAvg = {};
  done.forEach(d => (d.dims||[]).forEach(x => { (dimAvg[x.k] = dimAvg[x.k] || []).push(x.v); }));
  const labels = { txn:"Transaction analysis", flags:"Red-flag identification", typ:"Typology identification",
    inv:"Investigation quality", ev:"Evidence and screening", dec:"Decision quality", disp:"Disposition writing", doc:"Documentation" };
  h += card("Quality framework — your averages",
    Object.keys(dimAvg).map(k => { const v = Math.round(sum(dimAvg[k])/dimAvg[k].length);
      return '<div class="scorebar"><span>' + esc(labels[k]||k) + '</span><span class="bar"><i style="width:' + v +
      '%;background:var(--' + (v>=75?"green":v>=55?"orange":"red") + ')"></i></span><span class="right num">' + v + '</span></div>'; }).join(""));

  h += cardFlush("Completed investigations",
    '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Case</th><th>Level</th><th>Decision</th>' +
    '<th>Supported outcome</th><th class="num">Score</th><th>Result</th><th>Focus</th></tr></thead><tbody>' +
    done.map(r => '<tr class="clickable" data-act="open" data-id="' + r.id + '">' +
      '<td class="mono">' + esc(r.ref) + '</td><td>' + esc(r.title) + '</td><td>' + levelPill(r.level) + '</td>' +
      '<td>' + esc((OUTCOME_NAME[r.decision]||"—").split(" —")[0]) + '</td>' +
      '<td>' + esc((OUTCOME_NAME[r.outcome]||"").split(" —")[0]) + '</td>' +
      '<td class="num">' + r.score + '</td>' +
      '<td>' + pill(r.verdict, r.verdict === "Pass" ? "green" : r.verdict === "Borderline" ? "orange" : "red") + '</td>' +
      '<td class="dim">' + esc(r.learn) + '</td></tr>').join("") + '</tbody></table></div>');
  return h;
}

/* --------------------------------------------------------------------------
   28. Performance  (§33)
   -------------------------------------------------------------------------- */
function viewPerformance(){
  const done = completedList().sort((a,b) => a.when - b.when);
  let h = '<p class="page-lead">Your cumulative analyst profile. The queue adapts to what this shows.</p>';
  if (!done.length) return h + card("", empty("◔","No completed investigations yet",
    "Complete a case and your performance profile builds here: score trend, typologies covered, indicators most often missed, " +
    "decision accuracy and handling time.",
    '<button class="btn primary" data-act="nav" data-id="queue">Go to the alert queue</button>'));

  const w = weakness();
  const avg = Math.round(sum(done, d => d.score)/done.length);
  const last5 = done.slice(-5);
  const recent = Math.round(sum(last5, d => d.score)/last5.length);
  const accuracy = Math.round(done.filter(d => d.decision === d.outcome).length / done.length * 100);

  h += '<div class="grid g4" style="margin-bottom:16px">' +
    tile("Cases completed", done.length, "of " + CASE_INDEX.length + " in the library") +
    tile("Average score", avg + " / 100", "recent five: " + recent, avg >= 75 ? "green" : avg >= 60 ? "orange" : "red") +
    tile("Decision accuracy", accuracy + "%", "matched the supported outcome", accuracy >= 80 ? "green" : accuracy >= 60 ? "orange" : "red") +
    tile("Average handling", Math.round(sum(done,d=>d.minutes)/done.length) + " min", "per case") + '</div>';

  h += '<div class="grid g-side"><div class="stack">' +
    chartCard("Score over time", "QA score for each completed investigation, in order. The dashed line is the pass mark.",
      columnChart(done.slice(-16).map((d, i, a) => ({ label:"#" + (done.length - a.length + i + 1), value:d.score,
          tone: i === a.length - 1 ? "hi" : d.verdict === "Fail" ? "alert" : "",
          badge: i === a.length - 1 ? String(d.score) : "",
          tip: d.ref + " · " + d.title + " · " + d.score + "/100 " + d.verdict, act:"open", id:d.id })),
        { height:220, refValue:75, refLabel:"Pass · 75", fmt:v => Math.round(v), aria:"QA score per completed case" }),
      '<table class="tbl dense"><thead><tr><th>Alert</th><th>Case</th><th class="num">Score</th><th>Result</th></tr></thead><tbody>' +
        done.map(d => '<tr><td class="mono">' + esc(d.ref) + '</td><td>' + esc(d.title) + '</td><td class="num">' + d.score + '</td><td>' + esc(d.verdict) + '</td></tr>').join("") +
      '</tbody></table>');

  h += cardFlush("Case history",
    '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Case</th><th>Level</th><th>Type</th>' +
    '<th>Decision</th><th class="num">Score</th><th class="num">Time</th></tr></thead><tbody>' +
    done.slice().reverse().map(r => '<tr class="clickable" data-act="open" data-id="' + r.id + '">' +
      '<td class="mono">' + esc(r.ref) + '</td><td>' + esc(r.title) + '</td><td>' + levelPill(r.level) + '</td>' +
      '<td>' + kindPill(r.kind) + '</td>' +
      '<td>' + (r.decision === r.outcome ? pill("Correct","green") : pill("Differed","red")) + ' ' +
        esc((OUTCOME_NAME[r.decision]||"").split(" —")[0]) + '</td>' +
      '<td class="num">' + r.score + '</td><td class="num">' + r.minutes + 'm</td></tr>').join("") + '</tbody></table></div>');
  h += '</div><div class="stack">';

  const missed = Object.keys(w.missFlag).sort((a,b)=>w.missFlag[b]-w.missFlag[a]).slice(0,8);
  h += card("Indicators most often missed", missed.length
    ? bars(missed.map(k => [FLAG_LABEL[k] || k, w.missFlag[k], "red"]))
    : '<p class="tiny">You have not repeatedly missed any single indicator.</p>');

  const typ = {}; done.forEach(d => (d.typology||[]).forEach(t => typ[t] = (typ[t]||0)+1));
  h += card("Typologies covered (" + Object.keys(typ).length + ")",
    Object.keys(typ).length ? '<div class="chipbar">' + Object.keys(typ).sort().map(t =>
      '<span class="chip static">' + esc(t) + ' <span class="dim2">' + typ[t] + '</span></span>').join("") + '</div>'
    : '<p class="tiny">None recorded yet.</p>');

  h += card("Decision profile",
    bars([["Escalate", w.esc, "red"], ["Enhanced due diligence", w.edd, "orange"], ["Close", w.cls, "green"]], done.length) +
    '<hr class="sep">' +
    dl([["Escalated where the evidence supported closure", String(w.wrongEsc)],
        ["Closed where the evidence supported escalation", String(w.wrongCls)],
        ["Average unnecessary requests per case", w.overReqAvg.toFixed(1)],
        ["Analyst level", avg >= 88 ? "Expert" : avg >= 78 ? "Advanced" : avg >= 66 ? "Strong" : avg >= 54 ? "Competent" : avg >= 42 ? "Developing" : "Foundation"]]));

  h += card("Adaptive coaching", '<p class="tiny" style="margin:0">' + esc(adviceLine()) + '</p>');
  h += '</div></div>';
  return h;
}

/* --------------------------------------------------------------------------
   29. Training  (§21, §22, §23, §29)
   -------------------------------------------------------------------------- */
function viewTraining(){
  const done = PROG.completed;
  const core = CASE_INDEX.filter(x => x.src !== "generated");
  const gen = CASE_INDEX.filter(x => x.src === "generated");
  const byLevel = {}, byKind = {}, byOutcome = {};
  core.forEach(x => { byLevel[x.level] = (byLevel[x.level]||0)+1; byKind[x.kind] = (byKind[x.kind]||0)+1; byOutcome[x.outcome] = (byOutcome[x.outcome]||0)+1; });
  const completedCore = core.filter(x => done[x.id]).length;

  let h = '<p class="page-lead">The core library is a curated set of investigations spanning five complexity levels, ' +
    'both documented and fictional, with a deliberate mix of outcomes so that closing a case is as much a skill as ' +
    'escalating one. Beyond it, the generator produces unlimited practice cases built from different combinations of ' +
    'customer, product, geography, pattern, counterparty network, typology, explanation and evidence.</p>';

  h += '<div class="grid g4" style="margin-bottom:16px">' +
    tile("Core library", core.length + " cases", completedCore + " completed") +
    tile("Documented basis", byKind.real || 0, "from published enforcement actions") +
    tile("Fictional", byKind.fictional || 0, "written for the simulator") +
    tile("Generated so far", gen.length, "unlimited practice") + '</div>';

  h += '<div class="grid g-side"><div class="stack">' +
    card("Generate a practice case",
      '<p class="page-lead">Practice cases are built at run time. Choose what you want to work on, or leave it to the ' +
      'adaptive engine to target what your results say you most need.</p>' +
      '<div class="grid g3">' +
      '<label class="field"><span class="lbl">Complexity</span><select class="inp" id="genLevel">' +
        '<option value="">Adaptive — match my level</option>' +
        [1,2,3,4,5].map(l => '<option value="' + l + '">' + LEVEL_NAME[l] + '</option>').join("") + '</select></label>' +
      '<label class="field"><span class="lbl">Pattern</span><select class="inp" id="genPattern">' +
        '<option value="">Any pattern</option>' +
        GEN_PATTERNS.map(p => '<option value="' + p.p + '">' + p.p.charAt(0).toUpperCase()+p.p.slice(1) + '</option>').join("") + '</select></label>' +
      '<label class="field"><span class="lbl">Institution</span><select class="inp" id="genInst">' +
        INSTITUTIONS.map(I => '<option value="' + I.id + '"' + (I.id===PROG.inst?" selected":"") + '>' + esc(I.short) + '</option>').join("") + '</select></label>' +
      '</div><button class="btn primary" data-act="gen">Generate and open</button>');

  h += cardFlush("Core case library",
    '<div class="tw"><table class="tbl"><thead><tr><th>Case</th><th>Level</th><th>Type</th><th>Institution</th>' +
    '<th>Rule</th><th>Status</th></tr></thead><tbody>' +
    core.map(x => '<tr class="clickable" data-act="open" data-id="' + x.id + '">' +
      '<td><div style="font-weight:540">' + esc(x.title) + '</div><div class="tiny mono">' + esc(x.id) + '</div></td>' +
      '<td>' + levelPill(x.level) + '</td><td>' + kindPill(x.kind) + '</td>' +
      '<td class="dim nowrap">' + esc(inst(x.inst).short) + '</td>' +
      '<td class="dim nowrap">' + esc(rule(x.rule).code) + '</td>' +
      '<td>' + (done[x.id] ? pill(done[x.id].score + "/100 " + done[x.id].verdict,
        done[x.id].verdict === "Pass" ? "green" : done[x.id].verdict === "Borderline" ? "orange" : "red") : pill("Not attempted","")) +
      '</td></tr>').join("") + '</tbody></table></div>');
  h += '</div><div class="stack">' +
    card("Library composition",
      '<h4 class="eyebrow" style="margin-bottom:8px">By complexity</h4>' +
      bars([1,2,3,4,5].map(l => [LEVEL_NAME[l], byLevel[l]||0, "blue"]), core.length) +
      '<hr class="sep"><h4 class="eyebrow" style="margin-bottom:8px">By supported outcome</h4>' +
      bars([["Escalate", byOutcome.escalate||0, "red"], ["Enhanced due diligence", byOutcome.edd||0, "orange"],
            ["Close — explained", byOutcome.close||0, "green"]], core.length) +
      '<p class="tiny" style="margin-top:12px">Roughly a quarter of the library is legitimate activity that a monitoring ' +
      'engine cannot distinguish from laundering without investigation — property purchases, inheritances, business sales, ' +
      'family transfers, investment proceeds, education payments and genuine trading growth. Learning that ' +
      '<strong>unusual is not the same as suspicious</strong> is the point of those cases.</p>') +
    card("Complexity levels",
      '<div class="stack" style="gap:10px">' + [
        [1,"Clear indicators, a single pattern, a short ledger."],
        [2,"Several transaction patterns interacting; the explanation is partly plausible."],
        [3,"Competing explanations, both of which fit some of the evidence."],
        [4,"Multiple entities and transaction chains; the network matters more than any transaction."],
        [5,"No single transaction is obviously unusual; the case exists only in the aggregate."]
      ].map(r => '<div><div class="row" style="margin-bottom:3px">' + levelPill(r[0]) +
        '<span style="font-weight:560">' + LEVEL_NAME[r[0]].split(" · ")[1] + '</span></div>' +
        '<div class="tiny">' + esc(r[1]) + '</div></div>').join("") + '</div>') +
    card("Sourcing and attribution",
      '<p class="tiny">Cases marked <em>documented basis</em> take their control environment and typology from published ' +
      'enforcement actions by authorities including FinCEN, the FCA, the DOJ, OFAC, the OCC, the SEC, NYDFS, AUSTRAC and ' +
      'the Federal Reserve. In every such case the customers, counterparties, account numbers, transactions, documents and ' +
      'quoted explanations are invented for the simulation. Each case states that split explicitly in its reveal, and the ' +
      'reveal is shown only after the investigation is complete.</p>');
  h += '</div></div>';
  return h;
}
