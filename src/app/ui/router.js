/* --------------------------------------------------------------------------
   30. Router, rendering, event handling and boot
   Routes are real URLs (History API) so every screen is linkable, the back
   and forward buttons work, and a reload lands where you were. Static and
   file:// builds fall back to hash routes.
   -------------------------------------------------------------------------- */
const VIEW_TITLE = {
  dashboard:["Dashboard","Operational view of your queue, deadlines and progress"],
  queue:["Alert Queue","Every alert assigned to you — filter, sort and pick what to work first"],
  mine:["My Investigations","Alerts you have started but not completed"],
  customer:["Customer 360","Profile, products, expected activity, KYC and history"],
  txn:["Transactions","Search, filter, group and flag the alerted activity"],
  entity:["Entities","Relationship graph, counterparties and beneficiaries"],
  cases:["Case File","Alert triage, investigation actions, decision and disposition"],
  notes:["Investigation Notes","Contemporaneous documentation and the case timeline"],
  evidence:["Evidence","Source of funds and source of wealth documentation"],
  escalations:["Escalations","Referrals to the MLRO and cases in enhanced due diligence"],
  qa:["QA Review","Senior AML quality review of completed investigations"],
  performance:["Performance","Your cumulative analyst profile"],
  training:["Training","The case library and the practice-case generator"]
};
const CASE_SCOPED = { cases:"", customer:"customer", txn:"transactions", entity:"entities", notes:"notes", evidence:"evidence" };
const TOP_PATH = { dashboard:"dashboard", queue:"queue", mine:"investigations", escalations:"escalations", qa:"qa", performance:"performance", training:"training" };
const HASH_MODE = location.protocol === "file:" || import.meta.env.MODE === "single";
let ROUTE_REPLACE = false;

function viewFor(nav){
  switch(nav){
    case "dashboard": return viewDashboard();
    case "queue": return viewQueue(false);
    case "mine": return viewQueue(true);
    case "customer": return viewCustomer();
    case "txn": return viewTxn();
    case "entity": return viewEntity();
    case "cases": return viewCases();
    case "notes": return viewNotes();
    case "evidence": return viewEvidence();
    case "escalations": return viewEscalations();
    case "qa": return viewQA();
    case "performance": return viewPerformance();
    case "training": return viewTraining();
    default: return viewDashboard();
  }
}

/* --- paths ----------------------------------------------------------------- */
function sectionPath(nav, id){
  if (CASE_SCOPED[nav] != null){
    id = id || S.active;
    if (!id) return "/" + (nav === "cases" ? "case" : CASE_SCOPED[nav]);
    return "/cases/" + encodeURIComponent(id) + (CASE_SCOPED[nav] ? "/" + CASE_SCOPED[nav] : "");
  }
  return "/" + (TOP_PATH[nav] || "dashboard");
}
function hrefFor(nav, id){ const p = sectionPath(nav, id); return HASH_MODE ? "#" + p : p; }
function currentPath(){
  if (S.screen === "login") return "/welcome";
  let p = sectionPath(S.nav);
  if (S.active && CASE_SCOPED[S.nav] != null){
    if (S.nav === "cases" && S.tab && S.tab !== "overview") p += "/" + S.tab;
    if (S.nav === "customer" && S.tab && ["products","expected","kyc","history"].indexOf(S.tab) >= 0) p += "/" + S.tab;
    if (S.nav === "entity" && S.entityView != null) p += "/" + S.entityView;
  }
  return p;
}
function locationPath(){
  if (HASH_MODE) return (location.hash || "#/").slice(1) || "/";
  return location.pathname || "/";
}
function parsePath(p){
  const seg = p.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch(e){ return x; } });
  if (!seg.length) return {};
  if (seg[0] === "welcome") return { screen:"login" };
  if (seg[0] === "cases" && seg[1]){
    const back = { customer:"customer", transactions:"txn", entities:"entity", notes:"notes", evidence:"evidence" };
    const sub = seg[2] || "";
    if (back[sub]) return { nav:back[sub], id:seg[1], tab: sub === "customer" ? (seg[3] || "profile") : null,
                            entity: sub === "entities" && seg[3] != null ? seg[3] : null };
    return { nav:"cases", id:seg[1], tab: sub || "overview" };
  }
  const rev = { dashboard:"dashboard", queue:"queue", investigations:"mine", escalations:"escalations", qa:"qa",
    performance:"performance", training:"training", case:"cases", customer:"customer", transactions:"txn",
    entities:"entity", notes:"notes", evidence:"evidence" };
  return { nav: rev[seg[0]] || "dashboard" };
}
function applyRoute(r){
  if (!PROG.onboarded || r.screen === "login"){ S.screen = "login"; return; }
  S.screen = "app";
  S.nav = r.nav || PROG.lastNav || "dashboard";
  if (r.id){
    if (getCase(r.id)){
      if (S.active !== r.id) activateCase(r.id);
      S.tab = r.tab || (S.nav === "customer" ? "profile" : "overview");
      S.entityView = r.entity != null ? r.entity : null;
    } else {
      S.nav = "queue";
      setTimeout(() => toast("That alert isn't available in this workspace"), 60);
    }
  }
}

