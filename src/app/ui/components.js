
/* --------------------------------------------------------------------------
   15. UI state and shared components
   -------------------------------------------------------------------------- */
const S = {
  screen:"login", nav:"dashboard", active:null, tab:"overview",
  sideOpen:false, busy:false, modal:null, toast:null,
  filters:{ q:"", risk:"", priority:"", status:"", rule:"", level:"", sla:"" },
  txnF:{ q:"", dir:"", cc:"", method:"", channel:"", cp:"", min:"", max:"", from:"", to:"", sort:"d", asc:true, group:"" },
  entityView:null, sort:{ key:"sla", asc:true }, chartView:{}
};

const NAV = [
  { g:"Workspace", items:[
    { id:"dashboard",   label:"Dashboard",           icon:"dashboard" },
    { id:"queue",       label:"Alert Queue",         icon:"queue" },
    { id:"mine",        label:"My Investigations",   icon:"mine" }]},
  { g:"Investigate", items:[
    { id:"customer",    label:"Customer 360",        icon:"customer", needsCase:true },
    { id:"txn",         label:"Transactions",        icon:"txn",      needsCase:true },
    { id:"entity",      label:"Entities",            icon:"entity",   needsCase:true }]},
  { g:"Casework", items:[
    { id:"cases",       label:"Case File",           icon:"cases",    needsCase:true },
    { id:"notes",       label:"Notes",               icon:"notes",    needsCase:true },
    { id:"evidence",    label:"Evidence",            icon:"evidence", needsCase:true },
    { id:"escalations", label:"Escalations",         icon:"escalations" }]},
  { g:"Oversight", items:[
    { id:"qa",          label:"QA Review",           icon:"qa" },
    { id:"performance", label:"Performance",         icon:"performance" },
    { id:"training",    label:"Training",            icon:"training" }]}
];
const MOBILE_TABS = ["dashboard","queue","cases","txn","performance"];

