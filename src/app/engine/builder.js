
/* --------------------------------------------------------------------------
   6. Case builder
   Expands a compact seed into the full case object the workspace consumes:
   alert, customer 360, ledger, counterparties, beneficiaries, relationship
   graph, evidence documents, information requests, screening results.
   -------------------------------------------------------------------------- */

const COUNTRY = {
  IN:"India", GB:"United Kingdom", US:"United States", AE:"United Arab Emirates", SG:"Singapore",
  DE:"Germany", NL:"Netherlands", CY:"Cyprus", MT:"Malta", EE:"Estonia", LT:"Lithuania", LV:"Latvia",
  RU:"Russia", TR:"Türkiye", HK:"Hong Kong", CN:"China", MX:"Mexico", CO:"Colombia", GT:"Guatemala",
  HN:"Honduras", PH:"Philippines", NG:"Nigeria", GH:"Ghana", KE:"Kenya", ZA:"South Africa",
  PK:"Pakistan", BD:"Bangladesh", LK:"Sri Lanka", NP:"Nepal", TH:"Thailand", VN:"Vietnam",
  CH:"Switzerland", LU:"Luxembourg", IE:"Ireland", ES:"Spain", PT:"Portugal", IT:"Italy", FR:"France",
  PL:"Poland", RO:"Romania", BG:"Bulgaria", RS:"Serbia", GE:"Georgia", AZ:"Azerbaijan", KZ:"Kazakhstan",
  UA:"Ukraine", BY:"Belarus", IR:"Iran", SY:"Syria", KP:"North Korea", MM:"Myanmar", AF:"Afghanistan",
  PA:"Panama", VG:"British Virgin Islands", KY:"Cayman Islands", SC:"Seychelles", MU:"Mauritius",
  BS:"Bahamas", BZ:"Belize", AU:"Australia", NZ:"New Zealand", CA:"Canada", BR:"Brazil", AR:"Argentina",
  DO:"Dominican Republic", JM:"Jamaica", MY:"Malaysia", ID:"Indonesia", JP:"Japan", KR:"South Korea",
  QA:"Qatar", KW:"Kuwait", SA:"Saudi Arabia", BH:"Bahrain", OM:"Oman", EG:"Egypt", MA:"Morocco",
  SE:"Sweden", NO:"Norway", DK:"Denmark", FI:"Finland", AT:"Austria", BE:"Belgium", GR:"Greece", CZ:"Czechia"
};
/* jurisdictions the simulated institution treats as elevated risk */
const HIGH_RISK_CC = ["IR","KP","SY","MM","AF","RU","BY","PA","VG","KY","SC","CY","MT","AE","TR","LB","NG","GE","AZ","BZ","BS","LV","EE"];
function ctryName(cc){ return COUNTRY[cc] || cc; }
function isHighRisk(cc){ return HIGH_RISK_CC.indexOf(cc) >= 0; }

/* Standard information-request recipients (§14) */
const TEAMS = {
  customer:{ label:"Customer", via:"via relationship manager", glyph:"👤", tone:"blue" },
  rm:      { label:"Relationship Manager", via:"internal", glyph:"🤝", tone:"teal" },
  kyc:     { label:"KYC / Onboarding Team", via:"internal", glyph:"🗂", tone:"purple" },
  fraud:   { label:"Fraud Team", via:"internal", glyph:"🛡", tone:"orange" },
  sanctions:{label:"Sanctions Team", via:"internal", glyph:"⚖", tone:"red" },
  aml:     { label:"Internal AML / FIU liaison", via:"internal", glyph:"🔍", tone:"brown" },
  ops:     { label:"Branch / Operations", via:"internal", glyph:"🏛", tone:"" },
  corr:    { label:"Correspondent Banking", via:"internal", glyph:"🌐", tone:"teal" },
  external:{ label:"Open-source / external", via:"research", glyph:"📰", tone:"" }
};

