
/* --------------------------------------------------------------------------
   7. Adapter for the hand-authored deep cases
   The authored cases predate the workspace data model. This maps them onto
   the same shape the builder produces, without altering their content.
   -------------------------------------------------------------------------- */
const AUTHORED_META = {
  "FIC-101":{ inst:"retail",      ccy:"INR", priority:"high",     risk:"high" },
  "DOC-204":{ inst:"retail",      ccy:"USD", priority:"critical", risk:"critical" },
  "DOC-311":{ inst:"retail",      ccy:"GBP", priority:"critical", risk:"critical" },
  "FIC-322":{ inst:"retail",      ccy:"INR", priority:"medium",   risk:"medium" },
  "DOC-418":{ inst:"invest",      ccy:"USD", priority:"critical", risk:"critical" },
  "FIC-431":{ inst:"paymentinst", ccy:"USD", priority:"high",     risk:"high" },
  "DOC-507":{ inst:"invest",      ccy:"EUR", priority:"critical", risk:"critical" },
  "FIC-544":{ inst:"retail",      ccy:"INR", priority:"medium",   risk:"medium" }
};
const CAT_TEAM = { Account:"ops", Counterparty:"ops", Network:"fraud", External:"external", Customer:"customer",
                   Internal:"aml", KYC:"kyc", Trading:"ops", Trade:"ops" };
/* map the authored rule strings onto the workspace rule catalogue */
const AUTHORED_RULE = { "FIC-101":"VELOCITY","DOC-204":"STRUCT","DOC-311":"CASH","FIC-322":"PROFILE",
                        "DOC-418":"MIRROR","FIC-431":"INTL","DOC-507":"GEO","FIC-544":"FUNNEL" };