/* --- small components ---------------------------------------------------- */
function pill(text, tone, glyph){
  return '<span class="pill ' + (tone||"") + '">' + (glyph ? '<span aria-hidden="true">' + glyph + '</span>' : "") + esc(text) + '</span>';
}
function statusPill(st){ const s = STATUS[st] || STATUS.new; return pill(s.label, s.tone); }
function priorityPill(p){ const x = PRIORITY[p] || PRIORITY.medium; return pill(x.label, x.tone, x.glyph); }
function riskPill(r){ const x = RISK[r] || RISK.low; return pill(x.label + " risk", x.tone); }
function levelPill(l){ return pill(LEVEL_SHORT[l] || ("L"+l), l >= 4 ? "purple" : l === 3 ? "blue" : ""); }
function kindPill(k){
  return k === "real" ? pill("Documented basis", "teal")
       : k === "generated" ? pill("Generated practice", "")
       : pill("Fictional", "brown");
}
function slaBar(sla){
  return '<span class="sla" title="' + esc(sla.label) + '">' +
    '<span class="sla-bar"><i class="sla-fill ' + sla.tone + '" style="width:' + Math.round(sla.usedPct*100) + '%"></i></span>' +
    '<span class="sla-t' + (sla.overdue ? '" style="color:var(--red)' : '') + '">' + esc(sla.label) + '</span></span>';
}
function dl(pairs){
  return '<dl class="dl">' + pairs.filter(p => p && p[1] != null && p[1] !== "")
    .map(p => '<dt>' + esc(p[0]) + '</dt><dd>' + (p[2] === "html" ? p[1] : esc(p[1])) + '</dd>').join("") + '</dl>';
}
function tile(k, v, m, accent){
  return '<div class="tile' + (accent ? " accent-" + accent : "") + '"><div class="k">' + esc(k) + '</div>' +
    '<div class="v' + (String(v).length > 9 ? " sm" : "") + '">' + esc(String(v)) + '</div>' +
    (m ? '<div class="m">' + esc(m) + '</div>' : "") + '</div>';
}
function card(title, body, right, cls){
  return '<section class="card ' + (cls||"") + '">' +
    (title ? '<div class="card-h"><h3>' + esc(title) + '</h3>' + (right || "") + '</div>' : "") +
    '<div class="card-b">' + body + '</div></section>';
}
function cardFlush(title, body, right){
  return '<section class="card"><div class="card-h"><h3>' + esc(title) + '</h3>' + (right||"") + '</div>' +
    '<div class="card-b flush">' + body + '</div></section>';
}
const EMPTY_ICON = { "▣":"cases", "❐":"evidence", "✎":"notes", "☰":"queue", "↑":"escalations", "✓":"qa", "◔":"performance", "◈":"entity" };
function empty(glyph, head, body, action){
  const ic = icon(EMPTY_ICON[glyph] || glyph, 24);
  return '<div class="empty"><div class="big" aria-hidden="true">' + ic + '</div><h3>' + esc(head) + '</h3>' +
    '<p>' + esc(body) + '</p>' + (action || "") + '</div>';
}
function bars(rows, max){
  max = max || Math.max.apply(null, rows.map(r => r[1]).concat([1]));
  return rows.map(r => '<div class="scorebar"><span>' + esc(r[0]) + '</span>' +
    '<span class="bar"><i style="width:' + Math.round(r[1]/max*100) + '%' + (r[2] ? ';background:var(--' + r[2] + ')' : '') + '"></i></span>' +
    '<span class="right num tiny">' + esc(String(r[3] != null ? r[3] : r[1])) + '</span></div>').join("");
}
function toast(msg, ms){
  S.toast = msg;
  const l = $("#layer");
  const old = $("#toast-live"); if (old) old.remove();
  l.insertAdjacentHTML("beforeend", '<div class="toast" id="toast-live" role="status">' + icon("done", 16) + esc(msg) + '</div>');
  setTimeout(() => { const t = $("#toast-live"); if (t) t.remove(); }, ms || 2600);
}
function openModal(html){ S.modal = html; renderLayer(); }
function closeModal(){ S.modal = null; renderLayer(); }
function renderLayer(){
  const l = $("#layer");
  l.innerHTML = S.modal ? '<div class="modal-bg" data-act="modal-bg"><div class="modal fade" role="dialog" aria-modal="true">' + S.modal + '</div></div>' : "";
  if (S.modal){ const f = l.querySelector("button,input,textarea,select,a[href]"); if (f) f.focus(); }
}