/* --- rendering --------------------------------------------------------------- */
let LAST_VIEW_KEY = "";
function viewKey(){ return S.screen + "|" + S.nav + "|" + S.active + "|" + S.tab + "|" + S.entityView; }
function syncUrl(){
  const p = currentPath();
  if (locationPath() !== p){
    const url = HASH_MODE ? "#" + p : p;
    if (ROUTE_REPLACE) history.replaceState(null, "", url); else history.pushState(null, "", url);
  }
  ROUTE_REPLACE = false;
  const t = S.screen === "login" ? "Welcome" : (VIEW_TITLE[S.nav] || VIEW_TITLE.dashboard)[0];
  const c = S.active && CASE_SCOPED[S.nav] != null ? getCase(S.active) : null;
  document.title = (c ? c.alert.ref + " · " : "") + t + " — CamelAML";
}
function topActions(c){
  const urgent = queueRows().filter(r => r.sla.overdue || r.sla.left < 6 * 3600e3).length;
  return '<button class="icon-btn tb-hide-sm" data-act="palette" aria-label="Search and commands">' + icon("search", 18) + '</button>' +
    '<button class="icon-btn" data-act="notif" aria-haspopup="menu" aria-label="Deadlines' + (urgent ? ", " + urgent + " urgent" : "") + '">' +
      icon("bell", 18) + (urgent ? '<span class="dot"></span>' : "") + '</button>' +
    (c && CASE_SCOPED[S.nav] != null && S.nav !== "cases"
      ? '<a class="btn primary" href="' + hrefFor("cases") + '" data-act="nav" data-id="cases">' + icon("cases", 16) + '<span class="tb-hide-sm">Case file</span></a>'
      : '<button class="btn primary" data-act="nextcase">' + icon("zap", 16) + '<span class="tb-hide-sm">Take next alert</span></button>');
}
function render(){
  const app = $("#app");
  applyAppearance();
  document.body.classList.toggle("is-welcome", S.screen === "login");
  const key = viewKey(), sameView = key === LAST_VIEW_KEY;
  const oldPanel = $("#panel"), oldSide = $(".side");
  const keepScroll = sameView && oldPanel ? oldPanel.scrollTop : 0;
  const keepSide = oldSide ? oldSide.scrollTop : 0;

  if (S.screen === "login"){
    app.innerHTML = viewLogin(); renderLayer(); syncUrl(); LAST_VIEW_KEY = key; return;
  }
  buildQueue();
  const t = VIEW_TITLE[S.nav] || VIEW_TITLE.dashboard;
  const c = S.active ? getCase(S.active) : null;
  const scoped = CASE_SCOPED[S.nav] != null && c;
  const crumbs = scoped ? '<div class="crumbs"><a href="' + hrefFor("queue") + '" data-act="nav" data-id="queue">Alert Queue</a>' +
    icon("right", 12) + '<span class="mono">' + esc(c.alert.ref) + '</span></div>' : "";
  app.innerHTML =
    '<div class="shell">' + sidebarHTML() +
    '<main class="main"><div class="panel" id="panel">' + topbarHTML(t[0], esc(t[1]), topActions(c), crumbs) +
    '<div class="content' + (sameView ? "" : " fade") + '" id="content">' + viewFor(S.nav) + '</div>' +
    '</div></main></div>' + tabbarHTML() +
    (S.sideOpen ? '<div class="scrim" data-act="side"></div>' : "");
  renderLayer();
  const panel = $("#panel"), side = $(".side");
  if (panel){ panel.scrollTop = keepScroll; panel.addEventListener("scroll", onScroll, { passive:true }); }
  if (side) side.scrollTop = keepSide;
  onScroll();
  if (!sameView && LAST_VIEW_KEY){ const h1 = $(".topbar h1"); if (h1){ h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll:true }); } }
  LAST_VIEW_KEY = key;
  PROG.lastNav = S.nav; saveProg();
  syncUrl();
}
function onScroll(){ const tb = $("#topbar"), p = $("#panel"); if (tb && p) tb.classList.toggle("scrolled", p.scrollTop > 4); }
function scrollPanelTop(smooth){ const p = $("#panel"); if (p) p.scrollTo({ top:0, behavior: smooth ? "smooth" : "auto" }); }

