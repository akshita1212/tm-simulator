
/* --------------------------------------------------------------------------
   21. Entity search — graph, counterparty 360, beneficiary investigation
        (§10, §11, §12)
   -------------------------------------------------------------------------- */
const NODE_COLOR = { customer:"#B0823A", entity:"#6941C6", party:"#0E6F8A", cash:"#B54708", address:"#8A8A87" };
const NODE_SHAPE = { customer:"Account under review", entity:"Company", party:"Individual", cash:"Cash channel", address:"Shared attribute" };

/* shape carries the node kind, so the graph does not rely on colour alone */
function nodeShape(kind, x, y, r, col){
  if (kind === "entity")   return '<rect x="' + (x-r) + '" y="' + (y-r*0.82) + '" width="' + (r*2) + '" height="' + (r*1.64) + '" rx="4" fill="' + col + '22" stroke="' + col + '" stroke-width="2"/>';
  if (kind === "cash")     return '<path d="M' + x + ' ' + (y-r) + ' L' + (x+r) + ' ' + (y+r*0.72) + ' L' + (x-r) + ' ' + (y+r*0.72) + ' Z" fill="' + col + '22" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>';
  if (kind === "address")  return '<rect x="' + (x-r) + '" y="' + (y-r*0.45) + '" width="' + (r*2) + '" height="' + (r*0.9) + '" rx="3" fill="' + col + '22" stroke="' + col + '" stroke-width="2" stroke-dasharray="4 3"/>';
  if (kind === "customer") return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '1f" stroke="' + col + '" stroke-width="2.5"/>' +
                                  '<circle cx="' + x + '" cy="' + y + '" r="' + (r*0.52) + '" fill="none" stroke="' + col + '" stroke-width="2"/>';
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '22" stroke="' + col + '" stroke-width="2"/>';
}