/* --- shell --------------------------------------------------------------- */
function navCount(id){
  const rows = queueRows();
  if (id === "queue") return rows.filter(r => r.w.status === "new" || r.w.status === "assigned").length;
  if (id === "mine") return rows.filter(r => ["investigating","pending"].indexOf(r.w.status) >= 0).length;
  if (id === "escalations") return rows.filter(r => r.w.status === "escalated").length +
    completedList().filter(r => r.decision === "escalate").length;
  if (id === "qa") return completedList().filter(r => r.qa).length;
  return 0;
}
function wordmark(){ return '<span class="wordmark">Camel<b>AML</b></span>'; }
function sidebarHTML(){
  const I = inst(PROG.inst), role = ROLES[PROG.role];
  let h = '<nav class="side' + (S.sideOpen ? " open" : "") + '" aria-label="Primary">';
  h += '<a class="brand" href="' + hrefFor("dashboard") + '" data-act="nav" data-id="dashboard" aria-label="CamelAML home">' +
       '<img src="' + MARK_DARK + '" alt="" width="34" height="31">' +
       '<div>' + wordmark() + '<div class="wordmark-tag">Think like an analyst</div></div></a>';
  h += '<button class="ws" data-act="instmenu" aria-haspopup="menu">' +
       '<span class="ws-ic">' + icon(INST_ICON[I.id] || "landmark", 18) + '</span>' +
       '<span class="grow"><span class="ws-k" style="display:block">' + esc(I.short) + ' workspace</span>' +
       '<span class="ws-v" style="display:block">' + esc(I.name) + '</span></span>' + icon("updown", 16) + '</button>';
  h += '<button class="side-search" data-act="palette">' + icon("search", 16) + '<span>Search…</span><kbd>' + (isMac() ? "⌘" : "Ctrl") + ' K</kbd></button>';
  NAV.forEach(g => {
    h += '<div class="nav-group"><h4>' + esc(g.g) + '</h4>';
    g.items.forEach(it => {
      const n = navCount(it.id);
      const dis = it.needsCase && !S.active;
      h += '<a class="nav-item" href="' + hrefFor(it.id) + '" data-act="nav" data-id="' + it.id + '"' +
        (S.nav === it.id ? ' aria-current="page"' : "") + (dis ? ' aria-disabled="true" title="Open an alert first"' : "") + '>' +
        icon(it.icon, 18) + '<span class="nv-l">' + esc(it.label) + '</span>' +
        (n ? '<span class="nv-c' + (it.id === "queue" ? " gold" : "") + '">' + n + '</span>' : "") + '</a>';
    });
    h += '</div>';
  });
  h += '<div class="side-foot">' +
    '<a class="nav-item" href="#" data-act="settings">' + icon("settings", 18) + '<span class="nv-l">Settings</span></a>' +
    '<div class="acct"><div class="avatar" aria-hidden="true">' + esc(initials(PROG.analyst)) + '</div>' +
    '<div class="grow"><div class="acct-n">' + esc(PROG.analyst || "Analyst") + '</div><div class="acct-r">' + esc(role.label) + '</div></div>' +
    '<button class="icon-btn-dark" data-act="acctmenu" aria-label="Account menu" aria-haspopup="menu">' + icon("more", 18) + '</button></div></div>';
  return h + '</nav>';
}
function initials(n){ const p = String(n || "Analyst").replace(/[^A-Za-z .-]/g, "").trim().split(/[ .-]+/).filter(Boolean);
  return ((p[0] || "A")[0] + (p.length > 1 ? p[p.length - 1][0] : (p[0] || "N")[1] || "")).toUpperCase(); }
function isMac(){ return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""); }

function topbarHTML(title, sub, right, crumbs){
  return '<header class="topbar" id="topbar">' +
    '<button class="icon-btn menu-btn" data-act="side" aria-label="Open navigation">' + icon("menu", 18) + '</button>' +
    '<div class="tb-grow">' + (crumbs || "") + '<h1>' + esc(title) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : "") + '</div>' +
    '<div class="tb-actions">' + (right || "") + '</div></header>';
}
function tabbarHTML(){
  const labels = { dashboard:"Home", queue:"Queue", cases:"Case", txn:"Ledger", performance:"Stats" };
  const icons = { dashboard:"dashboard", queue:"queue", cases:"cases", txn:"txn", performance:"performance" };
  return '<nav class="tabbar" aria-label="Sections">' + MOBILE_TABS.map(id =>
    '<button data-act="nav" data-id="' + id + '"' + (S.nav === id ? ' aria-current="page"' : "") + '>' +
    icon(icons[id], 20) + labels[id] + '</button>').join("") + '</nav>';
}

/* active-case context bar shown on case-scoped screens */
function caseStrip(c){
  const w = work(c.id), sla = slaState(w);
  return '<div class="casebar">' +
    '<span class="casebar-ic">' + icon("cases", 18) + '</span>' +
    '<div style="min-width:0"><div class="ref">' + esc(c.alert.ref) + '</div><div class="who">' + esc(c.customer.name) + '</div></div>' +
    '<div class="row tight">' + priorityPill(c.alert.priority) + statusPill(w.status) + levelPill(c.level) + '</div>' +
    '<span class="tb-grow"></span>' + slaBar(sla) +
    '<a class="btn sm" href="' + hrefFor("cases") + '" data-act="nav" data-id="cases">' + icon("cases", 15) + 'Case file</a>' +
    '<button class="btn sm ghost" data-act="switchcase">' + icon("updown", 15) + 'Switch</button></div>';
}