/* navigate with a view transition where the browser supports it */
function go(mutate){
  const run = () => { mutate(); render(); };
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduce) document.startViewTransition(run); else run();
}

function applyAppearance(){
  const r = document.documentElement;
  if (PROG.theme) r.setAttribute("data-theme", PROG.theme); else r.removeAttribute("data-theme");
  r.style.setProperty("--ts", String(PROG.textScale || 1));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#0B0B0C");
}

/* --- opening and switching cases ------------------------------------------- */
function activateCase(id){
  const c = getCase(id); if (!c) return null;
  S.active = id; S.entityView = null; S.tab = "overview";
  S.txnF = { q:"", dir:"", cc:"", method:"", channel:"", cp:"", min:"", max:"", from:"", to:"", sort:"d", asc:true, group:"" };
  const w = work(id);
  if (!w.opened){
    w.opened = true;
    if (w.status === "new" || w.status === "assigned") w.status = "assigned";
    logIt(id, "Alert " + c.alert.ref + " opened and assigned to " + (PROG.analyst || "analyst"), "k");
  }
  if (PROG.queue.indexOf(id) < 0 && !PROG.completed[id]) PROG.queue.unshift(id);
  saveProg();
  return c;
}
function openCase(id){
  if (!getCase(id)) return;
  go(() => { activateCase(id); S.nav = "cases"; S.sideOpen = false; });
  scrollPanelTop();
}
function switchCaseModal(){
  const rows = queueRows();
  openModal('<div class="modal-h"><h3>Switch alert</h3><button class="btn sm ghost" data-act="close-modal" aria-label="Close">' + icon("x", 16) + '</button></div>' +
    '<div class="modal-b" style="padding:0"><p class="page-lead" style="padding:18px 22px 0">You hold several alerts at once. Deciding what to work first is part of the job — ' +
    'weigh SLA against risk, not one or the other.</p>' +
    '<div class="tw"><table class="tbl"><thead><tr><th>Alert</th><th>Customer</th><th>Priority</th><th>Status</th><th>SLA</th></tr></thead><tbody>' +
    rows.map(r => '<tr class="clickable' + (r.c.id===S.active?" sel":"") + '" data-act="open" data-id="' + r.c.id + '">' +
      '<td class="mono">' + esc(r.c.alert.ref) + '</td><td>' + esc(r.c.customer.name) + '</td>' +
      '<td>' + priorityPill(r.c.alert.priority) + '</td><td>' + statusPill(r.w.status) + '</td>' +
      '<td>' + slaBar(r.sla) + '</td></tr>').join("") + '</tbody></table></div></div>');
}
function nextCase(){
  buildQueue(true);
  const rows = queueRows().filter(r => !PROG.completed[r.c.id]);
  if (!rows.length){ const id = generateCase({}); return openCase(id); }
  rows.sort((a,b) => a.sla.left - b.sla.left);
  openCase(rows[0].c.id);
}