function graphSVG(c){
  const g = c.graph;
  const others = g.nodes.filter(n => n.id !== "CUST");
  const inN  = others.filter(n => g.edges.some(e => e.a === n.id && e.b === "CUST"));
  const outN = others.filter(n => g.edges.some(e => e.a === "CUST" && e.b === n.id) && inN.indexOf(n) < 0);
  const rest = others.filter(n => inN.indexOf(n) < 0 && outN.indexOf(n) < 0);

  const rowH = 62, pad = 56;
  const maxCol = Math.max(inN.length, outN.length, 1);
  const W = 940;
  const H = clamp(pad*2 + maxCol*rowH + (rest.length ? 96 : 0), 380, 1500);
  const cx = W/2, cy = pad + (maxCol*rowH)/2;
  const R = { CUST:26 }, pos = { CUST:[cx, cy] };

  function place(list, xMid){
    const top = cy - ((list.length-1)*rowH)/2;
    list.forEach((n,i) => {
      pos[n.id] = [ xMid + (i % 2 ? 46 : -46) * (xMid < cx ? 1 : -1), top + i*rowH ];
      R[n.id] = 16;
    });
  }
  place(inN, 168); place(outN, W-168);
  rest.forEach((n,i) => { pos[n.id] = [cx - ((rest.length-1)*120)/2 + i*120, cy + (maxCol*rowH)/2 + 62]; R[n.id] = 15; });

  /* stop each edge at the node boundary so the arrowhead is visible */
  function trim(a, b, rb){
    const dx = b[0]-a[0], dy = b[1]-a[1], d = Math.sqrt(dx*dx+dy*dy) || 1;
    return [ b[0] - dx/d*(rb+7), b[1] - dy/d*(rb+7) ];
  }

  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Relationship graph for ' + esc(c.customer.name) + '">';
  s += '<defs><marker id="ar" viewBox="0 0 9 9" refX="8" refY="4.5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">' +
       '<path d="M0 0 L9 4.5 L0 9 z" fill="var(--label-3)"/></marker></defs>';

  g.edges.forEach((e, ei) => {
    const a0 = pos[e.a], b0 = pos[e.b]; if (!a0 || !b0) return;
    const b1 = trim(a0, b0, R[e.b] || 16);
    const a1 = trim(b0, a0, R[e.a] || 16);
    s += '<path class="gedge" d="M' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1) + ' L' + b1[0].toFixed(1) + ' ' + b1[1].toFixed(1) + '" ' +
      'stroke="var(--label-4)" stroke-width="' + (e.v ? clamp(1.2 + Math.log10(Math.max(10,e.v))/2.2, 1.2, 4.5).toFixed(1) : 1.4) + '" ' +
      (e.dashed ? 'stroke-dasharray="5 4" ' : "") + 'marker-end="url(#ar)"/>';
    if (e.label){
      const t = 0.34;
      const lx = a1[0] + (b1[0]-a1[0])*t, ly = a1[1] + (b1[1]-a1[1])*t;
      s += '<text x="' + lx.toFixed(1) + '" y="' + (ly-5).toFixed(1) + '" text-anchor="middle" fill="var(--label-2)" ' +
           'font-size="9" font-weight="600" paint-order="stroke" stroke="var(--surface-2)" stroke-width="3">' + esc(e.label) + '</text>';
    }
  });

  g.nodes.forEach(n => {
    const p = pos[n.id]; if (!p) return;
    const col = NODE_COLOR[n.kind] || "#8e8e93";
    const r = R[n.id] || 16;
    const label = n.label.length > 20 ? n.label.slice(0,18) + "\u2026" : n.label;
    s += '<g class="gnode" data-act="gnode" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' +
         esc(n.label + " — " + (NODE_SHAPE[n.kind]||"party")) + '">';
    s += nodeShape(n.kind, p[0], p[1], r, col);
    s += '<text x="' + p[0] + '" y="' + (p[1]+r+13) + '" text-anchor="middle" fill="var(--label)" ' +
         'paint-order="stroke" stroke="var(--surface-2)" stroke-width="3">' + esc(label) + '</text>';
    if (n.sub) s += '<text x="' + p[0] + '" y="' + (p[1]+r+23) + '" text-anchor="middle" fill="var(--label-3)" font-size="8.5" ' +
         'paint-order="stroke" stroke="var(--surface-2)" stroke-width="3">' + esc(n.sub) + '</text>';
    s += '</g>';
  });
  s += '</svg>';
  return s;
}