/* ---- helpers over a ledger ---------------------------------------------- */
function ledgerStats(txns){
  const cr = txns.filter(t => t.dir === "C"), db = txns.filter(t => t.dir === "D");
  const inV = sum(cr, t => t.amt), outV = sum(db, t => t.amt);
  return {
    n: txns.length, nIn: cr.length, nOut: db.length, inV, outV,
    total: inV + outV,
    ratio: inV ? outV / inV : 0,
    from: txns.length ? txns[0].d : "", to: txns.length ? txns[txns.length-1].d : "",
    days: txns.length ? Math.max(1, Math.round((new Date(txns[txns.length-1].d) - new Date(txns[0].d)) / 86400000)) : 1,
    cps: uniq(txns.map(t => t.cp)),
    ccs: uniq(txns.map(t => t.cc)),
    methods: uniq(txns.map(t => t.m)),
    channels: uniq(txns.map(t => t.ch).filter(Boolean)),
    maxCr: cr.length ? Math.max.apply(null, cr.map(t=>t.amt)) : 0,
    minBal: txns.length ? Math.min.apply(null, txns.map(t=>t.bal)) : 0
  };
}

/* counterparty records derived from the ledger, enriched by seed overrides */
function buildCounterparties(txns, seed, ccy, rnd){
  const map = new Map();
  txns.forEach(t => {
    const k = t.cp;
    if (!map.has(k)) map.set(k, { name:k, cc:t.cc, n:0, inV:0, outV:0, first:t.d, last:t.d, methods:new Set(), dirs:new Set() });
    const r = map.get(k);
    r.n++; r.last = t.d; if (t.d < r.first) r.first = t.d;
    if (t.dir === "C") r.inV += t.amt; else r.outV += t.amt;
    r.methods.add(t.m); r.dirs.add(t.dir);
  });
  const over = {}; (seed.cps || []).forEach(c => { over[c.name] = c; });
  const out = [];
  map.forEach(r => {
    const o = over[r.name] || {};
    const isCash = /^Cash deposit|^Cash withdrawal|^ATM /i.test(r.name);
    const isEnt = /[A-Z]{3,}\s|LLC|LTD|LIMITED|FZE|GMBH|PVT|INC|SARL|BV|PLC|CO\.|OÜ|S\.A\./.test(r.name) || o.type === "entity";
    out.push({
      name: r.name,
      type: o.type || (isCash ? "cash" : isEnt ? "entity" : "individual"),
      cc: o.cc || r.cc,
      customer: o.customer != null ? o.customer : false,
      biz: o.biz || (isEnt ? "Not established from available records" : ""),
      rel: o.rel || "Not declared in the customer's beneficiary or expected-counterparty record",
      n: r.n, inV: r.inV, outV: r.outV, total: r.inV + r.outV,
      first: r.first, last: r.last,
      methods: Array.from(r.methods), dirs: Array.from(r.dirs),
      added: o.added || "",
      purpose: o.purpose || "",
      flags: o.flags || [],
      note: o.note || "",
      screening: o.screening || "No sanctions, PEP or law-enforcement match returned on the name as presented.",
      accounts: o.accounts || "",
      benign: !!o.benign
    });
  });
  out.sort((a,b) => b.total - a.total);
  return out;
}

/* beneficiaries = outbound payees with payee-list metadata (§12) */
function buildBeneficiaries(cps, txns, seed, ccy){
  return cps.filter(c => c.outV > 0 && c.type !== "cash").map(c => {
    const rows = txns.filter(t => t.cp === c.name && t.dir === "D");
    return {
      name: c.name, cc: c.cc, type: c.type,
      account: c.accounts || ("****" + String(Math.abs(hashCode(c.name)) % 9000 + 1000)),
      added: c.added || "",
      addedNote: c.added ? "" : "Beneficiary-list metadata not held for this payee.",
      n: rows.length, total: sum(rows, r => r.amt),
      first: rows.length ? rows[0].d : "", last: rows.length ? rows[rows.length-1].d : "",
      purpose: c.purpose || "No payment purpose recorded by the customer",
      rel: c.rel, biz: c.biz, screening: c.screening, note: c.note, flags: c.flags
    };
  });
}
function hashCode(s){ let h=0; for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h|=0; } return h; }