/* --- popover menus ------------------------------------------------------------ */
function openPop(anchor, html, align){
  closePop();
  const r = anchor.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "pop"; el.id = "pop"; el.setAttribute("role", "menu"); el.innerHTML = html;
  document.body.appendChild(el);
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = align === "right" ? r.right - w : r.left;
  let top = r.bottom + 8;
  if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 8);
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, left)) + "px";
  el.style.top = top + "px";
  const first = el.querySelector("button"); if (first) first.focus({ preventScroll:true });
}
function closePop(){ const p = $("#pop"); if (p) p.remove(); }
function instMenu(anchor){
  openPop(anchor, '<div class="pop-h">Switch workspace</div>' + INSTITUTIONS.map(I =>
    '<button class="pop-item" role="menuitem" data-act="setinst" data-id="' + I.id + '">' + icon(INST_ICON[I.id], 16) +
    '<span><span style="display:block;font-weight:600">' + esc(I.short) + '</span><span class="tiny">' + esc(I.name) + '</span></span>' +
    (I.id === PROG.inst ? '<span class="chk">' + icon("check", 16) + '</span>' : "") + '</button>').join(""));
}
function acctMenu(anchor){
  const th = PROG.theme || "";
  openPop(anchor, '<div class="pop-h">Appearance</div>' +
    [["", "System", "monitor"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]].map(o =>
      '<button class="pop-item" role="menuitemradio" aria-checked="' + (th === o[0]) + '" data-act="settheme" data-id="' + o[0] + '">' + icon(o[2], 16) + o[1] +
      (th === o[0] ? '<span class="chk">' + icon("check", 16) + '</span>' : "") + '</button>').join("") +
    '<div class="pop-sep"></div>' +
    '<button class="pop-item" role="menuitem" data-act="settings">' + icon("settings", 16) + 'Settings</button>' +
    '<button class="pop-item" role="menuitem" data-act="palette">' + icon("keyboard", 16) + 'Commands<span class="chk"><kbd>' + (isMac() ? "⌘" : "Ctrl") + ' K</kbd></span></button>' +
    '<div class="pop-sep"></div>' +
    '<button class="pop-item" role="menuitem" data-act="signout">' + icon("logout", 16) + 'Switch workspace or role</button>', "right");
}
function notifMenu(anchor){
  const rows = queueRows().slice().sort((a,b) => a.sla.left - b.sla.left).filter(r => r.sla.overdue || r.sla.left < 24 * 3600e3).slice(0, 6);
  openPop(anchor, '<div class="pop-h">Deadlines</div>' + (rows.length ? rows.map(r =>
    '<button class="pop-item" role="menuitem" data-act="open" data-id="' + r.c.id + '">' + icon(r.sla.overdue ? "alert" : "clock", 16) +
    '<span class="grow"><span style="display:block;font-weight:600" class="mono">' + esc(r.c.alert.ref) + '</span><span class="tiny">' + esc(r.c.customer.name) + '</span></span>' +
    '<span class="pill ' + (r.sla.overdue ? "red" : "orange") + '">' + esc(r.sla.label) + '</span></button>').join("")
    : '<div class="pop-item" style="cursor:default">' + icon("done", 16) + 'Nothing due in the next 24 hours</div>'), "right");
}


/* --- settings ------------------------------------------------------------- */
function settingsModal(){
  openModal('<div class="modal-h"><h3>Settings</h3><button class="btn sm ghost" data-act="close-modal" aria-label="Close">' + icon("x", 16) + '</button></div>' +
    '<div class="modal-b">' +
    '<label class="field"><span class="lbl">Analyst name</span><input class="inp" id="setName" value="' + esc(PROG.analyst) + '" maxlength="40"></label>' +
    '<label class="field"><span class="lbl">Role</span><select class="inp" id="setRole">' +
      Object.keys(ROLES).map(k => '<option value="' + k + '"' + (PROG.role===k?" selected":"") + '>' + ROLES[k].label + '</option>').join("") +
    '</select></label>' +
    '<label class="field"><span class="lbl">Institution — changing this rebuilds your alert queue</span><select class="inp" id="setInst">' +
      INSTITUTIONS.map(I => '<option value="' + I.id + '"' + (PROG.inst===I.id?" selected":"") + '>' + esc(I.name) + '</option>').join("") +
    '</select></label>' +
    '<label class="field"><span class="lbl">Appearance</span><select class="inp" id="setTheme">' +
      '<option value=""' + (!PROG.theme?" selected":"") + '>Match the system</option>' +
      '<option value="light"' + (PROG.theme==="light"?" selected":"") + '>Light</option>' +
      '<option value="dark"' + (PROG.theme==="dark"?" selected":"") + '>Dark</option></select></label>' +
    '<label class="field"><span class="lbl">Text size — ' + Math.round((PROG.textScale||1)*100) + '%</span>' +
      '<input class="inp" id="setScale" type="range" min="0.85" max="2" step="0.05" value="' + (PROG.textScale||1) + '"></label>' +
    '<div class="callout" style="margin-bottom:14px">Text scales up to 200%. Layouts reflow rather than truncate.</div>' +
    '<div class="btn-row"><button class="btn primary" data-act="savesettings">Save</button>' +
    '<button class="btn danger" data-act="reset">Reset all progress</button>' +
    '<button class="btn ghost" data-act="close-modal">Cancel</button></div></div>');
}


