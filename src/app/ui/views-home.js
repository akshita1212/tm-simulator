
/* --------------------------------------------------------------------------
   16. Welcome — institution and role selection  (§1, §27)
   -------------------------------------------------------------------------- */
function viewLogin(){
  const I = inst(PROG.inst);
  let h = '<div class="welcome">';
  h += '<aside class="welcome-brand">' +
    '<img class="welcome-mark" src="' + MARK_DARK + '" alt="CamelAML">' +
    '<div><div class="welcome-word">Camel<b>AML</b></div><div class="welcome-tag">Master AML. Think like an analyst.</div></div>' +
    '<p class="welcome-lead">A transaction monitoring and AML investigation workspace. Work a live alert queue, investigate ' +
    'customers and counterparties, and defend every decision to a QA reviewer.</p>' +
    '<ul class="welcome-feats">' +
      '<li>' + icon("queue", 18) + '<span><b>100 curated investigations.</b> Fifty built on published enforcement actions, fifty written for the simulator.</span></li>' +
      '<li>' + icon("target", 18) + '<span><b>Unusual is not suspicious.</b> A quarter of the library is legitimate activity you have to clear.</span></li>' +
      '<li>' + icon("qa", 18) + '<span><b>Reviewed like the real thing.</b> Every disposition is scored by a senior QA reviewer on eight dimensions.</span></li>' +
      '<li>' + icon("sparkles", 18) + '<span><b>Adapts to you.</b> The queue shifts toward whatever your results say you miss.</span></li>' +
    '</ul>' +
    '<div class="welcome-note"><b style="color:var(--side-ink)">Training simulation.</b> Every customer, counterparty, account, transaction and ' +
    'document is fictional. Cases with a documented basis take their typology from published enforcement actions; the source is revealed only after you finish.</div>' +
    '</aside>';

  h += '<main class="welcome-form"><div class="welcome-inner fade">' +
    '<div class="eyebrow">Set up your workspace</div><h1>Where are you working today?</h1>' +
    '<p class="page-lead">Each institution changes the customers, products, channels, monitoring rules and typologies in your queue.</p>';

  h += '<section class="step"><div class="step-h"><span class="step-n">1</span><h2>Institution</h2></div><div class="opt-grid">' +
    INSTITUTIONS.map(x =>
      '<button class="opt" data-act="pick-inst" data-id="' + x.id + '" aria-pressed="' + (PROG.inst === x.id) + '">' +
      '<span class="opt-ic">' + icon(INST_ICON[x.id], 18) + '</span>' +
      '<span class="opt-t">' + esc(x.short) + '</span><span class="opt-s">' + esc(x.tag) + '</span></button>').join("") +
    '</div><div class="callout info" style="margin-top:12px"><strong>' + esc(I.name) + '.</strong> ' + esc(I.desc) + '</div></section>';

  h += '<section class="step"><div class="step-h"><span class="step-n">2</span><h2>Your role</h2></div><div class="opt-grid two">' +
    Object.keys(ROLES).map(k => { const R = ROLES[k];
      return '<button class="opt" data-act="pick-role" data-id="' + k + '" aria-pressed="' + (PROG.role === k) + '">' +
        '<span class="opt-t">' + esc(R.label) + '</span><span class="opt-s">' + esc(R.note) + '</span></button>'; }).join("") +
    '</div></section>';

  h += '<section class="step"><div class="step-h"><span class="step-n">3</span><h2>Your name</h2></div>' +
    '<label class="field" style="max-width:360px"><span class="lbl">Shown on the case record and the QA review</span>' +
    '<input class="inp" id="analystName" placeholder="e.g. R. Mehta" value="' + esc(PROG.analyst) + '" maxlength="40" autocomplete="name"></label></section>';

  h += '<div class="welcome-cta"><button class="btn primary lg" data-act="start">Enter workspace ' + icon("arrow", 16) + '</button>' +
    (Object.keys(PROG.completed).length ? '<button class="btn lg" data-act="resume">Resume · ' + Object.keys(PROG.completed).length + ' completed</button>' : "") +
    '</div></div></main></div>';
  return h;
}

/* --------------------------------------------------------------------------
   17. Dashboard  (§3)
   -------------------------------------------------------------------------- */
