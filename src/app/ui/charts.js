
/* --------------------------------------------------------------------------
   Charts — small, dependency-free SVG marks.
   Rules applied (validated against the brand palette):
   - one emphasis hue (gold) over a neutral base; status colours reserved;
   - thin bars with 4px rounded data-ends anchored to a baseline, 2px gaps;
   - recessive grid, text in ink tokens never in the mark colour;
   - every mark is hoverable and keyboard-focusable with a tooltip, and
     every chart can be swapped for a table view.
   -------------------------------------------------------------------------- */

/* rounded-top bar path: square at the baseline, 4px radius at the data end */
function barPath(x, y, w, h, r){
  r = Math.min(r, w/2, h);
  if (h <= 0.5) return "";
  return "M" + x + " " + (y + h) + "V" + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y +
    "H" + (x + w - r) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "V" + (y + h) + "Z";
}

/* KPI mini bars (reference: the small bar cluster inside a stat card) */
function miniBars(values, opts){
  opts = opts || {};
  const n = values.length; if (!n) return "";
  const w = opts.w || 64, h = opts.h || 34, gap = 3;
  const bw = Math.max(3, (w - gap * (n - 1)) / n);
  const max = Math.max.apply(null, values.concat([1]));
  const hi = opts.highlight != null ? opts.highlight : n - 1;
  let s = '<svg class="minibars" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">';
  values.forEach((v, i) => {
    const bh = Math.max(3, (v / max) * (h - 2));
    s += '<path d="' + barPath(i * (bw + gap), h - bh, bw, bh, 2) + '" class="' +
      (i === hi ? "mk-hi" : opts.alert && opts.alert.indexOf(i) >= 0 ? "mk-alert" : "mk-base") + '"/>';
  });
  return s + "</svg>";
}

