
/* --------------------------------------------------------------------------
   22. Case file — triage, investigation, decision, disposition
        (§5, §7, §14, §15, §16, §19, §20)
   -------------------------------------------------------------------------- */
function needCase(){
  return card("", empty("▣", "No alert is open",
    "Open an alert from the queue to work it. Customer 360, the transaction ledger, entity records, notes and evidence all operate on the alert you have open.",
    '<button class="btn primary" data-act="nav" data-id="queue">Go to the alert queue</button>'));
}
function markSeen(c, text, key){
  const w = work(c.id);
  if (w.status === "assigned" || w.status === "new"){ w.status = "investigating"; w.startedAt = w.startedAt || Date.now(); logIt(c.id, "Investigation started", "k"); }
  if (!w._seen) w._seen = {};
  if (!w._seen[key]){ w._seen[key] = 1; logIt(c.id, text); }
}
function askedIds(w){ return (w.asked||[]).map(a => a.id); }

/* --- alert overview ------------------------------------------------------ */
function alertOverview(c){
  const r = rule(c.alert.ruleId), st = c.stats, w = work(c.id);
  const trigger = c.alert.trigger || ("Alert generated because " + st.nIn + " credits totalling " + money(st.inV, c.ccy) +
    " were received from " + c.counterparties.filter(x=>x.inV>0).length + " counterparties over " + st.days +
    " days, followed by " + money(st.outV, c.ccy) + " in outgoing value across " + st.nOut + " debits, against a profiled expectation of " +
    c.customer.expected.turnover + ".");
  let h = '';
  h += card("Why was this alert generated?",
    '<p style="font-size:var(--t-head);line-height:1.6">' + esc(trigger) + '</p>' +
    '<hr class="sep">' +
    dl([["Rule", r.code + " — " + r.name],
        ["What the rule measures", r.mech],
        ["What the rule cannot tell you", r.watch]]) +
    '<div class="callout info" style="margin-top:14px">The engine detects <strong>unusual activity</strong>. It does not ' +
    'detect crime, and it has not formed a view. Whether this activity is suspicious is the question you are being asked ' +
    'to answer, on evidence.</div>');

  h += card("Alert record", '<div class="grid g2"><div>' + dl([
      ["Alert ID", c.alert.ref], ["Customer ID", c.customer.id], ["Customer", c.customer.name],
      ["Rule triggered", r.code + " " + r.name],
      ["Alert date", fmtDate(c.alert.date)], ["Review period", c.alert.period],
      ["Priority", priorityPill(c.alert.priority) + " · SLA " + PRIORITY[c.alert.priority].slaH + " hours", "html"],
      ["Risk rating", riskPill(c.alert.risk), "html"]
    ]) + '</div><div>' + dl([
      ["Transaction count", String(c.alert.count)],
      ["Alerted amount", money(c.alert.amount, c.ccy)], ["Currency", c.ccy],
      ["Product", c.alert.product], ["Channel", c.alert.channel],
      ["Countries involved", c.alert.countries.map(ctryName).join(", ")],
      ["Counterparties", String(c.alert.nCps)],
      ["Previous alert history", c.alert.prior]
    ]) + '</div></div>');

  h += card("Working questions",
    '<p class="tiny">A transaction monitoring investigation answers these before it reaches a decision. ' +
    'The answers belong in your notes and in the disposition.</p>' +
    '<div class="chipbar">' + ["Who?","What?","When?","Where?","Why?","How?","How much?","Who else is involved?",
      "Is this consistent with the customer's profile?","Is there a legitimate economic rationale?",
      "Can the explanation be independently supported?","What evidence contradicts the explanation?",
      "What further information is needed?"].map(q => '<span class="chip static">' + esc(q) + '</span>').join("") + '</div>');
  return h;
}