/* relationship graph (§10) */
function buildGraph(c){
  const nodes = [{ id:"CUST", kind:"customer", label:c.customer.name, sub:c.customer.product, cc:c.customer.cc }];
  const edges = [];
  const top = c.counterparties.slice(0, 13);
  top.forEach((cp, i) => {
    const id = "N" + i;
    nodes.push({ id, kind: cp.type === "cash" ? "cash" : cp.type === "entity" ? "entity" : cp.customer ? "customer" : "party",
                 label: cp.name, sub: ctryName(cp.cc), cc: cp.cc, cpIndex: c.counterparties.indexOf(cp) });
    if (cp.inV > 0) edges.push({ a:id, b:"CUST", kind:"transfer", v:cp.inV, n:cp.n, label:moneyShort(cp.inV, c.ccy) + " in" });
    if (cp.outV > 0) edges.push({ a:"CUST", b:id, kind:"transfer", v:cp.outV, n:cp.n, label:moneyShort(cp.outV, c.ccy) + " out" });
  });
  (c.links || []).forEach((l, i) => {
    const aId = nodes.find(n => n.label === l.a), bId = nodes.find(n => n.label === l.b);
    if (aId && bId) edges.push({ a:aId.id, b:bId.id, kind:l.kind || "link", label:l.label || l.kind, dashed:true });
    else if (l.newNode){
      const id = "X" + i;
      nodes.push({ id, kind:l.kind === "address" ? "address" : "entity", label:l.b, sub:l.sub || "", cc:l.cc || "" });
      const src = nodes.find(n => n.label === l.a) || nodes[0];
      edges.push({ a:src.id, b:id, kind:l.kind || "link", label:l.label || l.kind, dashed:true });
    }
  });
  return { nodes, edges };
}