function viewEntity(){
  const c = getCase(S.active); if (!c) return needCase();
  const w = work(c.id); w.viewed.add("entities"); markSeen(c, "Counterparty and entity records reviewed", "entity");
  if (S.entityView) return caseStrip(c) + entityDetail(c, S.entityView);

  const cps = c.counterparties;
  let h = caseStrip(c);
  h += '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Relationship graph</h3>' +
    '<span class="tiny">Select any node to investigate it</span></div>' +
    '<div class="graph-wrap">' + graphSVG(c) + '</div>' +
    '<div class="glegend">' + Object.keys(NODE_COLOR).map(k =>
      '<span><i style="background:' + NODE_COLOR[k] + ';border-radius:' + (k==="entity"?"2px":k==="address"?"1px":"50%") + '"></i>' +
      (k === "customer" ? "Customer / account (ringed circle)" : k === "entity" ? "Company (square)" :
       k === "party" ? "Individual counterparty (circle)" : k === "cash" ? "Cash channel (triangle)" :
       "Shared attribute (dashed)") + '</span>').join("") +
    '<span class="tb-grow"></span><span>Edge width reflects value moved. Dashed edges are non-payment links such as a shared address, ' +
    'telephone number, director or device.</span></div></div>';

  h += '<div class="callout" style="margin-bottom:16px">The graph shows relationships. It does not interpret them. ' +
    'A dense network is not evidence of anything on its own — establish what each link is, and whether it has an ordinary ' +
    'commercial or personal explanation, before you draw a conclusion from the shape.</div>';

  h += '<section class="card"><div class="card-h"><h3>Counterparties</h3><span class="tiny">' + cps.length + ' identified</span></div>' +
    '<div class="card-b flush"><div class="tw"><table class="tbl"><thead><tr>' +
    '<th>Name</th><th>Type</th><th>Country</th><th class="num">In</th><th class="num">Out</th><th class="num">Txns</th>' +
    '<th>First seen</th><th>Last seen</th><th>Declared?</th></tr></thead><tbody>' +
    cps.map((x,i) => '<tr class="clickable" data-act="entity" data-id="' + i + '">' +
      '<td style="font-weight:540">' + esc(x.name) + '</td>' +
      '<td>' + pill(x.type === "cash" ? "Cash" : x.type === "entity" ? "Company" : "Individual",
        x.type === "entity" ? "purple" : x.type === "cash" ? "brown" : "teal") + '</td>' +
      '<td class="nowrap">' + esc(ctryName(x.cc)) + (isHighRisk(x.cc) ? ' ' + pill("Higher risk","orange") : "") + '</td>' +
      '<td class="num credit">' + (x.inV ? esc(money(x.inV, c.ccy)) : "—") + '</td>' +
      '<td class="num debit">' + (x.outV ? esc(money(x.outV, c.ccy)) : "—") + '</td>' +
      '<td class="num">' + x.n + '</td>' +
      '<td class="nowrap dim">' + esc(fmtDateShort(x.first)) + '</td>' +
      '<td class="nowrap dim">' + esc(fmtDateShort(x.last)) + '</td>' +
      '<td>' + (x.benign ? pill("Declared","green") : pill("Not declared","")) + '</td></tr>').join("") +
    '</tbody></table></div></div></section>';

  const benes = c.beneficiaries;
  if (benes.length) h += '<section class="card"><div class="card-h"><h3>Beneficiaries</h3>' +
    '<span class="tiny">Payees the customer sent value to</span></div><div class="card-b flush"><div class="tw">' +
    '<table class="tbl"><thead><tr><th>Beneficiary</th><th>Country</th><th>Account</th><th>Added to payee list</th>' +
    '<th class="num">Payments</th><th class="num">Total</th><th>Stated purpose</th></tr></thead><tbody>' +
    benes.map(b => '<tr class="clickable" data-act="entity" data-id="' + c.counterparties.findIndex(x=>x.name===b.name) + '">' +
      '<td style="font-weight:540">' + esc(b.name) + '</td><td>' + esc(ctryName(b.cc)) + '</td>' +
      '<td class="mono dim">' + esc(b.account) + '</td>' +
      '<td>' + (b.added ? esc(fmtDate(b.added)) : '<span class="dim2">not held</span>') + '</td>' +
      '<td class="num">' + b.n + '</td><td class="num">' + esc(money(b.total, c.ccy)) + '</td>' +
      '<td class="dim">' + esc(b.purpose) + '</td></tr>').join("") +
    '</tbody></table></div></div></section>';
  return h;
}