function kpiCard(o){
  return '<div class="kpi' + (o.feature ? " feature" : "") + '">' +
    '<div class="kpi-k">' + (o.icon ? icon(o.icon, 16) : "") + esc(o.k) + '</div>' +
    '<div class="kpi-row"><div style="min-width:0"><div class="kpi-v">' + o.v + (o.u ? '<span class="u">' + esc(o.u) + '</span>' : "") + '</div>' +
    '<div class="kpi-d">' + (o.d || "") + '</div></div>' + (o.chart || "") + '</div></div>';
}
function delta(text, dir, ic){
  return '<span class="delta ' + (dir || "neutral") + '">' + (ic ? icon(ic, 14) : "") + esc(text) + '</span>';
}

function viewDashboard(){
  const rows = queueRows(), done = completedList().sort((a,b) => a.when - b.when);
  const byPr = k => rows.filter(r => r.c.alert.priority === k).length;
  const overdue = rows.filter(r => r.sla.overdue);
  const soon = rows.filter(r => !r.sla.overdue && r.sla.left < 24 * 3600e3);
  const avg = done.length ? Math.round(sum(done, d => d.score) / done.length) : null;
  const acc = done.length ? Math.round(done.filter(d => d.decision === d.outcome).length / done.length * 100) : null;
  const coreN = CASE_INDEX.filter(x => x.src !== "generated").length;

  /* --- KPI row ------------------------------------------------------------ */
  const H = 3600e3;
  const buckets = [overdue.length,
    rows.filter(r => !r.sla.overdue && r.sla.left < 6*H).length,
    rows.filter(r => r.sla.left >= 6*H && r.sla.left < 24*H).length,
    rows.filter(r => r.sla.left >= 24*H && r.sla.left < 48*H).length,
    rows.filter(r => r.sla.left >= 48*H && r.sla.left < 120*H).length,
    rows.filter(r => r.sla.left >= 120*H).length];
  const last = done.slice(-7).map(d => d.score);
  let h = '<div class="kpis">' +
    kpiCard({ feature:true, icon:"queue", k:"Open alerts", v:rows.length, u:"assigned",
      d: delta(byPr("critical") + " critical", "neutral", "flame") + '<span>· ' + byPr("high") + ' high</span>',
      chart: miniBars(["critical","high","medium","low"].map(byPr), { highlight:0 }) }) +
    kpiCard({ icon:"timer", k:"Due within 24 hours", v: soon.length + overdue.length, u:"alerts",
      d: overdue.length ? delta(overdue.length + " overdue", "down", "alert") : delta("none overdue", "up", "check"),
      chart: miniBars(buckets, { highlight:1, alert: overdue.length ? [0] : [] }) }) +
    kpiCard({ icon:"gauge", k:"Average QA score", v: avg == null ? "—" : avg, u: avg == null ? "" : "/100",
      d: done.length >= 2 ? delta((last[last.length-1] - last[last.length-2] >= 0 ? "+" : "") + (last[last.length-1] - last[last.length-2]) + " on last case",
            last[last.length-1] >= last[last.length-2] ? "up" : "down", last[last.length-1] >= last[last.length-2] ? "up" : "downTrend")
         : done.length ? '<span>First review in</span>' : '<span>Complete a case to start your profile</span>',
      chart: last.length ? miniBars(last, {}) : "" }) +
    '</div>';

  /* --- SLA runway + summary -------------------------------------------- */
  const sorted = rows.slice().sort((a,b) => a.sla.left - b.sla.left);
  const firstLive = sorted.findIndex(r => !r.sla.overdue);
  const series = sorted.map((r, i) => {
    const hrs = Math.max(0, r.sla.left / H);
    return { label: r.c.alert.ref.replace(/^AL-/, ""), value: Math.round(hrs * 10) / 10,
      tone: r.sla.overdue ? "alert" : i === firstLive ? "hi" : "",
      badge: r.sla.overdue ? "Overdue" : i === firstLive ? durHM(r.sla.left) : "",
      tip: r.c.alert.ref + " · " + r.c.customer.name + " · " + r.sla.label + " · " + PRIORITY[r.c.alert.priority].label,
      act: "open", id: r.c.id };
  });
  const runway = columnChart(series, { height:290, refValue:24, refLabel:"24h · critical SLA", fmt:v => Math.round(v) + "h",
    aria:"Hours of SLA remaining for each alert in your queue, most urgent first" });
  const runwayTable = '<table class="tbl dense"><thead><tr><th>Alert</th><th>Customer</th><th>Priority</th><th class="num">Hours left</th></tr></thead><tbody>' +
    sorted.map(r => '<tr class="clickable" data-act="open" data-id="' + r.c.id + '"><td class="mono">' + esc(r.c.alert.ref) + '</td><td>' + esc(r.c.customer.name) +
      '</td><td>' + priorityPill(r.c.alert.priority) + '</td><td class="num">' + esc(r.sla.label) + '</td></tr>').join("") + '</tbody></table>';

  const summary = '<aside class="summary">' +
    '<div><div class="eyebrow">Your analyst profile</div>' +
    '<div class="summary-v" style="margin-top:10px">' + done.length + '<span class="u">of ' + coreN + '</span></div>' +
    '<div class="summary-d">' + (done.length ? delta("avg " + avg + "/100", "neutral", "gauge") + "<span>core cases completed</span>" : "<span>core cases completed — start with the alert closest to breach</span>") + '</div></div>' +
    '<div class="sum-item"><span class="sum-ic">' + icon("target", 18) + '</span><div><div class="sum-t">' + (acc == null ? "—" : acc + "%") + ' decision accuracy</div><div class="sum-s">matched the risk-based outcome</div></div></div>' +
    '<div class="sum-item"><span class="sum-ic">' + icon("layers", 18) + '</span><div><div class="sum-t">' + PROG.seenTypologies.length + ' typologies covered</div><div class="sum-s">across your completed investigations</div></div></div>' +
    '<div class="sum-item" style="align-items:flex-start"><span class="sum-ic">' + icon("sparkles", 18) + '</span><div><div class="sum-t">Adaptive coaching</div><div class="sum-s">' + esc(adviceLine()) + '</div></div></div>' +
    '</aside>';

  h += '<div class="dash-row">' +
    chartCard("SLA runway", "Hours left on each alert, most urgent first. Select a bar to open the alert.", runway, runwayTable) +
    summary + '</div>';

  /* --- urgent table + geography ----------------------------------------- */
  const urgent = sorted.slice(0, 6);
  const table = '<section class="card"><div class="card-h"><div class="grow"><h3>Alerts closest to breach</h3><div class="card-sub">Weigh SLA against risk — not one or the other.</div></div>' +
    '<a class="btn sm" href="' + hrefFor("queue") + '" data-act="nav" data-id="queue">View queue ' + icon("right", 14) + '</a></div>' +
    '<div class="card-b flush"><div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Customer</th><th>Activity</th><th class="num">Alerted</th><th>SLA</th></tr></thead><tbody>' +
    urgent.map(r => { const R = rule(r.c.alert.ruleId);
      return '<tr class="clickable" data-act="open" data-id="' + r.c.id + '">' +
        '<td><div class="mono cell-main">' + esc(r.c.alert.ref) + '</div><div style="margin-top:4px">' + priorityPill(r.c.alert.priority) + '</div></td>' +
        '<td style="min-width:200px"><div class="cell-main" style="font-weight:500">' + esc(r.c.customer.name) + '</div><div class="cell-sub"><span class="cc">' + esc(r.c.customer.cc) + '</span> ' + esc(R.cat) + ' · ' + esc(R.code) + '</div></td>' +
        '<td>' + sparkline(dailySeries(r.c.txns, 12)) + '</td>' +
        '<td class="num nowrap cell-main">' + esc(moneyShort(r.c.alert.amount, r.c.ccy)) + '</td>' +
        '<td>' + slaBar(r.sla) + '</td></tr>'; }).join("") +
    '</tbody></table></div></div></section>';

  const geo = {};
  rows.forEach(r => r.c.alert.countries.forEach(cc => { geo[cc] = (geo[cc] || 0) + 1; }));
  const geoRows = Object.keys(geo).sort((a,b) => geo[b] - geo[a] || (isHighRisk(b) - isHighRisk(a))).slice(0, 7);
  const geoMax = Math.max.apply(null, geoRows.map(k => geo[k]).concat([1]));
  const geoCard = '<aside class="geo"><div class="row" style="margin-bottom:10px"><div class="grow"><h3>Risk geography</h3>' +
    '<div class="tiny" style="color:var(--feature-ink-2)">Countries touched by your open alerts</div></div>' + icon("globe", 18) + '</div>' +
    (geoRows.length ? geoRows.map(k => '<div class="geo-row"><span class="cc">' + esc(k) + '</span><div style="min-width:0"><div class="geo-name">' +
      esc(ctryName(k)) + (isHighRisk(k) ? '<span class="hr">HIGHER RISK</span>' : "") + '</div><div class="geo-bar"><i style="width:' +
      Math.round(geo[k] / geoMax * 100) + '%"></i></div></div><span class="geo-n">' + geo[k] + '</span></div>').join("")
      : '<p class="tiny">No open alerts.</p>') + '</aside>';

  h += '<div class="dash-row">' + table + geoCard + '</div>';

  /* --- lifecycle --------------------------------------------------------- */
  const by = st => rows.filter(r => r.w.status === st).length + (st === "closed" ? done.filter(d => d.decision === "close").length : 0);
  h += card("Alert lifecycle", '<div class="chipbar">' + Object.keys(STATUS).map(k =>
      '<span class="chip static">' + pill(STATUS[k].label, STATUS[k].tone) + '<span class="num" style="font-weight:600">' + by(k) + '</span></span>').join("") + '</div>');
  return h;
}