/* --- investigation actions ----------------------------------------------- */
function investigationPanel(c){
  const w = work(c.id), role = ROLES[PROG.role], done = askedIds(w);
  const groups = {};
  c.requests.forEach(r => { (groups[r.cat] = groups[r.cat] || []).push(r); });
  let h = '<p class="page-lead">Each action returns what that team or record actually holds. Information is disclosed only ' +
    'when you ask for it, and every action is timestamped on the case timeline. Unnecessary requests are recorded too — ' +
    'investigative effort is finite and QA reviews scope as well as depth.</p>';

  if (!role.can.requestCustomer) h += '<div class="callout warn">Your role is <strong>' + esc(role.label) + '</strong>. ' +
    'Customer contact and enhanced due diligence requests must be raised through a senior analyst and are disabled here.</div>';

  Object.keys(groups).forEach(cat => {
    h += '<section class="card"><div class="card-h"><h3>' + esc(cat) + '</h3></div><div class="card-b flush">';
    groups[cat].forEach(r => {
      const asked = done.indexOf(r.id) >= 0;
      const blocked = r.to === "customer" && !role.can.requestCustomer;
      const T = TEAMS[r.to] || TEAMS.ops;
      h += '<div style="padding:12px 16px;border-bottom:1px solid var(--separator)">' +
        '<div class="row" style="gap:10px">' +
        '<span class="opt-ic" style="width:32px;height:32px;flex:none">' + icon(TEAM_ICON[r.to] || "building", 16) + '</span>' +
        '<div style="flex:1;min-width:160px"><div style="font-weight:560">' + esc(r.label) + '</div>' +
        '<div class="tiny">' + esc(T.label) + ' · ' + esc(T.via) + '</div></div>' +
        (asked ? pill("Response received", "green")
          : blocked ? '<button class="btn sm" disabled title="Not permitted for your role">Not permitted</button>'
          : '<button class="btn sm primary" data-act="ask" data-id="' + r.id + '">Request</button>') +
        '</div>';
      if (asked){
        const a = (w.asked || []).find(x => x.id === r.id);
        h += '<div class="' + (r.quote ? "paper" : "callout") + '" style="margin-top:10px">' +
          (r.quote ? '<h4>Customer statement — recorded by the relationship manager</h4>' : "") +
          '<div style="white-space:pre-wrap">' + esc(a.resp) + '</div>' +
          '<div class="tiny" style="margin-top:8px;opacity:.75">Received ' + esc(a.at) + ' · ' + esc(T.label) + '</div></div>';
      }
      h += '</div>';
    });
    h += '</div></section>';
  });
  return h;
}

/* --- screening panels ----------------------------------------------------- */
function screeningPanel(c){
  const w = work(c.id), done = askedIds(w);
  let h = '';
  const sanc = SANC_KIND[c.sanctions.kind], med = MEDIA_KIND[c.media.kind];
  h += card("Sanctions screening",
    done.indexOf("sanc") < 0
      ? '<p class="tiny">Names have not been referred for screening. Screening is a required step wherever a counterparty, ' +
        'beneficiary or jurisdiction is in scope.</p><button class="btn primary" data-act="ask" data-id="sanc">Refer names to the Sanctions Team</button>'
      : '<div class="row" style="margin-bottom:10px">' + pill(sanc.label, sanc.tone) + '</div>' +
        '<p>' + esc(sanc.body) + '</p>' +
        (c.sanctions.items||[]).map(i => '<div class="callout" style="margin-top:10px"><strong>' + esc(i.head) + '</strong><br>' +
          '<span class="tiny">' + esc(i.src) + ' · ' + esc(fmtDate(i.date)) + '</span><br>' + esc(i.body) + '</div>').join("") +
        '<div class="callout ' + (c.sanctions.kind === "potential" ? "warn" : "") + '" style="margin-top:12px">' +
        'A <strong>potential</strong> match is not a confirmed match. The Sanctions Team owns the determination. ' +
        'Recording a potential match as confirmed is a reportable quality failure.</div>');

  h += card("Adverse media and open-source research",
    done.indexOf("media") < 0
      ? '<p class="tiny">No open-source research has been carried out.</p>' +
        '<button class="btn primary" data-act="ask" data-id="media">Run adverse media research</button>'
      : '<div class="row" style="margin-bottom:10px">' + pill(med.label, med.tone) + '</div>' +
        '<p>' + esc(med.body) + '</p>' +
        (c.media.items||[]).map(i => '<div class="paper" style="margin-top:12px"><h4>' + esc(i.src) + ' · ' + esc(fmtDate(i.date)) + '</h4>' +
          '<div style="font-weight:600;margin-bottom:6px">' + esc(i.head) + '</div>' + esc(i.body) + '</div>').join("") +
        '<div class="callout info" style="margin-top:12px">Distinguish <strong>information requiring investigation</strong> from ' +
        '<strong>confirmed evidence</strong>. Reporting is not a finding. An investigation is not a conviction. ' +
        'Say in your disposition which you are relying on.</div>');
  return h;
}

