
/* --------------------------------------------------------------------------
   19. Customer 360  (§8)
   -------------------------------------------------------------------------- */
function viewCustomer(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id); w.viewed.add("customer"); markSeen(c, "Customer 360 reviewed", "customer");
  const cu = c.customer, tab = S.tab === "overview" ? "profile" : S.tab;
  let h = caseStrip(c);
  h += '<div class="card"><div class="tabs" role="tablist">' +
    [["profile","Profile"],["products","Products"],["expected","Expected activity"],["kyc","KYC"],["history","History"]]
      .map(t => '<button role="tab" data-act="tab" data-id="' + t[0] + '" aria-selected="' + (tab===t[0]) + '">' + t[1] + '</button>').join("") +
    '</div><div class="card-b">';

  if (tab === "profile"){
    h += '<div class="grid g2"><div>' + dl([
      ["Customer ID", cu.id], ["Name", cu.name], ["Age", cu.age], ["Customer since", cu.since],
      ["Occupation", cu.occ], ["Employer / business", cu.employer], ["Declared income / turnover", cu.income],
      ["Address", cu.address], ["Location", cu.city], ["Country", ctryName(cu.cc)]
    ]) + '</div><div>' + dl([
      ["Customer type", cu.ctype], ["Risk rating", riskPill(cu.risk), "html"],
      ["Principal product", cu.product], ["Stated account purpose", cu.purpose],
      ["Institution", c.institution.name], ["Reporting currency", c.ccy],
      ["Politically exposed", cu.kyc.pep]
    ]) + '</div></div>';
    if (cu.extra){
      const shown = ["Customer","Age","Occupation","Customer since","Risk rating"];
      const rest = Object.keys(cu.extra).filter(k => shown.indexOf(k) < 0);
      if (rest.length) h += '<h4 class="eyebrow" style="margin:18px 0 8px">Full onboarding record</h4>' +
        dl(rest.map(k => [k, cu.extra[k]]));
    }
  }
  else if (tab === "products"){
    h += '<div class="tw"><table class="tbl"><thead><tr><th>Product</th><th>Number</th><th>Opened</th><th>Status</th><th class="num">Balance</th></tr></thead><tbody>' +
      cu.products.map(p => '<tr><td>' + esc(p.name) + '</td><td class="mono">' + esc(p.num) + '</td><td>' + esc(p.opened) + '</td>' +
        '<td>' + pill(p.status, "green") + '</td><td class="num">' + esc(money(p.bal, c.ccy)) + '</td></tr>').join("") +
      '</tbody></table></div>';
    h += '<div class="callout info" style="margin-top:14px">Products available at this institution: ' +
      esc(c.institution.products.join(", ")) + '. Only products held by this customer are listed above.</div>';
  }
  else if (tab === "expected"){
    h += '<p class="page-lead">Expected activity is what the customer told the institution they would do. The monitoring ' +
      'engine compares realised behaviour against these values. Where they are stale, the comparison is unreliable — ' +
      'that is a data question before it is a suspicion.</p>' +
      dl([["Expected monthly turnover", cu.expected.turnover], ["Expected transaction types", cu.expected.types],
          ["Expected geographies", cu.expected.geos], ["Expected counterparties", cu.expected.cps],
          ["Expected cash activity", cu.expected.cash], ["Recorded at", cu.kyc.review]]);
    const st = c.stats;
    h += '<div class="callout warn" style="margin-top:14px"><strong>Realised in the review period:</strong> ' +
      st.n + ' transactions, ' + esc(money(st.inV, c.ccy)) + ' credited and ' + esc(money(st.outV, c.ccy)) +
      ' debited across ' + st.days + ' days, with ' + st.cps.length + ' counterparties in ' +
      st.ccs.map(ctryName).join(", ") + '.</div>';
  }
  else if (tab === "kyc"){
    h += dl([["Identity verification", cu.kyc.idv], ["Address verification", cu.kyc.adv],
      ["Occupation recorded", cu.kyc.occ], ["Source of funds (declared)", cu.kyc.sof],
      ["Source of wealth (declared)", cu.kyc.sow], ["Last KYC review", cu.kyc.review],
      ["Risk assessment", cu.kyc.assess], ["PEP status", cu.kyc.pep]]);
    h += '<div class="callout" style="margin-top:14px">A declaration is not evidence. To test source of funds or source of ' +
      'wealth you have to request documents through the investigation actions on the case file.</div>';
  }
  else {
    h += dl([["Previous alerts", cu.history.alerts], ["Previous cases", cu.history.cases],
      ["Previous enhanced due diligence", cu.history.edd], ["Previous customer explanations", cu.history.expl],
      ["Risk rating changes", cu.history.risk]]);
    const prior = completedList().filter(r => r.customer === cu.name);
    if (prior.length) h += '<h4 class="eyebrow" style="margin:18px 0 8px">Cases you have completed on this customer</h4>' +
      '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Decision</th><th class="num">QA</th></tr></thead><tbody>' +
      prior.map(p => '<tr><td class="mono">' + esc(p.ref) + '</td><td>' + esc(OUTCOME_NAME[p.decision]||"—") + '</td>' +
      '<td class="num">' + p.score + '</td></tr>').join("") + '</tbody></table></div>';
  }
  h += '</div></div>';
  return h;
}