/* --- actions -------------------------------------------------------------- */
function doAsk(id){
  const c = getCase(S.active), w = work(c.id);
  if (askedIds(w).indexOf(id) >= 0) return;
  const r = c.requests.find(x => x.id === id); if (!r) return;
  const T = TEAMS[r.to] || TEAMS.ops;
  if (r.to === "customer" && !ROLES[PROG.role].can.requestCustomer) return toast("Your role cannot contact the customer directly.");
  let resp = r.resp;
  if (r.kind === "sanctions") resp = SANC_KIND[c.sanctions.kind].body;
  if (r.kind === "media") resp = MEDIA_KIND[c.media.kind].body;
  if (r.kind === "docs" && !resp) resp = "Documents obtained. See Evidence & Documents.";
  w.asked.push({ id:id, at:nowClock(), resp:resp || "No response was received within the period allowed." });
  if (r.to === "customer" && w.status === "investigating") w.status = "pending";
  logIt(c.id, "Requested: " + r.label + " (" + T.label + ")");
  if (r.kind === "sanctions") logIt(c.id, "Sanctions screening result: " + SANC_KIND[c.sanctions.kind].label);
  if (r.kind === "media") logIt(c.id, "Adverse media result: " + MEDIA_KIND[c.media.kind].label);
  saveProg(); render(); toast("Response received from " + T.label);
}
function addNote(kind, body, idx){
  const c = getCase(S.active), w = work(c.id);
  if (!body.trim()) return toast("Write the note first.");
  if (idx != null && w.notes[idx]){ w.notes[idx].body = body; w.notes[idx].kind = kind; logIt(c.id, "Investigation note updated"); }
  else { w.notes.push({ kind, body, at: nowClock() }); logIt(c.id, "Note recorded: " + (NOTE_KINDS.find(k=>k[0]===kind)||["","Note"])[1]); }
  saveProg(); render(); toast("Note saved");
}


/* --- click handling ------------------------------------------------------------ */
let POP_ACT = null;
function navTo(id){
  const item = NAV.flatMap(g => g.items).find(x => x.id === id);
  go(() => {
    if (item && item.needsCase && !S.active){ S.nav = "queue"; setTimeout(() => toast("Open an alert first"), 40); }
    else S.nav = id;
    S.sideOpen = false; S.entityView = null;
    if (id === "cases") S.tab = "overview";
    if (id === "customer") S.tab = "profile";
  });
  scrollPanelTop();
}
function togglePop(act, anchor, fn){
  if ($("#pop") && POP_ACT === act){ closePop(); POP_ACT = null; return; }
  fn(anchor); POP_ACT = act;
}

