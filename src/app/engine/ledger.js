
/* --------------------------------------------------------------------------
   5. Ledger composer
   A case seed describes its activity as a sequence of segments. The composer
   turns segments into a dated, balanced transaction ledger. This keeps seeds
   compact while producing genuinely different transaction shapes rather than
   the same ledger with different names.
   -------------------------------------------------------------------------- */

const NAME_POOL = {
  IN:{ f:["Aniket","Priya","Rohit","Meera","Suresh","Kavita","Imran","Deepa","Vikram","Lakshmi","Farhan","Anjali","Rajesh","Neha","Sanjay","Pooja","Arun","Divya","Nikhil","Shreya"],
       l:["Bhosale","Iyer","Nair","Deshmukh","Patel","Reddy","Sheikh","Kulkarni","Menon","Rao","Qureshi","Joshi","Pillai","Gupta","Shetty","Bose","Chauhan","Verma","Salgaonkar","Mehra"] },
  UK:{ f:["Daniel","Grace","Oliver","Amelia","Idris","Chloe","Marcus","Priya","Tomasz","Ruth","Callum","Nadia","Ethan","Sophie","Leon","Hannah"],
       l:["Whitmore","Adeyemi","Baptiste","Kowalski","Osei","Fairhurst","Nowak","Danquah","Bellamy","Okonjo","Hartley","Vasilenko","Marsden","Ibrahim","Lindqvist","Ferreira"] },
  US:{ f:["Marcus","Elena","Devon","Camila","Aaron","Rosa","Tyler","Yolanda","Curtis","Bianca","Nathan","Selena","Trevor","Dana","Miguel","Paulette"],
       l:["Whitfield","Vasquez","Okafor","Delgado","Brennan","Santos","Rivera","Chen","Mbeki","Cardenas","Larkin","Ferreira","Nguyen","Kowalczyk","Estrada","Duarte"] },
  EU:{ f:["Marta","Tomasz","Elif","Lucas","Ingrid","Andrei","Sofia","Mateo","Katrin","Dimitri","Nora","Pavel","Lena","Goran","Ines","Rasmus"],
       l:["Novak","Kaya","Bergström","Petrescu","Lindqvist","Vandenberg","Moreau","Duarte","Weiss","Sokolov","Jansen","Marchetti","Halvorsen","Popescu","Ferreira","Andersson"] },
  MX:{ f:["Miguel","Rosa","Javier","Lucia","Ernesto","Marisol","Rafael","Carmen","Hector","Alba","Ramon","Isabel"],
       l:["Delgado","Vargas","Ibarra","Cardenas","Munoz","Salazar","Zamora","Escobar","Trevino","Aguilar","Ochoa","Villalobos"] }
};
const ENT_A = ["Vikrant","Harsh","Meridian","Blackwater","Silverline","Kestrel","Orion","Torrent","Larkspur","Ironvale","Northgate","Calder","Ravensworth","Sableridge","Quantum","Aurelia","Belmont","Cygnet","Drayton","Eastwick"];
const ENT_B = ["Enterprises","Tradelink","Holdings","Trading FZE","Ventures","Logistics","Commodities","Global Ltd","Consulting","Exports","Services LLC","Imports","Group","Capital","Partners","Distribution","Sourcing","Marketing","Industries","Solutions"];

function nameGen(rnd, pool){
  const p = NAME_POOL[pool] || NAME_POOL.US;
  return rPick(rnd, p.f) + " " + rPick(rnd, p.l);
}
function entGen(rnd){ return (rPick(rnd, ENT_A) + " " + rPick(rnd, ENT_B)).toUpperCase(); }