/* ---- default investigation actions -------------------------------------- */
function defaultRequests(c, seed){
  const st = c.stats, ccy = c.ccy;
  const cashTx = c.txns.filter(t => /cash/i.test(t.m));
  const benes = c.beneficiaries.slice(0,3).map(b => b.name);
  const R = [];
  const add = o => { if (!R.some(x => x.id === o.id)) R.push(o); };

  add({ id:"prior", to:"ops", cat:"Account history", label:"Pull previous 12 months of account activity",
    resp: seed.priorResp || ("Trailing 12 months to the start of the review period: average monthly turnover " +
      money(Math.round(st.inV / Math.max(1, st.days/30) * (seed.priorFactor != null ? seed.priorFactor : 0.12)), ccy) +
      ", highest single credit " + money(Math.round(st.maxCr * (seed.priorFactor != null ? seed.priorFactor : 0.18)), ccy) +
      ", counterparties limited to " + (seed.priorCps || "salary credit, utility debits and a small number of repeat retail payees") +
      ". The activity in the review window is a step change against that baseline rather than a continuation of it.") });

  add({ id:"bene", to:"ops", cat:"Counterparty", label:"Retrieve beneficiary-list records for outbound payees",
    resp: seed.beneResp || ("Payee records retrieved for " + c.beneficiaries.length + " outbound beneficiaries" +
      (benes.length ? " including " + benes.join(", ") : "") + ". " +
      (c.beneficiaries.filter(b=>b.added).length ? "Addition dates are held and are shown on the Entities screen." :
       "Addition dates are held on the payee record and are shown on the Entities screen.") +
      " Outbound value to the top three beneficiaries represents " +
      pct(st.outV ? sum(c.beneficiaries.slice(0,3), b=>b.total)/st.outV : 0) + " of all outbound value in the window.") });

  add({ id:"remit", to:"ops", cat:"Counterparty", label:"Analyse inbound remitter population",
    resp: seed.remitResp || (c.counterparties.filter(x=>x.inV>0).length + " distinct inbound counterparties identified. " +
      "None appears in the customer's declared expected-counterparty list. No reciprocal payments run from the customer to any inbound payer in the window.") });

  if (cashTx.length) add({ id:"cash", to:"ops", cat:"Cash", label:"Obtain cash deposit records and CCTV where available",
    resp: seed.cashResp || (cashTx.length + " cash transactions totalling " + money(sum(cashTx,t=>t.amt), ccy) +
      ", presented at " + uniq(cashTx.map(t=>t.loc||t.cp)).length + " locations. Individual values range " +
      money(Math.min.apply(null,cashTx.map(t=>t.amt)), ccy) + "–" + money(Math.max.apply(null,cashTx.map(t=>t.amt)), ccy) +
      ". " + (c.institution.thresholds ? "The institution's " + c.institution.thresholds.label + " is " + money(c.institution.thresholds.cash, ccy) + "." : "")) });

  add({ id:"device", to:"fraud", cat:"Network", label:"Request device, IP and related-account analysis",
    resp: seed.deviceResp || "Fraud Team returned the device and session record for the review period. No fraud markers are recorded against the customer. The team notes that device linkage alone establishes shared access, not shared control, and should be read with the transaction pattern." });

  add({ id:"kycfile", to:"kyc", cat:"KYC", label:"Request the full KYC file and last review notes",
    resp: seed.kycResp || ("KYC file retrieved. Identity and address verification are on file and current. The customer profile was last refreshed at " +
      (c.customer.kyc.review || "the date shown on the KYC tab") + "; expected activity recorded at that review is shown on the Expected activity tab. No source-of-wealth documentation is held beyond the declaration made at onboarding.") });

  add({ id:"rm", to:"rm", cat:"Relationship", label:"Ask the relationship manager for background",
    resp: seed.rmResp || "Relationship manager has no recent contact recorded with the customer and no knowledge of a change in circumstances. The RM notes that the relationship is serviced digitally and that they have not met the customer." });

  add({ id:"sanc", to:"sanctions", cat:"Screening", label:"Refer names to the Sanctions Team for screening",
    resp: null, kind:"sanctions" });

  add({ id:"media", to:"external", cat:"Screening", label:"Run adverse media and open-source research",
    resp: null, kind:"media" });

  add({ id:"amlhist", to:"aml", cat:"History", label:"Check internal AML history and linked-case register",
    resp: seed.amlResp || ("Internal register returns " + (c.customer.history.alerts || "no prior alert") +
      " for this customer. " + (seed.amlExtra || "No linked internal case is open against the counterparties named in this alert.")) });

  if (c.institution.id === "invest" || c.institution.id === "paymentinst" || st.ccs.length > 1)
    add({ id:"corr", to:"corr", cat:"Correspondent", label:"Query the correspondent bank on intermediary routing",
      resp: seed.corrResp || "Correspondent confirms the routing shown in the payment messages and provides the ordering and beneficiary institution details already visible on the transactions. No further originator information was held beyond that supplied in the message." });

  add({ id:"explain", to:"customer", cat:"Customer", label:"Request the customer's explanation of the activity",
    resp: seed.explain || "Customer declined to provide a narrative explanation and asked that any query be put in writing.", quote:true });

  add({ id:"proof", to:"customer", cat:"Customer", label:"Request supporting documents from the customer",
    resp: seed.proof || "No documents were produced within the period allowed." });

  add({ id:"sofsow", to:"customer", cat:"Source of funds", label:"Request source of funds and source of wealth evidence",
    resp: seed.sofsow || "Customer restated the source given at onboarding without producing supporting records.", kind:"docs" });

  (seed.reqs || []).forEach(r => {
    const i = R.findIndex(x => x.id === r.id);
    if (i >= 0) R[i] = Object.assign({}, R[i], r); else R.push(r);
  });
  return R;
}

