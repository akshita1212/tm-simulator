
/* --------------------------------------------------------------------------
   6b. Derivation layer
   The seeds describe each case's facts; this derives the counterparty,
   beneficiary, relationship and evidence detail that follows from them, so
   that Entity Search, Beneficiary investigation and Evidence are specific to
   the case rather than generic. Everything derived here is simulation detail
   consistent with the case's own recorded facts.
   -------------------------------------------------------------------------- */

function surnameOf(name){
  const t = String(name).replace(/[^A-Za-zÀ-ɏ' -]/g, " ").trim().split(/\s+/);
  return t.length > 1 ? t[t.length - 1].toLowerCase() : "";
}
function flagSet(c){ const s = {}; (c.flags || []).forEach(f => s[f.k] = f.t); return s; }
function isEntityName(n){
  return /\b(LTD|LLC|GMBH|BV|AB|AS|PVT|INC|SA|OÜ|OU|PLC|LP|CO|CORP|SARL|SPA|SRL|AG|NV|APS|SP|ŞTI|STI|PTY|FZE|FZCO|DMCC|E\.V|EV|STICHTING|STIFTUNG|TRUST|FOUNDATION|GROUP|HOLDINGS?|PARTNERS?|SERVICES?|SOLUTIONS?|ENTERPRISES?|TRADING|TRADELINK|LOGISTICS|COMMODITIES|VENTURES|CAPITAL|INDUSTRIES|EXPORTS?|IMPORTS?|CONSULTING|DISTRIBUTION|SOURCING|MARKETING|SYNDICATE|SOCIETY|BUREAU|SCHEME|FUND|BANK|EXCHANGE|PLATFORM|PAYROLL|AUTHORITY|SYSTEM|PROVIDER|SETTLEMENT|ACQUIRER|SCHEME)\b/i.test(n)
      || /\bSA DE CV\b|\bS\.A\.\b|\bd\.o\.o\.\b/i.test(n)
      || (n === n.toUpperCase() && n.replace(/[^A-Z]/g, "").length > 6);
}
function isCashChannel(n){ return /^cash (deposit|withdrawal)|^ATM |cash deposit —|currency deposit/i.test(n); }

/* what role does this counterparty play, on the evidence of the ledger? */
function cpRole(cp, c){
  const rows = c.txns.filter(t => t.cp === cp.name);
  const desc = uniq(rows.map(t => (t.desc || "").toLowerCase())).join(" ");
  const n = cp.name.toLowerCase();
  if (isCashChannel(cp.name)) return "cash";
  if (/payroll|salary|wage|pension|scholarship|superannuation|benefit|stipend/.test(n + desc)) return "income";
  if (/solicitor|notary|escrow|title|conveyanc|client account|sub-registrar|registry/.test(n)) return "professional";
  if (/tax|revenue|customs|hmrc|hm revenue|internal revenue|collector|authority|social insurance|gst|paye/.test(n)) return "authority";
  if (/broker|investment|wealth|brokerage|fund|isa|savings bond|pension provider|building society|mortgage|bauspar|housing finance|credit union|finance ltd|lender/.test(n)) return "financial";
  if (/university|school|college|hospital|foundation|charity|federation|association/.test(n)) return "institution";
  if (/supplier|wholesale|distributor|manufactur|shipping|freight|carrier|logistics|courier|contractor|agency|staffing/.test(n + desc)) return "supplier";
  if (/exchange|virtual asset|customer funds|venue/.test(n + desc)) return "venue";
  if (/settlement|acquirer|scheme|provider|platform/.test(n)) return "processor";
  return isEntityName(cp.name) ? "entity" : "individual";
}

const ROLE_BIZ = {
  income:"Payer of the customer's declared income — verifiable against the customer record",
  professional:"Regulated professional or client-account holder acting in the transaction",
  authority:"Government or statutory body",
  financial:"Regulated financial institution",
  institution:"Established institution with a public record",
  supplier:"Trading counterparty — business activity as described on the payment record",
  venue:"Virtual-asset venue or trading platform",
  processor:"Payment processor or scheme settlement",
  cash:"Not a party — a channel through which currency entered or left the account"
};

function enrichCounterparties(c){
  const rnd = seedRand(c.id + "|cp");
  const F = flagSet(c);
  const custSur = surnameOf(c.customer.name);
  const clean = c.outcome === "close";
  const suspicious = c.outcome === "escalate";
  const declaredCps = (c.customer.expected.cps || "").toLowerCase();

  c.counterparties.forEach((cp, idx) => {
    const role = cpRole(cp, c);
    const rows = c.txns.filter(t => t.cp === cp.name);
    const sur = surnameOf(cp.name);
    const kin = !!(custSur && sur && sur === custSur && !isEntityName(cp.name));
    const named = declaredCps && cp.name.toLowerCase().split(/[ ,—-]+/)
      .some(w => w.length > 4 && declaredCps.indexOf(w) >= 0);
    const benign = ["income","professional","authority","financial","institution","processor"].indexOf(role) >= 0;
    cp.role = role;
    cp.benign = benign || named || (clean && kin);
    cp.type = role === "cash" ? "cash" : (isEntityName(cp.name) || ["supplier","venue","processor","financial","institution","authority"].indexOf(role) >= 0) ? "entity" : "individual";

    /* customer of this institution? */
    if (cp.customer == null || cp.customer === false)
      cp.customer = role === "cash" ? false
        : (F.network || F.cluster) && cp.type === "individual" && idx % 3 === 0 ? true
        : kin && clean ? false : false;

    /* business / occupation */
    if (!cp.biz || /^Not established/.test(cp.biz))
      cp.biz = ROLE_BIZ[role]
        || (cp.type === "entity"
            ? (suspicious && (F.shell || F.newcp || F.unrelated)
               ? "No filed accounts, website or identifiable trading activity located in public records"
               : "Registered entity; activity not independently corroborated from the records held")
            : "Not established — the counterparty is not a customer of this institution");

    /* relationship to the customer */
    if (!cp.rel || /^Not declared/.test(cp.rel))
      cp.rel = named ? "Named in the customer's expected-counterparty record at the last KYC review"
        : kin ? "Shares the customer's surname. A family relationship is indicated but is not evidenced unless documents have been obtained"
        : role === "income" ? "Source of the customer's declared income"
        : role === "authority" ? "Statutory payee — no commercial relationship"
        : role === "professional" ? "Instructed in connection with the transaction under review"
        : role === "cash" ? "Not applicable — channel, not a party"
        : "Not declared in the customer's beneficiary or expected-counterparty record";

    /* related accounts */
    if (!cp.accounts)
      cp.accounts = cp.type === "cash" ? "Not applicable"
        : cp.customer ? "Holds one account at this institution; linked by device to the customer's account"
        : (F.network || F.cluster || F.nesting) && cp.type === "entity" && idx < 4
          ? "Receives from other customers of this institution in the same period — see the network request"
          : "None identified from the records held. A counterparty that is not a customer here is visible only through the payment messages";

    /* stated purpose, from the payment record */
    if (!cp.purpose){
      const d = uniq(rows.map(t => t.desc).filter(Boolean));
      cp.purpose = d.length ? d.slice(0, 2).join("; ") + " (as stated on the payment record — a reference is an assertion, not evidence)"
                            : "No payment purpose recorded by the customer";
    }

    /* screening */
    if (!cp.screening || /^No sanctions/.test(cp.screening))
      cp.screening = c.sanctions.kind === "potential" && idx === 0
        ? "Referred to the Sanctions Team. A hit was generated that cannot be discounted on the identifiers held — a POTENTIAL match, not a confirmed one."
        : c.sanctions.kind === "false" && idx === 0
        ? "An initial hit was generated on name similarity and discounted by the Sanctions Team on secondary identifiers."
        : "No sanctions, PEP or law-enforcement match returned on the name as presented. Absence of a match on a non-customer usually means nothing has been looked for.";

    /* risk indicators derived from the case's own recorded flags */
    if (!cp.flags || !cp.flags.length){
      const fl = [];
      if (role === "cash" && F.structuring) fl.push(F.structuring);
      if (role === "cash" && F.thirdparty) fl.push(F.thirdparty);
      if (cp.type === "entity" && cp.outV > 0 && F.passthrough) fl.push(F.passthrough);
      if (cp.type === "entity" && (F.shell || F.newcp)) fl.push(F.shell || F.newcp);
      if (cp.type === "individual" && cp.inV > 0 && F.unrelated) fl.push(F.unrelated);
      if (isHighRisk(cp.cc)) fl.push("Counterparty jurisdiction (" + ctryName(cp.cc) + ") is on the institution's higher-risk list");
      if (cp.benign && !fl.length) fl.push("None. This counterparty is consistent with the customer's declared activity.");
      cp.flags = fl.slice(0, 3);
    }
  });
  return c.counterparties;
}

/* beneficiary payee-list metadata, derived from the case's own indicators */
function enrichBeneficiaries(c){
  const rnd = seedRand(c.id + "|bene");
  const F = flagSet(c);
  const fast = !!(F.newbene || F.passthrough);
  c.beneficiaries.forEach(b => {
    const cp = c.counterparties.find(x => x.name === b.name) || {};
    b.type = cp.type || b.type;
    b.rel = cp.rel || b.rel;
    b.biz = cp.biz || b.biz;
    b.screening = cp.screening || b.screening;
    b.flags = cp.flags || b.flags;
    if (!b.added && b.first){
      const lag = fast ? rInt(rnd, 0, 2)
        : cp.benign ? rInt(rnd, 180, 900)
        : rInt(rnd, 5, 60);
      b.added = iso(addD(new Date(b.first + "T00:00:00"), -lag));
      b.addedNote = "";
    }
    if (!b.purpose || /^No payment purpose/.test(b.purpose)) b.purpose = cp.purpose || b.purpose;
  });
  return c.beneficiaries;
}

/* non-payment relationships (§10), asserted only where the case records them */
function deriveLinks(c){
  if (c.links && c.links.length) return c.links;
  const F = flagSet(c);
  const out = [];
  const ents = c.counterparties.filter(x => x.type === "entity").slice(0, 6);
  const people = c.counterparties.filter(x => x.type === "individual").slice(0, 6);
  const cashes = c.counterparties.filter(x => x.type === "cash").slice(0, 4);
  const custSur = surnameOf(c.customer.name);

  if ((F.connected || F.cluster || F.related) && ents.length >= 2)
    out.push({ a: ents[0].name, b: ents[1].name, kind:"director", label:"shared director" });
  if ((F.shell || F.agent || F.nesting) && ents.length >= 3)
    out.push({ a: ents[1].name, b: ents[2].name, kind:"address", label:"shared registered office" });
  if (F.network && people.length >= 2)
    out.push({ a: people[0].name, b: people[1].name, kind:"device", label:"shared device / IP" });
  if (F.thirdparty && cashes.length && people.length)
    out.push({ a: people[0].name, b: cashes[0].name, kind:"presented", label:"presented the cash" });
  if (F.ubo && ents.length >= 2)
    out.push({ a: ents[0].name, b: ents[ents.length-1].name, kind:"ubo", label:"common beneficial owner" });
  if (F.benes && ents.length && people.length)
    out.push({ a: people[0].name, b: ents[0].name, kind:"beneficiary", label:"shared onward beneficiary" });
  const kinCp = c.counterparties.find(x => x.type === "individual" && custSur && surnameOf(x.name) === custSur);
  if (kinCp) out.push({ a: c.customer.name, b: kinCp.name, kind:"surname", label:"shares the customer's surname" });
  return out;
}

/* --------------------------------------------------------------------------
   Evidence documents (§13), derived from the customer, the declared source
   and the case's own outcome. Consistency varies: a case that is reasonably
   explained produces documents that reconcile and can be verified from a
   source the customer does not control; a case that is not produces
   documents with contradictions the analyst has to find.
   -------------------------------------------------------------------------- */
const DOC_KINDS = {
  payslip:{ type:"Payslip / income record", issuer:"Employer or payroll bureau" },
  statement:{ type:"Bank statement (external institution)", issuer:"Another regulated institution" },
  tax:{ type:"Tax document", issuer:"Tax authority filing or assessment" },
  sale:{ type:"Sale agreement", issuer:"Parties to the transaction" },
  property:{ type:"Property record", issuer:"Land registry or title record" },
  investment:{ type:"Investment statement", issuer:"Regulated investment provider" },
  loan:{ type:"Loan document", issuer:"Regulated lender" },
  invoice:{ type:"Business invoice", issuer:"Counterparty to the customer" },
  accounts:{ type:"Financial statements", issuer:"Company filing" },
  sow:{ type:"Source of wealth declaration", issuer:"The customer" }
};
function pickDocKinds(c){
  const cu = c.customer, F = flagSet(c);
  const biz = /business|corporate|merchant|marketplace|operator|trader|manufactur|facilitator|logistics|agent|firm|fund|asset manager|treasury|trust|company/i.test(cu.ctype + " " + cu.occ)
    || isEntityName(cu.name);
  const sofsow = (cu.kyc.sof + " " + cu.kyc.sow + " " + (c.seed && c.seed.sofsow || "")).toLowerCase();
  const k = [];
  if (biz){ k.push("accounts","invoice","tax","statement"); }
  else { k.push("payslip","statement","tax"); }
  if (/propert|house|flat|home|land|completion|conveyanc/.test(sofsow) || /property|notary|solicitor|title|registr/i.test(c.txns.map(t=>t.cp).join(" "))) k.push("property","sale");
  if (/invest|portfolio|mutual fund|isa|brokerage|share|redemption|dividend/.test(sofsow)) k.push("investment");
  if (/loan|mortgage|credit|facility|drawdown/.test(sofsow)) k.push("loan");
  if (/sale of|sold|disposal|business sale|share purchase/.test(sofsow)) k.push("sale");
  k.push("sow");
  return uniq(k).slice(0, 5);
}
function caseDocs(c){
  if (c.docs && c.docs.length) return c.docs;
  const rnd = seedRand(c.id + "|docs");
  const cu = c.customer, ccy = c.ccy, st = c.stats;
  const clean = c.outcome === "close", edd = c.outcome === "edd";
  const kinds = pickDocKinds(c);
  /* in an EDD case, some documents hold and some do not */
  const holds = k => clean ? true : edd ? (kinds.indexOf(k) < Math.ceil(kinds.length * 0.6)) : false;
  const period = fmtDate(st.from) + " – " + fmtDate(st.to);
  const body = {
    payslip: k => k
      ? "Three consecutive payslips covering the period to " + fmtDate(st.to) +
        ", issued by the employer recorded on the customer file" +
        (cu.employer ? " (" + cu.employer + ")" : "") + "." +
        " Net pay is consistent with the declared income of " + (cu.income || "the figure on the customer record") +
        " and matches the credits posted to this account to the currency unit, including the tax and deduction lines."
      : "Two payslips were produced covering part of the period. Aggregate net pay across them is " +
        money(Math.round(st.inV * 0.06), ccy) + " against credits of " + money(st.inV, ccy) +
        " in the same window. The remaining credits are not accounted for by employment income.",
    statement: k => k
      ? "Statement from another regulated institution for the requested period, showing the funding movement leaving an account in the customer's own name on the date it arrived here, in the same amount, with a matching reference."
      : "The statement supplied covers a different period from the one requested, is a screenshot rather than a certified statement, and does not show the origin of the funds credited here. A second request was not answered.",
    tax: k => k
      ? "Filed return and assessment for the most recent complete year. Declared income reconciles to the account within ordinary timing differences, and the disposal or receipt under review is declared."
      : "The return produced is unsigned, is marked as a draft, and declares income materially below the value passing through the account in the review period. No assessment or filing receipt was supplied.",
    sale: k => k
      ? "Executed agreement showing the parties, the consideration, the date and the payment schedule, together with the completion statement. Each instalment reconciles to a credit on this account."
      : "An unsigned draft agreement was produced. It names no completion date, the consideration does not match the value received, and one named party cannot be traced at the address given.",
    property: k => k
      ? "Registry entry recording the transfer on the completion date at the stated consideration, in the customer's name. Verifiable from a public record the customer does not control."
      : "No registry entry corresponding to the transaction was located. The address given on the documents is recorded to a different owner who has no connection to the customer.",
    investment: k => k
      ? "Provider statement showing the holding, its acquisition history and the redemption. The acquisition is funded by transfers visible in this institution's own records, which corroborates the holding independently of the customer."
      : "A single-page valuation was produced with no provider letterhead, no account number and no acquisition history. The provider named is not authorised in any jurisdiction that can be checked.",
    loan: k => k
      ? "Sanction letter and disbursement advice from a regulated lender, with the loan account number matching the payment reference on the credit, and a repayment schedule consistent with the debits on this account."
      : "A one-page loan agreement was produced between the customer and a private company. It carries no interest rate, no security and no repayment schedule, and the lender is not a regulated lender in any checkable jurisdiction.",
    invoice: k => k
      ? "Invoices covering the payments under review, each carrying a tax registration number, itemised goods or services, delivery terms, and bank details matching the counterparty actually paid."
      : "Invoices carry no tax registration number, describe the service only as a generic category with no itemisation, and in two cases name a bank account in a country other than the issuing company's registered address. Two invoice numbers are sequential across different issuers.",
    accounts: k => k
      ? "Filed accounts for the last two years. Reported turnover reconciles to the account within ordinary timing differences, and any related-party balances are disclosed."
      : "Filed accounts report turnover of approximately " + money(Math.round(st.total * 0.14), ccy) +
        " against " + money(st.total, ccy) + " passing through this account in the review period alone. The two figures cannot both be right.",
    sow: k => /not applicable/i.test(cu.kyc.sow || "")
      ? "The customer is not a natural person, so source of wealth does not arise in the ordinary sense. What matters is the source of its funds: " +
        (cu.kyc.sof || "as recorded at onboarding") + ". " +
        (k ? "This is evidenced by the documents above."
           : "This has not been evidenced beyond the declaration made at onboarding.")
      : k
      ? "Declared source of wealth: " + (cu.kyc.sow || "as recorded at onboarding") +
        ". Supported by the documents above, each of which can be checked against a source outside the customer's control."
      : "Declared source of wealth: " + (cu.kyc.sow || "as recorded at onboarding") +
        ". This remains a declaration. Nothing produced evidences how the wealth was accumulated, as distinct from where these particular funds came from."
  };
  const note = {
    true:{ payslip:"Reconciles to the credits recorded on the account.",
      statement:"Origin of funds is traceable to an account in the customer's own name.",
      tax:"Filed with an authority — corroboration from outside the customer's control.",
      sale:"Values and dates reconcile to the ledger.",
      property:"Verifiable from a public register.",
      investment:"Acquisition history is corroborated by this institution's own records.",
      loan:"Lender is regulated and the reference matches the credit.",
      invoice:"Itemised, tax-registered, and the payee matches the party actually paid.",
      accounts:"Filed accounts reconcile to the account.",
      sow:"Supported rather than merely asserted." },
    false:{ payslip:"Does not account for the value credited in the review period.",
      statement:"Requested period was not supplied; origin remains unestablished.",
      tax:"Draft and unsigned; declared income contradicts the account.",
      sale:"Unsigned, incomplete, and a party cannot be traced.",
      property:"No corresponding registry entry exists.",
      investment:"Unverifiable provider and no acquisition history.",
      loan:"Unregulated lender; no commercial terms.",
      invoice:"Cannot be verified and is internally inconsistent with the payment record.",
      accounts:"Filed turnover contradicts the account by an order of magnitude.",
      sow:"Declaration only." }
  };
  return kinds.map((k, i) => {
    const ok = holds(k), D = DOC_KINDS[k];
    return { id:"d" + i, kind:k, type:D.type, issuer:D.issuer, period:period,
      title:D.type, body:body[k](ok), consistent:ok, note:note[String(ok)][k] };
  });
}