/* --- one segment -> transactions ----------------------------------------- */
/* segment fields
   t     segment type: base | in | out | pair | sweep | cycle | single | gap
   n     count            lo/hi  amount band        exact  fixed amount
   m     method           ch     channel            cc     country code
   cp    counterparty: literal string, "@people", "@entities", "@sites", or array
   days  days the segment spans     every  fixed day interval
   note  per-transaction note       desc   narrative description
   ratio for sweep: proportion of accumulated credits to move out
   to    for sweep/out: beneficiary name or array
*/
function composeLedger(seed, rnd){
  const g = seed.gen || {};
  const ccy = seed.ccy || inst(seed.inst).ccy;
  const pool = g.pool || (ccy === "INR" ? "IN" : ccy === "GBP" ? "UK" : ccy === "EUR" ? "EU" : "US");
  const start = new Date((g.start || "2025-01-06") + "T00:00:00");
  const home = g.cc || (ccy === "INR" ? "IN" : ccy === "GBP" ? "GB" : ccy === "EUR" ? "DE" : "US");

  /* stable name pools reused across the case so the graph is coherent */
  const people = [], entities = [], sites = (g.sites || ["Main branch"]);
  for (let i=0;i<26;i++) people.push(nameGen(rnd, pool));
  for (let i=0;i<12;i++) entities.push(entGen(rnd));

  let bal = g.openBal != null ? g.openBal : Math.round((g.lo || 1000) * 2.4);
  let day = 0, id = 1;
  const txns = [];
  const usedPeople = [], usedEnt = [];

  function resolveCp(cp, i){
    if (Array.isArray(cp)) return cp[i % cp.length];
    if (cp === "@people"){ const v = people[i % people.length]; if (usedPeople.indexOf(v)<0) usedPeople.push(v); return v; }
    if (cp === "@entities"){ const v = entities[i % entities.length]; if (usedEnt.indexOf(v)<0) usedEnt.push(v); return v; }
    if (cp === "@sites") return "Cash deposit — " + sites[i % sites.length];
    return cp || "Counterparty";
  }
  function push(o){
    const amt = Math.max(1, Math.round(o.amt));
    bal = o.dir === "C" ? bal + amt : bal - amt;
    if (bal < 0) bal = Math.round(amt * 0.03);
    txns.push({
      id: id++, d: iso(addD(start, o.day)), t: o.time || (String(rInt(rnd,8,20)).padStart(2,"0")+":"+String(rInt(rnd,0,59)).padStart(2,"0")),
      dir: o.dir, amt: amt, m: o.m || "Transfer", cp: o.cp, cc: o.cc || home,
      desc: o.desc || "", ch: o.ch || "Mobile", loc: o.loc || "", bal: bal, note: o.note || ""
    });
  }

  (seed.gen && seed.gen.flow || []).forEach(seg => {
    const type = seg.t;
    const span = seg.days != null ? seg.days : (seg.n || 1) * 2;
    if (type === "gap"){ day += (seg.days || 90); return; }

    if (type === "single"){
      push({ day: day + (seg.at||0), dir: seg.dir || "C", amt: seg.exact != null ? seg.exact : rInt(rnd, seg.lo, seg.hi),
             m: seg.m, cp: resolveCp(seg.cp, 0), cc: seg.cc, desc: seg.desc, ch: seg.ch, loc: seg.loc, note: seg.note, time: seg.time });
      day += (seg.days || 1); return;
    }

    if (type === "base" || type === "in" || type === "out"){
      const n = seg.n || 1;
      for (let i=0;i<n;i++){
        const off = seg.every ? i * seg.every : Math.round(i * (span / Math.max(1,n-0.001)));
        let amt;
        if (seg.exact != null) amt = seg.exact;
        else if (seg.round) amt = Math.round(rInt(rnd, seg.lo, seg.hi) / seg.round) * seg.round;
        else amt = rInt(rnd, seg.lo, seg.hi);
        push({ day: day + off, dir: type === "out" ? "D" : (seg.dir || "C"), amt: amt, m: seg.m,
               cp: resolveCp(seg.cp, i), cc: Array.isArray(seg.cc) ? seg.cc[i % seg.cc.length] : seg.cc,
               desc: seg.desc, ch: seg.ch, loc: Array.isArray(seg.loc) ? seg.loc[i % seg.loc.length] : seg.loc,
               note: (i === 0 ? seg.note : (seg.noteAll ? seg.note : "")) });
      }
      day += span + (seg.after || 0); return;
    }

    if (type === "pair"){                       /* in then out shortly after */
      const n = seg.n || 3;
      for (let i=0;i<n;i++){
        const off = Math.round(i * (span / Math.max(1,n-0.001)));
        const amt = seg.exact != null ? seg.exact : rInt(rnd, seg.lo, seg.hi);
        push({ day: day+off, dir:"C", amt: amt, m: seg.m, cp: resolveCp(seg.cp, i),
               cc: Array.isArray(seg.cc)?seg.cc[i%seg.cc.length]:seg.cc, desc: seg.desc, ch: seg.ch, note: i===0?seg.note:"" });
        push({ day: day+off+(seg.lag||0), dir:"D", amt: Math.round(amt * (seg.keep != null ? (1-seg.keep) : 0.97)),
               m: seg.mOut || seg.m, cp: resolveCp(seg.to || "@entities", i),
               cc: Array.isArray(seg.ccOut)?seg.ccOut[i%seg.ccOut.length]:(seg.ccOut||seg.cc), desc: seg.descOut || seg.desc, ch: seg.chOut || seg.ch });
      }
      day += span + (seg.after||0); return;
    }

    if (type === "sweep"){                      /* consolidate recent credits */
      const since = seg.since != null ? seg.since : 0;
      const credits = txns.filter(x => x.dir === "C").slice(since);
      const total = sum(credits, x => x.amt);
      const parts = seg.parts || 1;
      const moving = total * (seg.ratio != null ? seg.ratio : 0.94);
      for (let i=0;i<parts;i++){
        push({ day: day + (seg.at || 0) + i*(seg.every||1), dir:"D", amt: moving/parts, m: seg.m,
               cp: resolveCp(seg.to, i), cc: seg.cc, desc: seg.desc, ch: seg.ch, note: i===0?seg.note:"" });
      }
      day += (seg.days || 1); return;
    }

    if (type === "cycle"){                      /* repeating collect-and-pay */
      const cycles = seg.cycles || 3, per = seg.n || 8;
      for (let c=0;c<cycles;c++){
        let tot = 0;
        for (let i=0;i<per;i++){
          const amt = seg.exact != null ? seg.exact : rInt(rnd, seg.lo, seg.hi);
          tot += amt;
          push({ day: day + c*(seg.every||30) + i, dir:"C", amt: amt, m: seg.m, cp: resolveCp(seg.cp, c*per+i),
                 cc: seg.cc, desc: seg.desc, ch: seg.ch });
        }
        push({ day: day + c*(seg.every||30) + per + (seg.lag||1), dir:"D", amt: tot * (seg.ratio != null ? seg.ratio : 0.97),
               m: seg.mOut || seg.m, cp: resolveCp(seg.to || "@people", c), cc: seg.ccOut || seg.cc,
               desc: seg.descOut || "Payout", ch: seg.chOut || seg.ch });
      }
      day += cycles * (seg.every||30); return;
    }
  });

  /* interleave chronologically, then renumber */
  txns.sort((a,b) => (a.d + a.t).localeCompare(b.d + b.t));
  let running = g.openBal != null ? g.openBal : Math.round((g.lo || 1000) * 2.4);
  txns.forEach((x,i) => {
    x.id = i + 1;
    running = x.dir === "C" ? running + x.amt : running - x.amt;
    if (running < 0) running = Math.round(x.amt * 0.02);
    x.bal = running;
  });
  return { txns, people: usedPeople.length ? usedPeople : people.slice(0,8), entities: usedEnt.length ? usedEnt : entities.slice(0,4) };
}