/* ---- screening outcomes (§15, §16) -------------------------------------- */
const MEDIA_KIND = {
  none:{ label:"No relevant results", tone:"green",
    body:"Structured open-source research against the customer name, date of birth range and location returned no relevant results. Common-name matches were reviewed and discounted on identifiers." },
  namematch:{ label:"Name-only / false match", tone:"blue",
    body:"Results were returned for individuals sharing the customer's name. On review the matches differ on date of birth, country of residence and occupation. These are name-only matches and carry no weight in the assessment." },
  unconfirmed:{ label:"Unconfirmed negative information", tone:"orange",
    body:"Low-quality sources carry allegations that are not corroborated by any named source, court record or regulator. This is information requiring investigation, not evidence. It may support a decision to seek further information; it does not by itself support a conclusion." },
  relevant:{ label:"Relevant negative media", tone:"orange",
    body:"Established outlets report matters relevant to the activity under review, with named sources and identifiers consistent with the customer. This is credible information but remains reporting rather than a finding of fact." },
  regulatory:{ label:"Regulatory action", tone:"red",
    body:"A regulator has published an action naming the subject. The action is a documented administrative finding by the publishing authority." },
  criminal:{ label:"Criminal investigation reported", tone:"red",
    body:"Reporting indicates an active criminal investigation. An investigation is not a conviction; treat it as material information about risk, not as proof of the underlying conduct." },
  court:{ label:"Court proceedings", tone:"red",
    body:"Court records identify proceedings involving the subject. Record what the filing establishes and what remains untested." }
};
const SANC_KIND = {
  none:{ label:"No match", tone:"green",
    body:"Screened against consolidated sanctions lists in force. No match returned on the customer or on the counterparties referred." },
  false:{ label:"False positive — discounted", tone:"blue",
    body:"An initial hit was generated on name similarity. Secondary identifiers (date of birth, nationality, place of birth) do not match the listed person. Discounted and recorded as a false positive." },
  potential:{ label:"Potential match — under review", tone:"orange",
    body:"A hit has been generated that cannot be discounted on the identifiers currently held. This is a POTENTIAL match. It is not a confirmed match and must not be treated as one. The Sanctions Team retains the decision; further identifiers have been requested." },
  confirmed:{ label:"Confirmed match", tone:"red",
    body:"The Sanctions Team has confirmed the match against the listed party on full identifiers. Sanctions handling procedures apply and take precedence over the money-laundering assessment; the matter is reported through the sanctions route in parallel." }
};