function pget(p, keys, dflt){
  for (const k of keys) if (p[k]) return p[k];
  return dflt || "";
}
function adaptAuthored(a){
  const meta = AUTHORED_META[a.id] || { inst:"retail", ccy:"USD", priority:"high", risk:"high" };
  const I = inst(meta.inst), ccy = meta.ccy, p = a.profile;
  const st = ledgerStats(a.txns);
  const c = {
    id:a.id, kind:a.kind, level:a.level, inst:I.id, institution:I, ccy, authored:true,
    title:a.listTitle, seed:{},
    stats:st, txns:a.txns, txnNote:a.txnNote,
    alert:{
      ref:a.alert.ref, ruleId:AUTHORED_RULE[a.id] || "PROFILE",
      ruleLabel:a.alert.rule, date:a.alert.date, period:a.alert.period,
      priority:meta.priority, risk:meta.risk,
      count:st.n, amount:st.total, ccy,
      product:pget(p,["Account type","Entity type","Customer group","Group"], I.products[0]),
      channel:st.channels[0] || st.methods[0] || I.channels[0],
      countries:st.ccs, nCps:st.cps.length,
      prior:pget(p,["Previous alerts"],"None recorded"),
      trigger:a.alert.summary
    },
    customer:{
      id:"C-" + (Math.abs(hashCode(a.id)) % 900000 + 100000),
      name:pget(p,["Customer"],"Customer"),
      age:pget(p,["Age"]), since:pget(p,["Customer since"]),
      occ:pget(p,["Occupation","Business","Business (declared)","Declared strategy"]),
      employer:pget(p,["Employer","Registered office","Introduced by","Introduced by"]),
      income:pget(p,["Expected annual turnover (at onboarding)"]),
      address:pget(p,["Registered office"]),
      city:pget(p,["Nationality / residence"]),
      cc:st.ccs[0] || "US",
      ctype:pget(p,["Entity type","Customer group","Group"], I.customerTypes[0]),
      risk:(pget(p,["Risk rating"],"Low").toLowerCase().indexOf("high") >= 0 ? "high" :
            pget(p,["Risk rating"],"Low").toLowerCase().indexOf("medium") >= 0 ? "medium" : "low"),
      product:pget(p,["Account type"], I.products[0]),
      purpose:pget(p,["Stated account purpose","Declared strategy"],"Not restated since onboarding"),
      summary:pget(p,["Occupation","Business","Business (declared)"],"customer") +
              (pget(p,["Nationality / residence"]) ? ", " + pget(p,["Nationality / residence"]) : "") + ".",
      products:[{ name:pget(p,["Account type","Entity type"], I.products[0]),
                  num:"****" + (Math.abs(hashCode(a.id + "p")) % 9000 + 1000),
                  opened:pget(p,["Customer since"]), status:"Active", bal:st.minBal }],
      expected:{
        turnover:pget(p,["Expected monthly turnover","Expected annual turnover (at onboarding)","Expected monthly turnover (savings)"],"not recorded"),
        types:pget(p,["Expected transaction types","Expected activity"],"not recorded"),
        geos:pget(p,["Expected geographies"],"not recorded"),
        cps:pget(p,["Expected counterparties","Counterparty A"],"not recorded"),
        cash:pget(p,["Expected cash component","Expected cash component (at onboarding)"],"not recorded")
      },
      kyc:{
        idv:"Verified — see KYC file request", adv:"Verified — see KYC file request",
        occ:pget(p,["Occupation","Business"]),
        sof:pget(p,["Source of funds (declared)","Declared source of funds"],"Not evidenced beyond declaration"),
        sow:pget(p,["Source of wealth (declared)","Declared source of wealth"],"Not evidenced beyond declaration"),
        review:"See KYC file request",
        assess:"Beneficial owner: " + pget(p,["Beneficial owner","Beneficial owners","Beneficial owner (declared)"],"as recorded at onboarding") +
               (pget(p,["Directors","Partners"]) ? ". Directors/partners: " + pget(p,["Directors","Partners"]) : ""),
        pep:"Not identified as a politically exposed person at onboarding."
      },
      history:{
        alerts:pget(p,["Previous alerts"],"No previous alert"),
        cases:"See internal AML history request", edd:"See internal AML history request",
        expl:"See internal AML history request", risk:"See internal AML history request"
      },
      extra:p
    },
    flags:a.flags, traps:a.traps || [], typology:a.typology, outcome:a.outcome,
    hints:a.hints, keyTxn:a.keyTxn, keyReq:a.keyReq,
    reveal:a.reveal, links:[],
    media:{ kind:(a.requests.some(r=>/media/i.test(r.label)) ? "none" : "none"), items:[] },
    sanctions:{ kind:"none", items:[] },
    docs:[],
    model:a.model
  };
  /* authored screening text is embedded in a request — surface the tone */
  const mediaReq = a.requests.find(r => /media|sanction/i.test(r.label));
  if (mediaReq){
    const t = mediaReq.resp.toLowerCase();
    c.media.kind = /no adverse|no relevant|nothing adverse/.test(t) ? "none"
                 : /regulator|enforcement|prosecut/.test(t) ? "regulatory"
                 : /investigat|arrest|charge/.test(t) ? "criminal"
                 : /report|press|allegat/.test(t) ? "relevant" : "none";
    c.media.items = [{ src:"Institution research desk", date:a.alert.date, head:"Consolidated research result", body:mediaReq.resp }];
    c.sanctions.kind = /sanctions match|confirmed match/.test(t) ? "confirmed"
                     : /potential match/.test(t) ? "potential" : "none";
  }
  c.counterparties = buildCounterparties(a.txns, {}, ccy, seedRand(a.id));
  enrichCounterparties(c);
  c.beneficiaries  = buildBeneficiaries(c.counterparties, a.txns, {}, ccy);
  enrichBeneficiaries(c);
  c.links = deriveLinks(c);
  c.graph = buildGraph(c);
  c.requests = a.requests.map(r => ({
    id:r.id, to:CAT_TEAM[r.cat] || "ops", cat:r.cat, label:r.label, resp:r.resp, quote:!!r.quote
  }));
  /* the workspace always offers screening as explicit actions */
  if (!c.requests.some(r => r.id === "sanc"))
    c.requests.push({ id:"sanc", to:"sanctions", cat:"Screening", label:"Refer names to the Sanctions Team for screening", kind:"sanctions" });
  if (!c.requests.some(r => r.id === "media"))
    c.requests.push({ id:"media", to:"external", cat:"Screening", label:"Run adverse media and open-source research", kind:"media" });
  if (!c.requests.some(r => r.id === "sofsow"))
    c.requests.push({ id:"sofsow", to:"customer", cat:"Source of funds", label:"Request source of funds and source of wealth evidence",
      resp:"Refer to the documents and customer responses already obtained in this investigation.", kind:"docs" });
  return c;
}