function entityDetail(c, idx){
  const x = c.counterparties[Number(idx)];
  if (!x) { S.entityView = null; return viewEntity(); }
  const rows = c.txns.filter(t => t.cp === x.name);
  const bene = c.beneficiaries.find(b => b.name === x.name);
  let h = '<div class="row" style="margin-bottom:14px"><button class="btn sm" data-act="entity-back">← All entities</button>' +
    '<span class="tb-grow"></span>' + pill(x.type === "entity" ? "Company" : x.type === "cash" ? "Cash channel" : "Individual",
      x.type === "entity" ? "purple" : x.type === "cash" ? "brown" : "teal") + '</div>';

  h += '<div class="grid g-side"><div class="stack">' +
    card(x.name, dl([
      ["Name", x.name],
      ["Type", x.type === "entity" ? "Company / legal entity" : x.type === "cash" ? "Cash channel (not a party)" : "Individual"],
      ["Customer of this institution", x.customer ? "Yes" : "No — information limited to what the payment messages and public records show"],
      ["Country", ctryName(x.cc) + (isHighRisk(x.cc) ? " — on the institution's higher-risk jurisdiction list" : "")],
      ["Occupation / business", x.biz || "Not established from available records"],
      ["Relationship to the customer", x.rel],
      ["Transaction volume", money(x.total, c.ccy) + " (" + money(x.inV, c.ccy) + " in, " + money(x.outV, c.ccy) + " out)"],
      ["Transaction frequency", x.n + " transactions over " + Math.max(1, Math.round((new Date(x.last)-new Date(x.first))/86400000)) + " days"],
      ["First transaction", fmtDate(x.first)],
      ["Most recent transaction", fmtDate(x.last)],
      ["Payment methods used", x.methods.join(", ")],
      ["Related accounts", x.accounts || "None identified from the records held"],
      ["Screening result", x.screening]
    ])) ;
  if (bene) h += card("Beneficiary record", dl([
      ["Beneficiary name", bene.name], ["Account", bene.account],
      ["Date added to the payee list", bene.added ? fmtDate(bene.added) : "Not held on the payee record"],
      ["Payments made", bene.n + " totalling " + money(bene.total, c.ccy)],
      ["First payment", fmtDate(bene.first)], ["Most recent payment", fmtDate(bene.last)],
      ["Payment purpose stated by the customer", bene.purpose],
      ["Relationship stated by the customer", bene.rel]
    ]) + (bene.added ? '<div class="callout ' + (daysBetween(bene.added, bene.first) <= 2 ? "warn" : "") + '" style="margin-top:12px">' +
      'Time between the payee being added and first used: <strong>' + daysBetween(bene.added, bene.first) + ' day(s)</strong>.' +
      (daysBetween(bene.added, bene.first) <= 2 ? " A payee added and used immediately is worth asking the customer about; it is not conclusive on its own." : "") +
      '</div>' : ""));

  if (x.note) h += card("Investigation note on this entity", '<p>' + esc(x.note) + '</p>');
  if (x.flags && x.flags.length) h += card("Risk indicators recorded against this entity",
    '<ul style="margin:0;padding-left:18px">' + x.flags.map(f => '<li>' + esc(f) + '</li>').join("") + '</ul>');

  h += cardFlush("Transactions with this entity", '<div class="tw"><table class="tbl dense"><thead><tr>' +
    '<th>ID</th><th>Date</th><th class="num">Amount</th><th>Dir</th><th>Method</th><th>Description</th><th class="num">Balance</th>' +
    '</tr></thead><tbody>' + rows.map(t => '<tr class="clickable" data-act="txndetail" data-id="' + t.id + '">' +
      '<td class="mono dim2">' + t.id + '</td><td class="nowrap">' + esc(fmtDateShort(t.d)) + ' <span class="dim2">' + esc(t.t) + '</span></td>' +
      '<td class="num ' + (t.dir==="C"?"credit":"debit") + '">' + esc(money(t.amt, c.ccy)) + '</td>' +
      '<td>' + pill(t.dir==="C"?"Cr":"Dr", t.dir==="C"?"green":"red") + '</td>' +
      '<td class="dim">' + esc(t.m) + '</td><td class="dim">' + esc(t.desc||"—") + '</td>' +
      '<td class="num">' + esc(money(t.bal, c.ccy)) + '</td></tr>').join("") + '</tbody></table></div>');
  h += '</div>';

  h += '<div class="stack">' +
    card("What this record can and cannot tell you",
      '<p class="tiny">Where a counterparty is not a customer of this institution, the information available is limited to what ' +
      'the payment messages carry and what public records show. Absence of adverse information about a non-customer is not ' +
      'evidence that the counterparty is legitimate — it usually means nothing has been looked for.</p>' +
      '<p class="tiny">Some counterparties in this case are entirely legitimate. Some are not. Some will look suspicious and ' +
      'turn out to have an ordinary explanation. Test each one rather than reading the network as a whole.</p>') +
    card("Ask about this entity",
      '<div class="btn-row"><button class="btn sm" data-act="nav" data-id="cases">Open investigation actions</button>' +
      '<button class="btn sm" data-act="notefor" data-id="' + esc(x.name) + '">Record a note on this entity</button></div>');
  h += '</div></div>';
  return h;
}
function daysBetween(a, b){ return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)); }