/* --------------------------------------------------------------------------
   20. Transaction explorer  (§9)
   -------------------------------------------------------------------------- */
function applyTxnFilters(c){
  const f = S.txnF;
  let t = c.txns.filter(x => {
    if (f.q){ const q = f.q.toLowerCase();
      if ((x.cp + " " + x.desc + " " + x.m + " " + (x.note||"") + " " + (x.loc||"") + " " + x.id).toLowerCase().indexOf(q) < 0) return false; }
    if (f.dir && x.dir !== f.dir) return false;
    if (f.cc && x.cc !== f.cc) return false;
    if (f.method && x.m !== f.method) return false;
    if (f.channel && x.ch !== f.channel) return false;
    if (f.cp && x.cp !== f.cp) return false;
    if (f.min && x.amt < Number(f.min)) return false;
    if (f.max && x.amt > Number(f.max)) return false;
    if (f.from && x.d < f.from) return false;
    if (f.to && x.d > f.to) return false;
    return true;
  });
  const k = f.sort, a = f.asc ? 1 : -1;
  t.sort((x,y) => { const vx = k === "amt" ? x.amt : k === "cp" ? x.cp.toLowerCase() : k === "bal" ? x.bal : (x.d + x.t);
    const vy = k === "amt" ? y.amt : k === "cp" ? y.cp.toLowerCase() : k === "bal" ? y.bal : (y.d + y.t);
    return (vx < vy ? -1 : vx > vy ? 1 : 0) * a; });
  return t;
}
function txnTh(key, label, num){
  const on = S.txnF.sort === key;
  return '<th class="sortable' + (num?" num":"") + '" data-act="tsort" data-id="' + key + '" aria-sort="' +
    (on ? (S.txnF.asc?"ascending":"descending") : "none") + '">' + esc(label) +
    (on ? '<span class="arrow" aria-hidden="true">' + (S.txnF.asc?"↑":"↓") + '</span>' : "") + '</th>';
}
function viewTxn(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id); w.viewed.add("txn"); markSeen(c, "Transaction ledger reviewed", "txn");
  const f = S.txnF, rows = applyTxnFilters(c), st = c.stats;
  const sel = w.flags;

  let h = caseStrip(c);
  h += '<div class="grid g4" style="margin-bottom:14px">' +
    tile("Transactions", st.n, st.nIn + " credits · " + st.nOut + " debits") +
    tile("Credited", moneyShort(st.inV, c.ccy), "over " + st.days + " days", "green") +
    tile("Debited", moneyShort(st.outV, c.ccy), "out / in ratio " + pct(st.ratio), "red") +
    tile("Lowest balance", moneyShort(st.minBal, c.ccy), "residual retained") + '</div>';

  h += '<div class="card" style="margin-bottom:14px"><div class="card-b tight"><div class="row" style="gap:8px">' +
    '<div class="search" style="flex:1;min-width:170px">' + icon("search", 16) + '<input class="inp" data-tf="q" value="' + esc(f.q) + '" placeholder="Search counterparty, description, reference"></div>' +
    '<select class="inp" data-tf="dir" style="width:auto"><option value="">Debit and credit</option>' +
      '<option value="C"' + (f.dir==="C"?" selected":"") + '>Credits only</option>' +
      '<option value="D"' + (f.dir==="D"?" selected":"") + '>Debits only</option></select>' +
    '<select class="inp" data-tf="cc" style="width:auto"><option value="">All countries</option>' +
      st.ccs.map(x => '<option value="' + x + '"' + (f.cc===x?" selected":"") + '>' + esc(ctryName(x)) + '</option>').join("") + '</select>' +
    '<select class="inp" data-tf="method" style="width:auto"><option value="">All methods</option>' +
      st.methods.map(x => '<option value="' + esc(x) + '"' + (f.method===x?" selected":"") + '>' + esc(x) + '</option>').join("") + '</select>' +
    '<select class="inp" data-tf="channel" style="width:auto"><option value="">All channels</option>' +
      st.channels.map(x => '<option value="' + esc(x) + '"' + (f.channel===x?" selected":"") + '>' + esc(x) + '</option>').join("") + '</select>' +
    '<select class="inp" data-tf="cp" style="width:auto"><option value="">All counterparties</option>' +
      st.cps.map(x => '<option value="' + esc(x) + '"' + (f.cp===x?" selected":"") + '>' + esc(x.length>34?x.slice(0,32)+"…":x) + '</option>').join("") + '</select>' +
    '<input class="inp" data-tf="min" style="width:96px" inputmode="numeric" placeholder="Min" value="' + esc(f.min) + '">' +
    '<input class="inp" data-tf="max" style="width:96px" inputmode="numeric" placeholder="Max" value="' + esc(f.max) + '">' +
    '<input class="inp" data-tf="from" type="date" style="width:auto" value="' + esc(f.from) + '" aria-label="From date">' +
    '<input class="inp" data-tf="to" type="date" style="width:auto" value="' + esc(f.to) + '" aria-label="To date">' +
    '<select class="inp" data-tf="group" style="width:auto"><option value="">No grouping</option>' +
      '<option value="cp"' + (f.group==="cp"?" selected":"") + '>Group by counterparty</option>' +
      '<option value="d"' + (f.group==="d"?" selected":"") + '>Group by day</option>' +
      '<option value="m"' + (f.group==="m"?" selected":"") + '>Group by method</option>' +
      '<option value="cc"' + (f.group==="cc"?" selected":"") + '>Group by country</option></select>' +
    '<button class="btn sm ghost" data-act="cleartf">Clear</button>' +
    '</div></div></div>';

  h += '<div class="row tiny" style="margin-bottom:10px"><span>' + rows.length + ' of ' + c.txns.length + ' transactions · ' +
    esc(money(sum(rows.filter(x=>x.dir==="C"),x=>x.amt), c.ccy)) + ' in, ' +
    esc(money(sum(rows.filter(x=>x.dir==="D"),x=>x.amt), c.ccy)) + ' out</span>' +
    '<span class="tb-grow"></span><span class="dim">' + sel.size + ' transaction(s) flagged as relevant to the investigation.</span></div>';

  if (f.group){
    const key = x => f.group === "cp" ? x.cp : f.group === "d" ? x.d : f.group === "m" ? x.m : ctryName(x.cc);
    const g = {}; rows.forEach(x => { (g[key(x)] = g[key(x)] || []).push(x); });
    h += '<section class="card"><div class="card-b flush"><div class="tw"><table class="tbl"><thead><tr>' +
      '<th>Group</th><th class="num">Count</th><th class="num">Credits</th><th class="num">Debits</th><th class="num">Net</th></tr></thead><tbody>' +
      Object.keys(g).sort((a,b) => sum(g[b],x=>x.amt) - sum(g[a],x=>x.amt)).map(k => {
        const inV = sum(g[k].filter(x=>x.dir==="C"),x=>x.amt), outV = sum(g[k].filter(x=>x.dir==="D"),x=>x.amt);
        return '<tr class="clickable" data-act="ungroup" data-id="' + esc(k) + '"><td>' + esc(k) + '</td>' +
          '<td class="num">' + g[k].length + '</td><td class="num credit">' + esc(money(inV,c.ccy)) + '</td>' +
          '<td class="num debit">' + esc(money(outV,c.ccy)) + '</td>' +
          '<td class="num">' + esc(money(inV-outV,c.ccy)) + '</td></tr>'; }).join("") +
      '</tbody></table></div></div></section>';
    return h;
  }

  h += '<section class="card"><div class="card-b flush"><div class="tw"><table class="tbl dense"><thead><tr>' +
    '<th style="width:34px" title="Flag as relevant">⚑</th><th>ID</th>' + txnTh("d","Date / time") + txnTh("amt","Amount", true) +
    '<th>Dir</th>' + txnTh("cp","Counterparty") + '<th>Country</th><th>Method</th><th>Channel</th><th>Description</th>' +
    txnTh("bal","Balance", true) + '</tr></thead><tbody>' +
    rows.map(x => '<tr class="' + (sel.has(x.id) ? "sel " : "") + 'clickable" data-act="txndetail" data-id="' + x.id + '">' +
      '<td><button class="btn sm ghost" data-act="flagtxn" data-id="' + x.id + '" aria-pressed="' + sel.has(x.id) + '" ' +
        'aria-label="Flag transaction ' + x.id + '" style="padding:0 4px;min-height:20px">' + (sel.has(x.id) ? "⚑" : "⚐") + '</button></td>' +
      '<td class="mono dim2">' + x.id + '</td>' +
      '<td class="nowrap">' + esc(fmtDateShort(x.d)) + ' <span class="dim2">' + esc(x.t) + '</span></td>' +
      '<td class="num nowrap ' + (x.dir==="C"?"credit":"debit") + '">' + esc(money(x.amt, c.ccy)) + '</td>' +
      '<td>' + pill(x.dir==="C"?"Cr":"Dr", x.dir==="C"?"green":"red") + '</td>' +
      '<td>' + esc(x.cp) + (x.note ? ' <span class="pill orange" title="' + esc(x.note) + '">note</span>' : "") + '</td>' +
      '<td class="nowrap">' + esc(ctryName(x.cc)) + (isHighRisk(x.cc) ? ' ' + pill("HR","orange") : "") + '</td>' +
      '<td class="dim nowrap">' + esc(x.m) + '</td>' +
      '<td class="dim nowrap">' + esc(x.ch||"—") + '</td>' +
      '<td class="dim">' + esc(x.desc||"—") + '</td>' +
      '<td class="num">' + esc(money(x.bal, c.ccy)) + '</td></tr>').join("") +
    '</tbody></table></div></div></section>';
  h += '<p class="tiny" style="margin-top:10px">' + esc(c.txnNote) + '</p>';
  return h;
}
function txnDetailModal(c, id){
  const x = c.txns.find(t => t.id === id); if (!x) return;
  const w = work(c.id);
  openModal('<div class="modal-h"><h3>Transaction ' + esc(c.alert.ref) + '-' + x.id + '</h3>' +
    '<button class="btn sm ghost" data-act="close-modal" aria-label="Close">✕</button></div><div class="modal-b">' +
    dl([["Transaction ID", c.alert.ref + "-" + String(x.id).padStart(4,"0")],
        ["Timestamp", fmtDate(x.d) + " " + x.t],
        ["Amount", money(x.amt, c.ccy) + " " + c.ccy],
        ["Direction", x.dir === "C" ? "Credit (funds in)" : "Debit (funds out)"],
        ["Sender", x.dir === "C" ? x.cp : c.customer.name],
        ["Receiver", x.dir === "C" ? c.customer.name : x.cp],
        ["Country", ctryName(x.cc) + (isHighRisk(x.cc) ? " — on the institution's higher-risk list" : "")],
        ["Channel", x.ch || "—"], ["Payment method", x.m],
        ["Description / reference", x.desc || "—"],
        ["Beneficiary", x.dir === "D" ? x.cp : "—"],
        ["Location", x.loc || "—"],
        ["Balance after", money(x.bal, c.ccy)],
        ["Status", "Settled"],
        ["Operational note", x.note || "None"]]) +
    '<div class="btn-row" style="margin-top:16px">' +
    '<button class="btn ' + (w.flags.has(x.id) ? "" : "primary") + '" data-act="flagtxn" data-id="' + x.id + '">' +
      (w.flags.has(x.id) ? "Remove flag" : "Flag as relevant to the investigation") + '</button>' +
    '<button class="btn" data-act="cp-from-txn" data-id="' + esc(x.cp) + '">Investigate ' + esc(x.cp.length>26?x.cp.slice(0,24)+"…":x.cp) + '</button>' +
    '<button class="btn ghost" data-act="close-modal">Close</button></div></div>');
}