/* --- evidence / documents ------------------------------------------------ */
function viewEvidence(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id); w.viewed.add("docs"); markSeen(c, "Evidence and documents reviewed", "docs");
  const done = askedIds(w);
  let h = caseStrip(c);
  h += '<p class="page-lead">Source of funds asks where the money in these particular transactions came from. Source of ' +
    'wealth asks how the customer accumulated their overall wealth. They are different questions and a document that answers ' +
    'one rarely answers the other.</p>';
  if (done.indexOf("sofsow") < 0 && done.indexOf("proof") < 0){
    h += card("", empty("❐","No documents have been obtained",
      "Request source of funds and source of wealth evidence from the case file. Documents are disclosed only when you ask for them.",
      '<button class="btn primary" data-act="ask" data-id="sofsow">Request source of funds / wealth evidence</button>'));
    return h;
  }
  const docs = caseDocs(c);
  h += '<div class="grid g2" style="align-items:start">' + docs.map(d =>
    '<div class="card"><div class="card-h"><h3>' + esc(d.title) + '</h3>' +
      (d.consistent ? pill("Consistent","green") : pill("Inconsistency identified","orange")) + '</div>' +
    '<div class="card-b"><div class="paper"><span class="stamp">EVIDENCE</span><h4>' + esc(d.type) + '</h4>' +
      '<div class="meta">Issuer: ' + esc(d.issuer || "—") + ' · Period: ' + esc(d.period || "—") +
      '<br>Obtained ' + esc(nowClock()) + ' · case ' + esc(c.alert.ref) + '</div>' +
      esc(d.body) + '</div>' +
    '<p class="tiny" style="margin-top:10px"><strong>Assessment:</strong> ' + esc(d.note) + '</p>' +
    '<p class="tiny" style="margin-top:4px"><strong>Independently verifiable?</strong> ' +
      (d.consistent
        ? esc(["tax","property","accounts","loan","investment"].indexOf(d.kind) >= 0
            ? "Yes — this can be checked against a record the customer does not control."
            : "Partly — it corroborates the account but originates with a party the customer deals with.")
        : "No — nothing here can be confirmed from an independent source.") +
    '</p></div></div>').join("") + '</div>';
  h += '<div class="callout warn" style="margin-top:16px">A document that is internally consistent is not the same as a ' +
    'document that is independently verifiable. Ask what could corroborate it from a source the customer does not control.</div>';
  return h;
}

/* --- notes (§17) ---------------------------------------------------------- */
const NOTE_KINDS = [["observation","Observation"],["analysis","Analysis"],["evidence","Evidence"],["redflag","Red flag"],
  ["hypothesis","Hypothesis"],["request","Information requested"],["explanation","Customer explanation"],
  ["assessment","Assessment"],["decision","Decision"]];
function viewNotes(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id);
  let h = caseStrip(c);
  h += '<div class="grid g-side"><div class="stack">' +
    card("Add an investigation note",
      '<label class="field"><span class="lbl">Note type</span><select class="inp" id="noteKind">' +
      NOTE_KINDS.map(k => '<option value="' + k[0] + '">' + k[1] + '</option>').join("") + '</select></label>' +
      '<label class="field"><span class="lbl">Note</span><textarea class="inp" id="noteBody" rows="4" ' +
      'placeholder="State what you observed, what it means, and what supports it. Write so that someone who has never seen the account can follow it."></textarea></label>' +
      '<button class="btn primary" data-act="addnote">Save note</button>');

  if (w.notes.length){
    h += cardFlush("Investigation notes (" + w.notes.length + ")",
      w.notes.map((n,i) => '<div style="padding:12px 16px;border-bottom:1px solid var(--separator)">' +
        '<div class="row" style="margin-bottom:6px">' + pill((NOTE_KINDS.find(k=>k[0]===n.kind)||["","Note"])[1],
          n.kind === "redflag" ? "red" : n.kind === "evidence" ? "green" : n.kind === "explanation" ? "brown" :
          n.kind === "decision" ? "purple" : "blue") +
        '<span class="tiny">' + esc(n.at) + '</span><span class="tb-grow"></span>' +
        '<button class="btn sm ghost" data-act="editnote" data-id="' + i + '">Edit</button>' +
        '<button class="btn sm ghost" data-act="delnote" data-id="' + i + '">Delete</button></div>' +
        '<div style="white-space:pre-wrap">' + esc(n.body) + '</div></div>').join(""));
  } else {
    h += card("", empty("✎","No notes recorded yet",
      "Professional documentation is contemporaneous. Record observations as you make them, not at the end."));
  }
  h += '</div><div class="stack">' +
    card("Case timeline", w.timeline.length
      ? '<ul class="timeline">' + w.timeline.slice().reverse().map(t =>
          '<li class="' + esc(t.k||"") + '"><span class="tm">' + esc(t.t) + '</span><span class="dt"></span>' +
          '<span class="tx">' + esc(t.x) + '</span></li>').join("") + '</ul>'
      : '<p class="tiny">Actions appear here as you take them.</p>') +
    card("Documentation standard",
      '<p class="tiny">Separate what you <em>observed</em> from what you <em>infer</em>. Attribute every fact to where it came ' +
      'from. Where the customer has given an explanation, record it in their words and then record what tests it. ' +
      'Avoid absolute language: you are recording suspicion for the MLRO to consider, not making a finding of guilt.</p>');
  h += '</div></div>';
  return h;
}