/* ---- model disposition composed from the case's own record --------------- */
function composeModel(c){
  const st = c.stats, ccy = c.ccy, P = [];
  const r = rule(c.alert.ruleId);
  P.push("Alert " + c.alert.ref + " was raised by rule " + r.code + " (" + r.name + ") over the period " +
    c.alert.period + ". The rule measured " + st.n + " transactions totalling " + money(st.total, ccy) + " — " +
    money(st.inV, ccy) + " credited across " + st.nIn + " entries and " + money(st.outV, ccy) + " debited across " +
    st.nOut + " entries — against the customer's profiled expectation of " + c.customer.expected.turnover + ".");

  P.push("The customer is " + c.customer.summary + " The relationship has been held since " + c.customer.since +
    " and is rated " + (RISK[c.customer.risk]||{label:c.customer.risk}).label.toLowerCase() + " risk. Declared source of funds is " +
    c.customer.kyc.sof + "; declared source of wealth is " + c.customer.kyc.sow + ". Expected activity recorded at the last KYC review was " +
    c.customer.expected.types + ", with counterparties expected to be " + c.customer.expected.cps + " and geographies " +
    c.customer.expected.geos + ".");

  const topIn = c.counterparties.filter(x=>x.inV>0).slice(0,3).map(x => x.name + " (" + money(x.inV,ccy) + ")");
  const topOut = c.counterparties.filter(x=>x.outV>0).slice(0,3).map(x => x.name + " (" + money(x.outV,ccy) + ")");
  P.push("Transaction analysis. " + (topIn.length ? "Principal inbound counterparties are " + topIn.join(", ") + ". " : "") +
    (topOut.length ? "Principal outbound counterparties are " + topOut.join(", ") + ". " : "") +
    "Outbound value represents " + pct(st.ratio) + " of inbound value over the window and the lowest balance recorded is " +
    money(st.minBal, ccy) + ". Countries touched: " + st.ccs.map(ctryName).join(", ") + ". Channels used: " +
    (st.channels.join(", ") || st.methods.join(", ")) + ".");

  if (c.flags.length) P.push("Indicators identified. " + c.flags.map((f,i) => (i+1) + ") " + f.t).join(". ") + ".");
  if (c.traps && c.traps.length) P.push("Features considered and discounted. " + c.traps.map(t => t.t).join(" ") );

  P.push("Screening. Sanctions: " + SANC_KIND[c.sanctions.kind].label.toLowerCase() + ". Adverse media: " +
    MEDIA_KIND[c.media.kind].label.toLowerCase() + ". " +
    (c.sanctions.kind === "potential" ? "The sanctions position is a potential match only and is not treated as confirmed in this assessment. " : "") +
    (c.media.kind === "unconfirmed" ? "Media information is uncorroborated and is treated as a prompt for enquiry rather than as evidence. " : ""));

  P.push("Customer explanation and evidence. " + (c.explanationSummary || "No explanation was obtained.") + " " +
    (c.evidenceSummary || ""));

  P.push("Assessment. " + (c.assessment || "") + " Potential typology: " + c.typology.join("; ") + ".");

  const dec = c.outcome;
  P.push("Recommendation: " + (dec === "escalate"
      ? "escalate to the MLRO for consideration of a suspicious activity report under the institution's procedures. This recommendation records that the activity is unusual and unexplained on the evidence available; it is not a determination that an offence has been committed, which is not the analyst's decision to make."
      : dec === "edd" ? "retain the case in enhanced due diligence pending the outstanding information identified above. Material questions remain open and the evidence currently held supports neither closure nor escalation."
      : "close with no suspicion. The activity is unusual against the recorded profile but is reasonably explained and independently corroborated.") +
    (c.residual ? " Residual actions: " + c.residual : ""));
  return P.join("\n\n");
}

