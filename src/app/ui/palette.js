/* --------------------------------------------------------------------------
   29. Command palette (⌘K / Ctrl K / "/")
   One search box for every screen, every alert in the queue, the case
   library and the common commands.
   -------------------------------------------------------------------------- */
const PAL = { q:"", sel:0, items:[], back:null };

function paletteOpen(){ return !!$("#cmdk"); }
function paletteItems(q){
  q = q.trim().toLowerCase();
  const hit = (...xs) => !q || xs.some(x => x && String(x).toLowerCase().indexOf(q) >= 0);
  const out = [];
  const add = (g, it) => out.push(Object.assign({ g }, it));

  const actions = [
    { label:"Take next alert", sub:"Opens the alert closest to breaching its SLA", icon:"zap", run:() => nextCase() },
    { label:"Generate a practice case", sub:"A fresh case at a random level for this workspace", icon:"sparkles",
      run:() => { const id = generateCase({}); openCase(id); toast("Practice case generated"); } },
    { label:"Switch alert", sub:"Choose from the alerts you hold", icon:"repeat", run:() => switchCaseModal() },
    { label: (document.documentElement.getAttribute("data-theme") === "dark" || (!PROG.theme && matchMedia("(prefers-color-scheme: dark)").matches))
        ? "Use light appearance" : "Use dark appearance", sub:"Appearance", icon:"moon",
      run:() => { const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!PROG.theme && matchMedia("(prefers-color-scheme: dark)").matches);
        PROG.theme = dark ? "light" : "dark"; saveProg(); render(); } },
    { label:"Settings", sub:"Name, role, workspace, text size", icon:"settings", run:() => settingsModal() }
  ];
  actions.filter(a => hit(a.label, a.sub)).forEach(a => add("Actions", a));

  NAV.forEach(grp => grp.items.forEach(n => {
    if (n.needsCase && !S.active) return;
    if (hit(n.label, grp.g)) add("Go to", { label:n.label, sub:grp.g, icon:n.icon, meta: n.id === S.nav ? "Current" : "",
      run:() => navTo(n.id) });
  }));

  queueRows().filter(r => hit(r.c.alert.ref, r.c.customer.name, rule(r.c.alert.ruleId).name, r.c.id))
    .sort((a,b) => a.sla.left - b.sla.left).slice(0, q ? 8 : 5)
    .forEach(r => add("Your alerts", { label:r.c.customer.name, sub:r.c.alert.ref + " · " + rule(r.c.alert.ruleId).name,
      icon: r.sla.overdue ? "alert" : "flag", meta:r.sla.label, run:() => openCase(r.c.id) }));

  if (q.length >= 2){
    const inQueue = new Set(PROG.queue || []);
    CASE_INDEX.filter(x => !inQueue.has(x.id) && hit(x.title, x.id, x.rule)).slice(0, 8)
      .forEach(x => add("Case library", { label:x.title, sub:"Level " + x.level + " · " + (x.kind === "real" ? "Documented case" : x.kind === "generated" ? "Practice case" : "Fictional"),
        icon:"book", meta: PROG.completed[x.id] ? "Completed" : "", run:() => openCase(x.id) }));
  }
  return out;
}

function openPalette(){
  if (paletteOpen() || S.screen !== "app") return;
  PAL.q = ""; PAL.sel = 0; PAL.back = document.activeElement;
  const bg = document.createElement("div");
  bg.className = "cmdk-bg"; bg.id = "cmdk";
  bg.innerHTML = '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Search and commands">' +
    '<div class="cmdk-in">' + icon("search", 18) +
    '<input id="cmdkInput" type="text" autocomplete="off" spellcheck="false" placeholder="Search alerts, cases, screens and commands" ' +
    'role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list">' +
    '<kbd>esc</kbd></div>' +
    '<div class="cmdk-list" id="cmdkList" role="listbox"></div>' +
    '<div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div></div>';
  document.body.appendChild(bg);
  const input = $("#cmdkInput");
  input.addEventListener("input", () => { PAL.q = input.value; PAL.sel = 0; drawPalette(); });
  input.addEventListener("keydown", paletteKey);
  bg.addEventListener("mousedown", e => { if (e.target === bg) closePalette(); });
  bg.addEventListener("click", e => {
    const b = e.target.closest("[data-pi]"); if (!b) return;
    e.stopPropagation(); runPalette(Number(b.getAttribute("data-pi")));
  });
  bg.addEventListener("mousemove", e => {
    const b = e.target.closest("[data-pi]"); if (!b) return;
    const i = Number(b.getAttribute("data-pi")); if (i !== PAL.sel){ PAL.sel = i; markPalette(); }
  });
  drawPalette();
  input.focus();
}
function closePalette(){
  const bg = $("#cmdk"); if (!bg) return;
  bg.remove();
  if (PAL.back && document.contains(PAL.back)) try { PAL.back.focus({ preventScroll:true }); } catch(e){}
}
function drawPalette(){
  const list = $("#cmdkList"); if (!list) return;
  PAL.items = paletteItems(PAL.q);
  if (!PAL.items.length){
    list.innerHTML = '<div class="cmdk-empty">No matches for “' + esc(PAL.q) + '”.<br><span class="tiny">Try an alert reference, a customer name or a typology.</span></div>';
    return;
  }
  let g = "", html = "";
  PAL.items.forEach((it, i) => {
    if (it.g !== g){ g = it.g; html += '<div class="cmdk-g" role="presentation">' + esc(g) + '</div>'; }
    html += '<button class="cmdk-item" role="option" id="pi' + i + '" data-pi="' + i + '" aria-selected="' + (i === PAL.sel) + '" tabindex="-1">' +
      icon(it.icon || "right", 17) +
      '<span style="min-width:0"><span class="cell-main" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.label) + '</span>' +
      (it.sub ? '<span class="cell-sub" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.sub) + '</span>' : "") + '</span>' +
      (it.meta ? '<span class="meta">' + esc(it.meta) + '</span>' : "") + '</button>';
  });
  list.innerHTML = html;
  markPalette();
}
function markPalette(){
  const list = $("#cmdkList"); if (!list) return;
  list.querySelectorAll("[data-pi]").forEach(b => b.setAttribute("aria-selected", String(Number(b.getAttribute("data-pi")) === PAL.sel)));
  const cur = $("#pi" + PAL.sel);
  const input = $("#cmdkInput");
  if (input) input.setAttribute("aria-activedescendant", cur ? cur.id : "");
  if (cur) cur.scrollIntoView({ block:"nearest" });
}
function paletteKey(e){
  const n = PAL.items.length;
  if (e.key === "ArrowDown"){ e.preventDefault(); if (n){ PAL.sel = (PAL.sel + 1) % n; markPalette(); } }
  else if (e.key === "ArrowUp"){ e.preventDefault(); if (n){ PAL.sel = (PAL.sel - 1 + n) % n; markPalette(); } }
  else if (e.key === "Enter"){ e.preventDefault(); runPalette(PAL.sel); }
  else if (e.key === "Escape"){ e.preventDefault(); closePalette(); }
  else if (e.key === "Tab"){ e.preventDefault(); }
}
function runPalette(i){
  const it = PAL.items[i]; if (!it) return;
  PAL.back = null;
  closePalette();
  it.run();
}