document.addEventListener("click", function(e){
  const pop = $("#pop");
  const el = e.target.closest("[data-act]");
  if (pop && !pop.contains(e.target) && !(el && el.getAttribute("data-act") === POP_ACT)){ closePop(); POP_ACT = null; }
  if (!el) return;
  /* let modified clicks on real links open a new tab or window */
  if (el.tagName === "A"){
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
  }
  const act = el.getAttribute("data-act"), id = el.getAttribute("data-id");
  const c = S.active ? getCase(S.active) : null;
  if (pop && pop.contains(el) && ["instmenu","acctmenu","notif"].indexOf(act) < 0){ closePop(); POP_ACT = null; }

  switch(act){
    case "pick-inst": PROG.inst = id; PROG.queue = []; saveProg(); render(); break;
    case "pick-role": PROG.role = id; saveProg(); render(); break;
    case "start": {
      const n = $("#analystName"); PROG.analyst = (n && n.value.trim()) || "Analyst";
      PROG.onboarded = true; PROG.queue = []; PROG.sessionStart = Date.now();
      go(() => { S.screen = "app"; S.nav = "dashboard"; S.active = null; });
      saveProg(); toast("Signed in to " + inst(PROG.inst).name); break; }
    case "resume": go(() => {
        S.screen = "app"; S.nav = PROG.lastNav || "dashboard";
        if (CASE_SCOPED[S.nav] != null && !S.active) S.nav = "dashboard";
      }); break;
    case "signout": go(() => { S.screen = "login"; S.sideOpen = false; }); break;
    case "nav": navTo(id); break;
    case "side": S.sideOpen = !S.sideOpen; render(); break;
    case "tab": S.tab = id; render(); break;
    case "sort": if (S.sort.key === id) S.sort.asc = !S.sort.asc; else { S.sort.key = id; S.sort.asc = true; } render(); break;
    case "tsort": if (S.txnF.sort === id) S.txnF.asc = !S.txnF.asc; else { S.txnF.sort = id; S.txnF.asc = true; } render(); break;
    case "clearf": S.filters = { q:"", risk:"", priority:"", status:"", rule:"", level:"", sla:"", country:"" }; render(); break;
    case "cleartf": S.txnF = Object.assign(S.txnF, { q:"", dir:"", cc:"", method:"", channel:"", cp:"", min:"", max:"", from:"", to:"", group:"" }); render(); break;
    case "open": closeModal(); closePalette(); openCase(id); break;
    case "switchcase": switchCaseModal(); break;
    case "nextcase": closePalette(); nextCase(); break;
    case "flagtxn": {
      if (!c) break; const w = work(c.id), n = Number(id);
      if (w.flags.has(n)){ w.flags.delete(n); logIt(c.id, "Flag removed from transaction " + n); }
      else { w.flags.add(n); logIt(c.id, "Transaction " + n + " flagged as relevant"); }
      saveProg(); closeModal(); render(); break; }
    case "txndetail": if (c) txnDetailModal(c, Number(id)); break;
    case "cp-from-txn": {
      if (!c) break; const i = c.counterparties.findIndex(x => x.name === id);
      closeModal(); if (i >= 0){ go(() => { S.nav = "entity"; S.entityView = String(i); }); scrollPanelTop(); } break; }
    case "entity": go(() => { S.nav = "entity"; S.entityView = id; }); scrollPanelTop(); break;
    case "entity-back": go(() => { S.entityView = null; }); break;
    case "gnode": {
      if (!c) break;
      const n = c.graph.nodes.find(x => x.id === id);
      if (n && n.cpIndex != null){ go(() => { S.entityView = String(n.cpIndex); }); scrollPanelTop(); }
      else if (n && n.id === "CUST"){ go(() => { S.nav = "customer"; S.tab = "profile"; }); scrollPanelTop(); }
      break; }
    case "ungroup": S.txnF.group = ""; S.txnF.q = id; render(); break;
    case "notefor": go(() => { S.nav = "notes"; });
      setTimeout(() => { const b = $("#noteBody"); if (b){ b.value = "Entity: " + id + " — "; b.focus(); } }, 60); break;
    case "ask": doAsk(id); break;
    case "decide": {
      if (!c) break; const w = work(c.id);
      w.decision = w.decision === id ? null : id;
      if (w.decision) logIt(c.id, "Provisional decision: " + OUTCOME_NAME[w.decision]);
      saveProg(); render(); break; }
    case "savedisp": {
      if (!c) break; const w = work(c.id), d = $("#dispo");
      if (d){ w.disposition = d.value; saveProg(); toast("Draft saved"); }
      break; }
    case "submit": {
      const d = $("#dispo"); if (d && c) work(c.id).disposition = d.value;
      const sar = $("#sarRec"); if (sar && c) work(c.id).sarRecommended = sar.checked;
      submitCase(); break; }
    case "hint": {
      if (!c) break; const w = work(c.id);
      if (w.hints >= 3) return toast("No hints remain on this case.");
      w.hints++; logIt(c.id, "Hint requested (" + w.hints + " of 3)");
      saveProg(); render(); break; }
    case "addnote": {
      const k = $("#noteKind"), b = $("#noteBody");
      if (k && b){ addNote(k.value, b.value); } break; }
    case "editnote": {
      if (!c) break; const w = work(c.id), n = w.notes[Number(id)];
      if (!n) break;
      openModal('<div class="modal-h"><h3>Edit note</h3><button class="btn sm ghost" data-act="close-modal" aria-label="Close">' + icon("x", 16) + '</button></div>' +
        '<div class="modal-b"><label class="field"><span class="lbl">Note type</span><select class="inp" id="editKind">' +
        NOTE_KINDS.map(x => '<option value="' + x[0] + '"' + (n.kind===x[0]?" selected":"") + '>' + x[1] + '</option>').join("") +
        '</select></label><label class="field"><span class="lbl">Note</span><textarea class="inp" id="editBody" rows="6">' + esc(n.body) + '</textarea></label>' +
        '<div class="btn-row"><button class="btn primary" data-act="saveedit" data-id="' + id + '">Save</button>' +
        '<button class="btn ghost" data-act="close-modal">Cancel</button></div></div>');
      break; }
    case "saveedit": {
      const k = $("#editKind"), b = $("#editBody");
      if (k && b){ closeModal(); addNote(k.value, b.value, Number(id)); } break; }
    case "delnote": {
      if (!c) break; const w = work(c.id);
      w.notes.splice(Number(id), 1); logIt(c.id, "Investigation note deleted"); saveProg(); render(); break; }
    case "gen": {
      const lv = $("#genLevel"), pt = $("#genPattern"), it = $("#genInst");
      const newId = generateCase({ level: lv && lv.value ? Number(lv.value) : null,
        pattern: pt && pt.value ? pt.value : null, inst: it ? it.value : PROG.inst });
      closePalette(); openCase(newId); toast("Practice case generated"); break; }
    case "palette": closePop(); openPalette(); break;
    case "instmenu": togglePop(act, el, instMenu); break;
    case "acctmenu": togglePop(act, el, acctMenu); break;
    case "notif": togglePop(act, el, notifMenu); break;
    case "setinst": {
      if (id !== PROG.inst){
        PROG.inst = id; PROG.queue = []; S.active = null;
        go(() => { if (CASE_SCOPED[S.nav] != null) S.nav = "dashboard"; });
        saveProg(); toast("Switched to " + inst(id).name);
      }
      break; }
    case "settheme": PROG.theme = id || ""; saveProg(); render(); break;
    case "chartview": {
      S.chartView[id] = el.getAttribute("data-v");
      const card = document.getElementById(id);
      if (card){
        card.setAttribute("data-view", S.chartView[id]);
        card.querySelectorAll('[data-act="chartview"]').forEach(b => b.setAttribute("aria-pressed", String(b === el)));
      }
      break; }
    case "settings": closePalette(); settingsModal(); break;
    case "savesettings": {
      const n = $("#setName"), r = $("#setRole"), i = $("#setInst"), t = $("#setTheme"), s = $("#setScale");
      if (n) PROG.analyst = n.value.trim() || "Analyst";
      if (r) PROG.role = r.value;
      if (t) PROG.theme = t.value;
      if (s) PROG.textScale = Number(s.value);
      if (i && i.value !== PROG.inst){ PROG.inst = i.value; PROG.queue = []; S.active = null; if (CASE_SCOPED[S.nav] != null) S.nav = "dashboard"; }
      closeModal(); saveProg(); render(); toast("Settings saved"); break; }
    case "theme": {
      PROG.theme = PROG.theme === "dark" ? "light" : PROG.theme === "light" ? "" : "dark";
      saveProg(); render();
      toast("Appearance: " + (PROG.theme || "match the system")); break; }
    case "reset": if (confirm("Reset all progress, completed cases and performance history? This cannot be undone.")){
        resetProg(); S.screen = "login"; S.active = null; closeModal(); render(); } break;
    case "close-modal": closeModal(); break;
    case "modal-bg": if (e.target === el) closeModal(); break;
  }
});