/* ---- main expansion ------------------------------------------------------ */
function buildCase(seed){
  const rnd = seedRand(seed.id);
  const I = inst(seed.inst);
  const ccy = seed.ccy || I.ccy;
  const led = composeLedger(seed, rnd);
  const txns = led.txns;
  const st = ledgerStats(txns);
  const cu = seed.cust || {};
  const priority = seed.priority || (seed.level >= 4 ? "critical" : seed.level === 3 ? "high" : seed.level === 2 ? "high" : "medium");

  const c = {
    id: seed.id, kind: seed.kind, level: seed.level, inst: I.id, institution: I, ccy,
    title: seed.title, seed,
    stats: st, txns,
    txnNote: seed.txnNote || ("Extract shows all " + txns.length + " transactions captured by the rule in the review window. Activity outside the window is available through the account history request."),
    alert: {
      ref: seed.ref || ("AL-" + (Math.abs(hashCode(seed.id)) % 90000 + 10000)),
      ruleId: seed.rule, date: st.to, period: fmtDate(st.from) + " – " + fmtDate(st.to),
      priority, risk: seed.risk || (seed.level >= 4 ? "critical" : seed.level >= 3 ? "high" : "medium"),
      count: st.n, amount: st.total, ccy,
      product: cu.product || I.products[0],
      channel: st.channels[0] || st.methods[0] || I.channels[0],
      countries: st.ccs, nCps: st.cps.length,
      prior: cu.priorAlerts || "None recorded",
      trigger: seed.trigger || null
    },
    customer: {
      id: seed.custId || ("C-" + (Math.abs(hashCode(seed.id + "c")) % 900000 + 100000)),
      name: cu.name || nameGen(rnd, ccy==="INR"?"IN":ccy==="GBP"?"UK":ccy==="EUR"?"EU":"US"),
      age: cu.age || "", since: cu.since || "", occ: cu.occ || "", employer: cu.employer || "",
      income: cu.income || "", address: cu.address || "", city: cu.city || "", cc: cu.cc || (st.ccs[0]||"US"),
      ctype: cu.ctype || I.customerTypes[0], risk: cu.risk || "low",
      product: cu.product || I.products[0], purpose: cu.purpose || "Not restated since onboarding",
      summary: cu.summary || ((cu.age? cu.age + "-year-old ":"") + (cu.occ||"customer") + (cu.city ? " resident in " + cu.city : "") + "."),
      products: cu.products || [{ name: cu.product || I.products[0], num:"****"+(Math.abs(hashCode(seed.id))%9000+1000), opened: cu.since||"", status:"Active", bal: st.minBal }],
      expected: {
        turnover: cu.expTurn || "not recorded at last review",
        types: cu.expTypes || "not recorded at last review",
        geos: cu.expCtry || "domestic only",
        cps: cu.expCps || "not recorded at last review",
        cash: cu.expCash || "no cash activity expected"
      },
      kyc: {
        idv: cu.idv || "Verified at onboarding — government photo identity, electronically validated",
        adv: cu.adv || "Verified at onboarding — utility statement",
        occ: cu.occ || "", sof: cu.sof || "Not evidenced beyond declaration",
        sow: cu.sow || "Not evidenced beyond declaration",
        review: cu.kycDate || "", assess: cu.kycAssess || "Standard due diligence applied; no enhanced measures recorded.",
        pep: cu.pep || "Not identified as a politically exposed person at onboarding or subsequent screening."
      },
      history: {
        alerts: cu.priorAlerts || "No previous alert",
        cases: cu.priorCases || "No previous case",
        edd: cu.priorEdd || "No enhanced due diligence previously performed",
        expl: cu.priorExpl || "No previous customer explanation held on file",
        risk: cu.riskHist || "Risk rating unchanged since onboarding"
      }
    },
    flags: seed.flags || [], traps: seed.traps || [], typology: seed.typology || [],
    outcome: seed.outcome, hints: seed.hints || [],
    keyTxn: seed.keyTxn || [], keyReq: seed.keyReq || [],
    reveal: seed.reveal || {}, links: seed.links || [],
    explanationSummary: seed.explanationSummary || "", evidenceSummary: seed.evidenceSummary || "",
    assessment: seed.assessment || "", residual: seed.residual || "",
    media: Object.assign({ kind: seed.media || "none", items: seed.mediaItems || [] }, {}),
    sanctions: Object.assign({ kind: seed.sanctions || "none", items: seed.sancItems || [] }, {}),
    docs: seed.docs || []
  };

  c.counterparties = buildCounterparties(txns, seed, ccy, rnd);
  enrichCounterparties(c);
  c.beneficiaries  = buildBeneficiaries(c.counterparties, txns, seed, ccy);
  enrichBeneficiaries(c);
  c.links = deriveLinks(c);
  c.graph = buildGraph(c);
  c.requests = defaultRequests(c, seed);

  /* key transactions default: the largest movements and any noted rows */
  if (!c.keyTxn.length){
    const noted = txns.filter(t => t.note).map(t => t.id);
    const big = txns.slice().sort((a,b)=>b.amt-a.amt).slice(0, Math.min(8, Math.ceil(txns.length*0.35))).map(t=>t.id);
    c.keyTxn = uniq(noted.concat(big));
  }
  if (!c.keyReq.length) c.keyReq = ["prior","bene","explain","sofsow"].concat(seed.extraKeyReq || []);
  if (!c.hints.length) c.hints = defaultHints(c);
  c.model = seed.model || composeModel(c);
  return c;
}

function defaultHints(c){
  const r = rule(c.alert.ruleId);
  return [
    "Start with the mechanics: " + r.mech.charAt(0).toLowerCase() + r.mech.slice(1).replace(/\.$/,"") + ". Establish what the numbers actually are before forming a view.",
    "The question the rule cannot answer is " + r.watch.charAt(0).toLowerCase() + r.watch.slice(1).replace(/\.$/,"") + ". Look for evidence on that, not for confirmation of a theory.",
    "Test the explanation against the record rather than against plausibility: does the documentary evidence reconcile to the ledger, and what in the account contradicts what you have been told?"
  ];
}
