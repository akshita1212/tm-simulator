/* ==========================================================================
   SENTINEL TM  —  Transaction Monitoring & AML Investigation Simulator
   A training simulation. Every customer, counterparty, account number,
   transaction and document in this application is fictional.
   ========================================================================== */

/* --------------------------------------------------------------------------
   0. Small utilities
   -------------------------------------------------------------------------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, m => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function clamp(n,lo,hi){ return Math.max(lo, Math.min(hi, n)); }
function sum(a, f){ return a.reduce((t,x)=> t + (f?f(x):x), 0); }
function uniq(a){ return Array.from(new Set(a)); }
function byId(a,id){ return a.find(x => x.id === id); }

/* deterministic PRNG so a given case id always builds the same case */
function seedRand(seed){
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return function(){
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}
function rInt(rnd, lo, hi){ return lo + Math.floor(rnd() * (hi - lo + 1)); }
function rPick(rnd, a){ return a[Math.floor(rnd()*a.length)]; }
function rShuffle(rnd, a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* --------------------------------------------------------------------------
   Currency and number formatting
   -------------------------------------------------------------------------- */
const SYM = { INR:"₹", USD:"$", GBP:"£", EUR:"€", AED:"AED ", SGD:"S$", AUD:"A$", CHF:"CHF ", HKD:"HK$", CAD:"C$" };

function money(n, ccy){
  ccy = ccy || "USD";
  const sym = SYM[ccy] || (ccy + " ");
  const neg = n < 0; n = Math.abs(Math.round(n));
  let out;
  if (ccy === "INR"){
    const s = String(n);
    if (s.length > 3){
      const last3 = s.slice(-3);
      let rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      out = rest + "," + last3;
    } else out = s;
  } else {
    out = n.toLocaleString("en-US");
  }
  return (neg ? "−" : "") + sym + out;
}
/* compact form for tiles: ₹18.4L / $1.2M */
function moneyShort(n, ccy){
  const sym = SYM[ccy] || (ccy + " ");
  const a = Math.abs(n);
  if (ccy === "INR"){
    if (a >= 1e7) return sym + (n/1e7).toFixed(a>=1e8?0:2) + " Cr";
    if (a >= 1e5) return sym + (n/1e5).toFixed(a>=1e6?0:1) + " L";
    if (a >= 1000) return sym + (n/1000).toFixed(0) + "K";
    return sym + Math.round(n);
  }
  if (a >= 1e9) return sym + (n/1e9).toFixed(2) + "B";
  if (a >= 1e6) return sym + (n/1e6).toFixed(a>=1e7?1:2) + "M";
  if (a >= 1000) return sym + (n/1000).toFixed(a>=1e5?0:1) + "K";
  return sym + Math.round(n);
}
function pct(n){ return (n*100).toFixed(n>=0.1?0:1) + "%"; }
function iso(d){ return new Date(d).toISOString().slice(0,10); }
function addD(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtDate(s){
  const d = new Date(s + (String(s).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return s;
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtDateShort(s){
  const d = new Date(s + (String(s).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return s;
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
}
function nowClock(){ const d = new Date(); return d.toTimeString().slice(0,5); }

/* duration in ms -> "6h 12m" / "3d 4h" / "overdue 2h" */
function durHM(ms){
  const neg = ms < 0; ms = Math.abs(ms);
  const mins = Math.floor(ms/60000), h = Math.floor(mins/60), m = mins%60, d = Math.floor(h/24);
  let s;
  if (d >= 1) s = d + "d " + (h%24) + "h";
  else if (h >= 1) s = h + "h " + m + "m";
  else s = m + "m";
  return (neg ? "−" : "") + s;
}

/* --------------------------------------------------------------------------
   1. Institution types  (§1)
   Each institution changes the customer base, products, channels, monitoring
   rule set, geographies and the typologies the engine is tuned to surface.
   -------------------------------------------------------------------------- */
const INSTITUTIONS = [
  {
    id:"retail", name:"Meridian Retail Banking Group", short:"Retail bank", glyph:"🏦", ccy:"INR",
    markets:"India, United Kingdom, United States, Australia",
    tag:"Branch networks in four markets, 41m personal and small-business customers",
    desc:"An international retail banking group with a large branch and cash-deposit-machine footprint across four markets. Each subsidiary books in its own currency, so alerts arrive in the currency of the booking entity. Most concern personal customers, cash placement and domestic instant payments.",
    products:["Resident savings account","Current account (sole trader)","Salary account","Fixed deposit","Credit card","Personal loan","Gold loan","Locker"],
    channels:["Branch counter","Cash deposit machine","ATM","Mobile banking","Internet banking","UPI","Cheque clearing"],
    txnTypes:["Cash deposit","Cash withdrawal","UPI collect/pay","IMPS transfer","NEFT/RTGS","Cheque","Card purchase","Standing instruction"],
    customerTypes:["Salaried individual","Student","Retired individual","Sole trader","Small business","Housewife / homemaker","Agricultural"],
    riskFactors:["Cash-intensive local businesses","Thin-file young customers","Third-party account use","Domestic mule recruitment","Threshold-aware cash placement"],
    typologies:["Structuring","Money mule / funnel account","Cash-intensive business layering","Loan-back","Benami / third-party accounts"],
    geos:["India","United Arab Emirates","Singapore","Nepal","Sri Lanka"],
    thresholds:{ label:"PAN quoting threshold", cash:50000, note:"Cash transactions of ₹50,000 or more require PAN to be quoted; aggregated cash of ₹10,00,000 per month is separately reportable." },
    rules:["STRUCT","CASH","VELOCITY","DORMANT","PROFILE","NEWBENE","ROUND","PASSTHRU","FUNNEL"]
  },
  {
    id:"invest", name:"Ardsley & Crane (Investment Bank)", short:"Investment bank", glyph:"📈", ccy:"USD",
    tag:"Institutional markets, prime brokerage, corporate advisory",
    desc:"A wholesale institution. Alerts concern securities settlement, mirror-style trading, corporate structures, correspondent flows and client money movements that have no clear commercial rationale.",
    products:["Prime brokerage account","Custody account","Cash equities","OTC derivatives","Fixed income","Corporate advisory escrow","Securities lending","Repo"],
    channels:["SWIFT MT103","SWIFT MT202","Order management system","Give-up trade","Custody transfer","Correspondent nostro"],
    txnTypes:["Securities purchase","Securities sale","Free-of-payment delivery","Wire in","Wire out","Corporate action proceeds","Margin call","Fee settlement"],
    customerTypes:["Asset manager","Family office","Hedge fund","Corporate treasury","Sovereign entity","Private investment company","Trust"],
    riskFactors:["Opaque ownership structures","Offshore nominee directors","Free-of-payment settlement","Back-to-back trades","Introduced business from third-country brokers"],
    typologies:["Mirror trading","Securities layering","Trade-based value transfer","Beneficial-ownership concealment","Round-trip / wash activity"],
    geos:["United States","United Kingdom","Cyprus","British Virgin Islands","Russia","Switzerland","Cayman Islands","Hong Kong"],
    thresholds:{ label:"CTR threshold", cash:10000, note:"Currency transactions above USD 10,000 are reportable; wholesale flows are monitored on rationale rather than value alone." },
    rules:["MIRROR","RAPID","GEO","INTL","CIRCULAR","PROFILE","ROUND","PASSTHRU"]
  },
  {
    id:"fintech", name:"Lumen Financial (Fintech)", short:"Fintech", glyph:"⚡", ccy:"GBP",
    tag:"App-only lending, savings and embedded payments",
    desc:"A venture-backed fintech offering instant onboarding, savings pots and embedded credit. Alerts concentrate on onboarding fraud, first-party mules, rapid in-out flows and marketplace payouts.",
    products:["e-Money wallet","Savings pot","Instant credit line","Buy-now-pay-later","Virtual card","Merchant payout account","FX wallet"],
    channels:["Mobile app","Open banking pull","Faster Payments","Card acquiring","Apple/Google Pay","API partner"],
    txnTypes:["Faster Payment in","Faster Payment out","Card top-up","Card spend","Marketplace payout","FX conversion","Credit drawdown","Refund"],
    customerTypes:["Gig-economy worker","Young professional","Student","Freelancer","Micro-merchant","Non-resident"],
    riskFactors:["Instant remote onboarding","Device and IP reuse","Social-media mule recruitment","Refund and chargeback abuse","Rapid onward transfer"],
    typologies:["Money mule networks","First-party fraud","Rapid pass-through","Romance and investment fraud proceeds","Refund laundering"],
    geos:["United Kingdom","Ireland","Poland","Nigeria","Romania","Lithuania","Spain"],
    thresholds:{ label:"Enhanced review threshold", cash:6500, note:"No cash channel; monitoring is oriented to velocity, device linkage and beneficiary novelty rather than cash thresholds." },
    rules:["VELOCITY","RAPID","NEWBENE","PASSTHRU","FUNNEL","PROFILE","DORMANT","GEO"]
  },
  {
    id:"paymentinst", name:"Torrent Payments Ltd", short:"Payment institution", glyph:"🔁", ccy:"EUR",
    tag:"Cross-border merchant acquiring and mass payouts",
    desc:"An authorised payment institution processing merchant settlement and mass payouts across the EEA. Alerts concern merchant behaviour, transaction laundering and payout concentration.",
    products:["Merchant acquiring","Mass payout account","Collection account","IBAN-as-a-service","FX settlement","Payment initiation"],
    channels:["SEPA credit transfer","SEPA instant","Card scheme settlement","SWIFT","Payout API","Virtual IBAN"],
    txnTypes:["Card settlement","Refund batch","Chargeback","Merchant payout","Supplier payment","FX conversion","Rolling reserve release"],
    customerTypes:["e-Commerce merchant","Marketplace","Payment facilitator","Travel agent","Gaming operator","Logistics firm","Crypto on-ramp"],
    riskFactors:["Transaction laundering by unlicensed merchants","Merchant category mis-declaration","Chargeback spikes","Payout to unrelated third parties","Nested payment relationships"],
    typologies:["Transaction laundering","Shell merchant settlement","Third-party payout diversion","Sanctions circumvention through nesting","Trade-based value transfer"],
    geos:["Germany","Netherlands","Malta","Cyprus","Türkiye","Hong Kong","United Arab Emirates","Estonia"],
    thresholds:{ label:"Occasional-transaction threshold", cash:15000, note:"Occasional transactions of EUR 15,000 or more trigger customer due diligence; merchant monitoring is behaviour-based." },
    rules:["VELOCITY","GEO","INTL","FUNNEL","PASSTHRU","ROUND","CIRCULAR","PROFILE"]
  },
  {
    id:"digital", name:"Northwind Digital Bank", short:"Digital bank", glyph:"📱", ccy:"EUR",
    tag:"Pan-European licensed bank, no branches",
    desc:"A licensed bank with no physical presence. Rapid account opening, multi-currency accounts and cross-border retail flows dominate the alert population.",
    products:["Multi-currency current account","Savings vault","Metal/premium account","Overdraft","Junior account","Business account","Crypto brokerage (execution-only)"],
    channels:["Mobile app","SEPA instant","SWIFT","Card scheme","In-app FX","Crypto venue transfer"],
    txnTypes:["SEPA in","SEPA out","SWIFT in","SWIFT out","Card spend","ATM withdrawal abroad","Crypto buy","Crypto sell","Vault transfer"],
    customerTypes:["Expatriate professional","International student","Remote worker","Small business owner","Crypto-active retail","Frequent traveller"],
    riskFactors:["Cross-border by design","Crypto adjacency","Rapid multi-currency conversion","Non-resident customer base","Card cash-out abroad"],
    typologies:["Crypto layering","Cross-border pass-through","Investment fraud proceeds","Sanctions nexus through residency","Cash-out through foreign ATM"],
    geos:["Germany","Lithuania","Portugal","Türkiye","United Arab Emirates","Georgia","Serbia","Thailand"],
    thresholds:{ label:"Occasional-transaction threshold", cash:15000, note:"ATM cash withdrawal abroad is the principal cash channel; the account itself accepts no cash deposit." },
    rules:["RAPID","GEO","INTL","VELOCITY","CRYPTO","DORMANT","NEWBENE","PROFILE"]
  },
  {
    id:"msb", name:"Casa Remesa MSB", short:"Money-service business", glyph:"💸", ccy:"USD",
    tag:"Remittance agents, cheque cashing and currency exchange",
    desc:"A money-service business operating through an agent network. Alerts concern remittance structuring, agent conduct, sender/receiver concentration and cash exchange.",
    products:["Cash-to-cash remittance","Account-to-cash remittance","Cheque cashing","Currency exchange","Prepaid card load","Bill payment"],
    channels:["Agent counter","Self-service kiosk","Mobile app","Agent settlement account"],
    txnTypes:["Send remittance","Receive remittance","Cheque cashed","FX buy","FX sell","Prepaid load","Agent settlement"],
    customerTypes:["Migrant worker","Day labourer","Small trader","Occasional sender","Walk-in non-customer","Agent-introduced customer"],
    riskFactors:["Cash-only relationships","Sender/receiver name variation","Agent collusion","Smurfing across agents","Below-threshold splitting"],
    typologies:["Remittance structuring / smurfing","Funnel accounts","Human-smuggling payment corridors","Trade-based value transfer","Agent-facilitated laundering"],
    geos:["United States","Mexico","Guatemala","Honduras","Colombia","Philippines","Dominican Republic"],
    thresholds:{ label:"CTR / recordkeeping thresholds", cash:10000, note:"Currency transactions above USD 10,000 require a CTR; transmittals of USD 3,000 or more attract recordkeeping requirements." },
    rules:["STRUCT","CASH","FUNNEL","GEO","VELOCITY","PROFILE","ROUND","INTL"]
  }
];
function inst(id){ return byId(INSTITUTIONS, id) || INSTITUTIONS[0]; }

/* --------------------------------------------------------------------------
   2. Transaction monitoring rules  (§4)
   Rules describe what the engine measured. They never state a conclusion.
   -------------------------------------------------------------------------- */
const RULES = [
  { id:"STRUCT", code:"CT-002", name:"Structuring — deposits below reporting threshold", cat:"Cash",
    mech:"Counts cash credits within a defined percentage band beneath a reporting or identification threshold, aggregated across branches and devices over a rolling window.",
    watch:"Value distribution relative to the threshold; branch dispersion; who physically presented the cash." },
  { id:"RAPID", code:"RT-008", name:"Rapid movement of funds", cat:"Velocity",
    mech:"Flags accounts where credits are followed by debits of a similar aggregate value within a short holding period, leaving a low residual balance.",
    watch:"Holding period, residual balance retained, whether the onward party is economically connected to the payer." },
  { id:"VELOCITY", code:"RT-014", name:"Transaction velocity versus profile", cat:"Velocity",
    mech:"Compares transaction count and aggregate value in a rolling window against the customer's profiled expected activity and their own trailing baseline.",
    watch:"Whether the step-change has a documented cause; whether counterparties changed at the same time as volume." },
  { id:"DORMANT", code:"AC-021", name:"Reactivation of a dormant relationship", cat:"Behaviour",
    mech:"Identifies accounts with no customer-initiated activity for a defined period followed by credits or debits above a materiality floor.",
    watch:"What changed in the customer's circumstances; who initiated the reactivation; whether contact details changed first." },
  { id:"GEO", code:"GE-003", name:"Higher-risk geography exposure", cat:"Geography",
    mech:"Screens counterparty country, intermediary bank country and IP/ATM location against the institution's higher-risk jurisdiction list.",
    watch:"Whether the jurisdiction is consistent with the customer's declared footprint; the role of any intermediary." },
  { id:"INTL", code:"GE-011", name:"Unusual international activity", cat:"Geography",
    mech:"Detects cross-border value materially inconsistent with the customer's historical corridor mix, including new corridors above a value floor.",
    watch:"Corridor novelty, stated purpose, and whether documentation supports a commercial relationship." },
  { id:"FUNNEL", code:"NW-006", name:"Funnel account behaviour", cat:"Network",
    mech:"Detects many-to-one inbound concentration from unconnected remitters followed by onward consolidation to a small number of beneficiaries.",
    watch:"Remitter diversity and repetition; whether inbound payers have any relationship to each other or the customer." },
  { id:"PASSTHRU", code:"NW-009", name:"Pass-through account", cat:"Network",
    mech:"Measures the ratio of value passing out to value passing in over the window, together with the average time funds are held.",
    watch:"Pass-through ratio, retained margin, and whether the account performs any economic function of its own." },
  { id:"ROUND", code:"PT-004", name:"Round-value transaction clustering", cat:"Pattern",
    mech:"Identifies repeated transactions at exact round values that are inconsistent with priced goods or services.",
    watch:"Whether values correspond to invoices, contracts or an agreed schedule; round values are common in genuine commerce." },
  { id:"PROFILE", code:"KY-001", name:"Activity inconsistent with customer profile", cat:"Profile",
    mech:"Compares realised turnover, transaction types, counterparties and geographies against the values recorded at onboarding or last review.",
    watch:"Whether the profile is simply stale; a profile mismatch is a data question before it is a suspicion." },
  { id:"NEWBENE", code:"BN-002", name:"High-value payment to a newly added beneficiary", cat:"Beneficiary",
    mech:"Flags payments above a value floor made within a short interval of a payee being added to the customer's beneficiary list.",
    watch:"Time between addition and first use; whether the customer can describe the payee and the purpose." },
  { id:"CIRCULAR", code:"NW-014", name:"Circular fund flow", cat:"Network",
    mech:"Traces value moving between two or more related accounts or entities and returning to the originating ecosystem within the window.",
    watch:"Whether the loop has an economic purpose such as inter-company funding, and whether it is documented." },
  { id:"CASH", code:"CT-007", name:"Cash activity exceeding expected behaviour", cat:"Cash",
    mech:"Aggregates cash credits and debits against the cash expectation recorded for the customer's declared occupation or business type.",
    watch:"Whether the business is genuinely cash-generative at the observed scale, corroborated independently." },
  { id:"MIRROR", code:"SC-005", name:"Offsetting securities activity", cat:"Securities",
    mech:"Detects purchases and near-simultaneous offsetting sales of the same or similar instruments across related accounts or currencies with no net market exposure.",
    watch:"Whether any investment objective is served; commission and spread borne relative to value moved." },
  { id:"CRYPTO", code:"VA-002", name:"Virtual-asset exposure pattern", cat:"Virtual assets",
    mech:"Flags fiat movement to and from virtual-asset venues where value, frequency or venue risk exceeds the customer's profile.",
    watch:"Venue jurisdiction and licensing; whether fiat returns from a different venue than it left." }
];
function rule(id){ return byId(RULES, id) || RULES[0]; }

/* --------------------------------------------------------------------------
   3. Priorities, SLA, statuses  (§3, §26)
   -------------------------------------------------------------------------- */
const PRIORITY = {
  critical:{ label:"Critical", slaH:24,  tone:"red",    order:0, glyph:"◆" },
  high:    { label:"High",     slaH:48,  tone:"orange", order:1, glyph:"▲" },
  medium:  { label:"Medium",   slaH:120, tone:"blue",   order:2, glyph:"■" },
  low:     { label:"Low",      slaH:240, tone:"",       order:3, glyph:"●" }
};
const STATUS = {
  new:        { label:"New",              tone:"blue",   order:0 },
  assigned:   { label:"Assigned",         tone:"teal",   order:1 },
  investigating:{ label:"In investigation",tone:"purple", order:2 },
  pending:    { label:"Pending information",tone:"orange",order:3 },
  escalated:  { label:"Escalated",        tone:"red",    order:4 },
  qa:         { label:"QA review",        tone:"brown",  order:5 },
  closed:     { label:"Closed",           tone:"green",  order:6 }
};
const RISK = { low:{label:"Low",tone:""}, medium:{label:"Medium",tone:"blue"},
               high:{label:"High",tone:"orange"}, critical:{label:"Very high",tone:"red"} };
const LEVEL_NAME = {1:"Level 1 · Junior",2:"Level 2 · Analyst",3:"Level 3 · Intermediate",4:"Level 4 · Senior",5:"Level 5 · Expert"};
const LEVEL_SHORT = {1:"L1",2:"L2",3:"L3",4:"L4",5:"L5"};
const OUTCOME_NAME = { close:"Close — reasonably explained", edd:"Request information / EDD", escalate:"Escalate to MLRO" };

/* Role-based access  (§27) */
const ROLES = {
  junior:{ id:"junior", label:"Junior Analyst", rank:1,
    can:{ investigate:true, requestInternal:true, requestCustomer:false, edd:false, escalate:true, recommendSar:false, qaOthers:false, reopen:false },
    note:"May investigate and escalate to a senior analyst. Customer contact and EDD requests are raised through a senior analyst; SAR/STR recommendations are made by the MLRO function." },
  senior:{ id:"senior", label:"Senior Analyst", rank:2,
    can:{ investigate:true, requestInternal:true, requestCustomer:true, edd:true, escalate:true, recommendSar:true, qaOthers:false, reopen:false },
    note:"May run enhanced investigation, contact the customer through the relationship manager, raise EDD, escalate and recommend that the MLRO consider a SAR/STR." },
  qa:{ id:"qa", label:"QA Reviewer", rank:3,
    can:{ investigate:false, requestInternal:false, requestCustomer:false, edd:false, escalate:false, recommendSar:false, qaOthers:true, reopen:false },
    note:"Reviews completed investigations against the quality framework. Cannot alter another analyst's investigation record — QA findings are appended, never overwritten." },
  mlro:{ id:"mlro", label:"MLRO / Compliance", rank:4,
    can:{ investigate:true, requestInternal:true, requestCustomer:true, edd:true, escalate:true, recommendSar:true, qaOthers:true, reopen:true },
    note:"Reviews escalations and final recommendations, and holds the decision on external reporting." }
};