/* --- filter inputs ---------------------------------------------------------------- */
document.addEventListener("input", function(e){
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute("data-f")){ S.filters[t.getAttribute("data-f")] = t.value; debounceRender(); }
  else if (t.hasAttribute && t.hasAttribute("data-tf")){ S.txnF[t.getAttribute("data-tf")] = t.value; debounceRender(); }
  else if (t.id === "dispo"){ const wc = $("#wc"); if (wc) wc.textContent = (t.value.trim() ? t.value.trim().split(/\s+/).length : 0) + " words"; }
  else if (t.id === "setScale"){ document.documentElement.style.setProperty("--ts", t.value);
    const lbl = t.closest(".field"); if (lbl) lbl.querySelector(".lbl").textContent = "Text size — " + Math.round(t.value*100) + "%"; }
});
document.addEventListener("change", function(e){
  const t = e.target;
  if (t.hasAttribute && (t.hasAttribute("data-f") || t.hasAttribute("data-tf"))){
    if (t.hasAttribute("data-f")) S.filters[t.getAttribute("data-f")] = t.value;
    else S.txnF[t.getAttribute("data-tf")] = t.value;
    render();
  }
});
let _rt = null;
function debounceRender(){
  clearTimeout(_rt);
  _rt = setTimeout(() => {
    const a = document.activeElement;
    const key = a && (a.getAttribute("data-f") || a.getAttribute("data-tf"));
    const pos = a && a.selectionStart;
    render();
    if (key){
      const next = document.querySelector('[data-f="' + key + '"],[data-tf="' + key + '"]');
      if (next){ next.focus({ preventScroll:true }); try { next.setSelectionRange(pos, pos); } catch(err){} }
    }
  }, 220);
}