/* single-series sparkline for table rows — 2px line, end marker */
function sparkline(values, w, h){
  w = w || 96; h = h || 28;
  if (!values || values.length < 2) return '<span class="dim2">—</span>';
  const max = Math.max.apply(null, values), min = Math.min.apply(null, values);
  const rng = Math.max(1e-9, max - min);
  const pts = values.map((v, i) => [ (i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / rng) * (h - 8) ]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  const last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">' +
    '<path d="' + d + '" class="spark-line"/>' +
    '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3" class="spark-dot"/></svg>';
}

/* a bucketed daily series from a ledger, for sparklines */
function dailySeries(txns, buckets){
  buckets = buckets || 12;
  if (!txns.length) return [];
  const t0 = new Date(txns[0].d).getTime(), t1 = new Date(txns[txns.length - 1].d).getTime();
  const span = Math.max(1, t1 - t0), out = new Array(buckets).fill(0);
  txns.forEach(t => {
    const i = Math.min(buckets - 1, Math.floor(((new Date(t.d).getTime() - t0) / span) * buckets));
    out[i] += t.amt;
  });
  return out;
}

/* main column chart with axis, reference line, hover/focus tooltips, table view.
   data: [{ label, value, tip, tone:"hi"|"alert"|"", act, id }] */
function columnChart(data, opts){
  opts = opts || {};
  const W = 720, H = opts.height || 240, padL = 40, padR = 12, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = data.length || 1, gap = 2;
  const slot = iw / n, bw = Math.max(4, Math.min(opts.maxBar || 34, slot - gap * 2 - (slot > 30 ? slot * 0.28 : 0)));
  const maxV = Math.max.apply(null, data.map(d => d.value).concat([opts.refValue || 0, 1]));
  const step = niceCeil(maxV / 4), niceMax = step * Math.ceil(maxV / step);
  const y = v => padT + ih - (v / niceMax) * ih;
  const ticks = []; for (let t = 0; t <= niceMax + 1e-9; t += step) ticks.push(t);
  let s = '<svg class="colchart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.aria || "Chart") + '">';
  ticks.forEach(t => {
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '" class="gridline"/>' +
         '<text x="' + (padL - 8) + '" y="' + (y(t) + 3.5).toFixed(1) + '" class="axis" text-anchor="end">' + esc(opts.fmt ? opts.fmt(t) : Math.round(t)) + "</text>";
  });
  data.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2, x = cx - bw / 2;
    const top = y(Math.max(0, d.value)), bh = padT + ih - top;
    const cls = d.tone === "hi" ? "mk-hi" : d.tone === "alert" ? "mk-alert" : "mk-base";
    s += '<g class="colmark' + (d.act ? " clickable" : "") + '" tabindex="0" data-tip="' + esc(d.tip || (d.label + ": " + d.value)) + '"' +
         (d.act ? ' data-act="' + d.act + '" data-id="' + esc(d.id) + '"' : "") + ' role="img" aria-label="' + esc(d.tip || d.label) + '">' +
         '<rect x="' + (cx - slot / 2 + 1).toFixed(1) + '" y="' + padT + '" width="' + (slot - 2).toFixed(1) + '" height="' + ih + '" class="hit"/>' +
         '<path d="' + barPath(x, top, bw, Math.max(bh, 2), 4) + '" class="' + cls + '"/>' +
         (d.badge ? '<text x="' + cx.toFixed(1) + '" y="' + (top - 7).toFixed(1) + '" text-anchor="middle" class="barlabel">' + esc(d.badge) + "</text>" : "") +
         '<text x="' + cx.toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle" class="axis">' + esc(d.label) + "</text></g>";
  });
  if (opts.refValue != null){
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(opts.refValue).toFixed(1) + '" y2="' + y(opts.refValue).toFixed(1) + '" class="refline"/>' +
         '<text x="' + (W - padR) + '" y="' + (y(opts.refValue) - 5).toFixed(1) + '" class="axis ref halo" text-anchor="end">' + esc(opts.refLabel || "") + "</text>";
  }
  s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '" class="baseline"/>';
  return s + "</svg>";
}
function niceCeil(v){
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/* chart card with a chart/table toggle */
function chartCard(title, sub, chartSvg, tableHtml, right){
  const id = "cv" + Math.abs(hashCode(title)) % 99999;
  const v = S.chartView[id] === "table" ? "table" : "chart";
  return '<section class="card chartcard" data-view="' + v + '" id="' + id + '">' +
    '<div class="card-h"><div class="grow"><h3>' + esc(title) + '</h3>' + (sub ? '<div class="card-sub">' + sub + "</div>" : "") + "</div>" +
    (right || "") +
    '<div class="seg" role="group" aria-label="View as"><button aria-pressed="' + (v === "chart") + '" data-act="chartview" data-id="' + id + '" data-v="chart" aria-label="Chart" title="Chart">' + icon("chart", 15) + '</button>' +
    '<button aria-pressed="' + (v === "table") + '" data-act="chartview" data-id="' + id + '" data-v="table" aria-label="Table" title="Table">' + icon("table", 15) + "</button></div></div>" +
    '<div class="card-b"><div class="chart-pane">' + chartSvg + '</div><div class="table-pane tw">' + tableHtml + "</div></div></section>";
}

/* one floating tooltip for every [data-tip] mark, on hover and on focus */
(function(){
  let tip = null;
  function el(){ if (!tip){ tip = document.createElement("div"); tip.className = "tooltip"; tip.setAttribute("role","tooltip"); document.body.appendChild(tip); } return tip; }
  function show(target, x, y){
    const t = el(); t.textContent = target.getAttribute("data-tip"); t.style.opacity = "1";
    const r = t.getBoundingClientRect();
    t.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x - r.width / 2)) + "px";
    t.style.top = Math.max(8, y - r.height - 12) + "px";
  }
  function hide(){ if (tip) tip.style.opacity = "0"; }
  document.addEventListener("mousemove", e => {
    const g = e.target.closest && e.target.closest("[data-tip]");
    if (g) show(g, e.clientX, e.clientY); else hide();
  });
  document.addEventListener("focusin", e => {
    const g = e.target.closest && e.target.closest("[data-tip]");
    if (g){ const r = g.getBoundingClientRect(); show(g, r.left + r.width / 2, r.top); } else hide();
  });
  document.addEventListener("scroll", hide, true);
})();