/* --------------------------------------------------------------------------
   18. Alert queue  (§6, §28)
   -------------------------------------------------------------------------- */
function filterRows(rows){
  const f = S.filters;
  return rows.filter(r => {
    const c = r.c;
    if (f.q){ const q = f.q.toLowerCase();
      if ((c.alert.ref + " " + c.customer.name + " " + c.title + " " + rule(c.alert.ruleId).name + " " + c.customer.id)
          .toLowerCase().indexOf(q) < 0) return false; }
    if (f.risk && c.alert.risk !== f.risk) return false;
    if (f.priority && c.alert.priority !== f.priority) return false;
    if (f.status && r.w.status !== f.status) return false;
    if (f.rule && c.alert.ruleId !== f.rule) return false;
    if (f.level && String(c.level) !== f.level) return false;
    if (f.country && c.alert.countries.indexOf(f.country) < 0) return false;
    if (f.sla === "overdue" && !r.sla.overdue) return false;
    if (f.sla === "risk" && (r.sla.overdue || r.sla.usedPct < 0.75)) return false;
    if (f.sla === "ok" && r.sla.usedPct >= 0.75) return false;
    return true;
  });
}
function sortRows(rows){
  const k = S.sort.key, a = S.sort.asc ? 1 : -1;
  const val = r => k === "sla" ? r.sla.left
    : k === "amount" ? r.c.alert.amount
    : k === "priority" ? PRIORITY[r.c.alert.priority].order
    : k === "risk" ? ["low","medium","high","critical"].indexOf(r.c.alert.risk)
    : k === "status" ? STATUS[r.w.status].order
    : k === "customer" ? r.c.customer.name.toLowerCase()
    : k === "date" ? r.c.alert.date
    : k === "level" ? r.c.level
    : r.c.alert.ref;
  return rows.slice().sort((x,y) => { const vx = val(x), vy = val(y);
    return (vx < vy ? -1 : vx > vy ? 1 : 0) * a; });
}
function th(key, label, num){
  const on = S.sort.key === key;
  return '<th class="sortable' + (num ? " num" : "") + '" data-act="sort" data-id="' + key + '" ' +
    'aria-sort="' + (on ? (S.sort.asc ? "ascending" : "descending") : "none") + '">' + esc(label) +
    (on ? '<span class="arrow" aria-hidden="true">' + (S.sort.asc ? "↑" : "↓") + '</span>' : "") + '</th>';
}
function viewQueue(mineOnly){
  let rows = queueRows();
  if (mineOnly) rows = rows.filter(r => ["assigned","investigating","pending"].indexOf(r.w.status) >= 0);
  const all = rows.length;
  rows = sortRows(filterRows(rows));
  const f = S.filters;
  const countries = uniq(queueRows().flatMap(r => r.c.alert.countries));

  let h = '<div class="card" style="margin-bottom:16px"><div class="card-b tight">' +
    '<div class="row" style="gap:8px">' +
      '<div class="search" style="flex:1;min-width:180px">' + icon("search", 16) + '<input class="inp" data-f="q" value="' + esc(f.q) + '" placeholder="Search alert ref, customer, rule, case"></div>' +
      '<select class="inp" data-f="priority" style="width:auto"><option value="">All priorities</option>' +
        Object.keys(PRIORITY).map(k => '<option value="' + k + '"' + (f.priority===k?" selected":"") + '>' + PRIORITY[k].label + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="risk" style="width:auto"><option value="">All risk</option>' +
        Object.keys(RISK).map(k => '<option value="' + k + '"' + (f.risk===k?" selected":"") + '>' + RISK[k].label + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="status" style="width:auto"><option value="">All statuses</option>' +
        Object.keys(STATUS).map(k => '<option value="' + k + '"' + (f.status===k?" selected":"") + '>' + STATUS[k].label + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="rule" style="width:auto;max-width:240px"><option value="">All rules</option>' +
        RULES.map(r => '<option value="' + r.id + '"' + (f.rule===r.id?" selected":"") + '>' + esc(r.code + " " + r.name) + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="country" style="width:auto"><option value="">All countries</option>' +
        countries.map(cc => '<option value="' + cc + '"' + (f.country===cc?" selected":"") + '>' + esc(ctryName(cc)) + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="level" style="width:auto"><option value="">All levels</option>' +
        [1,2,3,4,5].map(l => '<option value="' + l + '"' + (f.level===String(l)?" selected":"") + '>' + LEVEL_NAME[l] + '</option>').join("") + '</select>' +
      '<select class="inp" data-f="sla" style="width:auto"><option value="">Any SLA</option>' +
        '<option value="overdue"' + (f.sla==="overdue"?" selected":"") + '>Overdue</option>' +
        '<option value="risk"' + (f.sla==="risk"?" selected":"") + '>At risk (&gt;75% elapsed)</option>' +
        '<option value="ok"' + (f.sla==="ok"?" selected":"") + '>Within SLA</option></select>' +
      '<button class="btn sm ghost" data-act="clearf">Clear</button>' +
    '</div></div></div>';

  h += '<div class="row tiny" style="margin-bottom:10px"><span>' + rows.length + ' of ' + all + ' alerts</span>' +
    '<span class="tb-grow"></span><span class="dim">Click any row to open the alert.</span></div>';

  if (!rows.length) return h + card("", empty("☰","No alerts match these filters","Adjust or clear the filters to see the rest of your queue.",
    '<button class="btn" data-act="clearf">Clear filters</button>'));

  h += '<section class="card"><div class="card-b flush"><div class="tw"><table class="tbl"><thead><tr>' +
    th("ref","Alert ID") + th("customer","Customer") + '<th>Rule</th>' + th("amount","Amount", true) +
    th("risk","Risk") + th("priority","Priority") + th("status","Status") + th("level","Level") + th("sla","SLA") +
    '</tr></thead><tbody>' +
    rows.map(r => '<tr class="clickable' + (S.active === r.c.id ? " sel" : "") + '" data-act="open" data-id="' + r.c.id + '">' +
      '<td class="mono nowrap">' + esc(r.c.alert.ref) + '</td>' +
      '<td style="min-width:200px"><div class="cell-main" style="font-weight:500">' + esc(r.c.customer.name) + '</div><div class="cell-sub">' + esc(r.c.title) + '</div></td>' +
      '<td class="dim nowrap" title="' + esc(rule(r.c.alert.ruleId).name) + '">' + esc(rule(r.c.alert.ruleId).code) + '</td>' +
      '<td class="num nowrap">' + esc(moneyShort(r.c.alert.amount, r.c.ccy)) + '</td>' +
      '<td>' + riskPill(r.c.alert.risk) + '</td>' +
      '<td>' + priorityPill(r.c.alert.priority) + '</td>' +
      '<td>' + statusPill(r.w.status) + '</td>' +
      '<td>' + levelPill(r.c.level) + '</td>' +
      '<td>' + slaBar(r.sla) + '</td></tr>').join("") +
    '</tbody></table></div></div></section>';
  return h;
}