/* --- keyboard ------------------------------------------------------------------------ */
function typingIn(t){ return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); }
document.addEventListener("keydown", function(e){
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"){
    e.preventDefault();
    if (S.screen !== "app") return;
    if (paletteOpen()) closePalette(); else { closePop(); openPalette(); }
    return;
  }
  if (paletteOpen()) return;                     /* the palette handles its own keys */
  if (e.key === "Escape"){
    if ($("#pop")){ closePop(); POP_ACT = null; return; }
    if (S.modal){ closeModal(); return; }
    if (S.sideOpen){ S.sideOpen = false; render(); return; }
  }
  if (e.key === "/" && S.screen === "app" && !typingIn(e.target) && !S.modal){ e.preventDefault(); openPalette(); return; }
  if (e.key === "Enter" && (e.target.id === "analystName")) { const b = document.querySelector('[data-act="start"]'); if (b) b.click(); }
  if (e.key === "Enter" && e.target.classList && e.target.classList.contains("gnode")) e.target.click();
  const pop = $("#pop");
  if (pop && (e.key === "ArrowDown" || e.key === "ArrowUp")){
    const items = Array.from(pop.querySelectorAll("button.pop-item"));
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  }
});
document.addEventListener("keyup", function(e){
  if (e.key === " "){
    const g = e.target.closest && e.target.closest(".gnode");
    if (g){ e.preventDefault(); g.click(); }
  }
});

/* --- history ------------------------------------------------------------------------- */
window.addEventListener("popstate", function(){
  closePop(); closePalette(); if (S.modal) closeModal();
  applyRoute(parsePath(locationPath()));
  ROUTE_REPLACE = true;
  render();
});
window.addEventListener("resize", function(){ closePop(); });

/* --- boot ---------------------------------------------------------------------------- */
function boot(){
  registerCases();
  loadProg();
  applyAppearance();
  /* completed generated cases saved before seeds were persisted stay listed in history */
  Object.keys(PROG.completed).forEach(id => {
    if (!CASE_INDEX.some(x => x.id === id)){
      const r = PROG.completed[id];
      CASE_INDEX.push({ id, kind:r.kind, level:r.level, inst:r.inst, title:r.title, rule:r.rule,
        outcome:r.outcome, priority:"medium", src:"generated" });
    }
  });
  PROG.queue = (PROG.queue||[]).filter(id => getCase(id) && !PROG.completed[id]);
  const r = parsePath(locationPath());
  if (!r.nav && !r.screen && PROG.lastNav && CASE_SCOPED[PROG.lastNav] == null) r.nav = PROG.lastNav;
  applyRoute(r);
  ROUTE_REPLACE = true;
  if (S.screen === "app") buildQueue();
  render();
  document.documentElement.classList.add("booted");
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
