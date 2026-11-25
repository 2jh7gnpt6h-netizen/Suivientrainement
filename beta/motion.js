/* =====================================================================
   Couche de mouvement — version test
   N'ajoute que de l'animation : sans ce fichier, la page est identique,
   simplement immobile. Elle observe le DOM produit par la page (onglets,
   panneaux, graphiques) sans rien changer à sa logique.
   Tout est désactivé si le système demande de réduire les animations.
   ===================================================================== */
(function () {
  "use strict";
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var SPRING = "cubic-bezier(.34,1.56,.64,1)";
  var SOFT = "cubic-bezier(.2,.8,.2,1)";
  var GLASS = ".card,.hero,.label,.stats>.stat,.panel>.sessions>.ses,.start,.tabs,.period,.dlg-in,.drop-in";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function anim(el, kf, o) { if (!el || !el.animate) return null; try { return el.animate(kf, Object.assign({ fill: "backwards" }, o)); } catch (e) { return null; } }
  function fade(el, d, dur) { return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: dur || 500, delay: d, easing: "ease-out" }); }
  function isMine(n) { return n.nodeType === 1 && n.classList && (n.classList.contains("rp") || n.classList.contains("ind")); }

  /* ---------- Fond liquide : les taches dérivent, parallaxe au doigt et au défilement ---------- */
  function initBackground() {
    var bg = $(".bg"); if (!bg) return;
    bg.classList.add("liquid");
    var blobs = [1, 2, 3, 4, 5, 6].map(function (i) { var b = document.createElement("i"); b.className = "blob b" + i; bg.appendChild(b); return b; });
    if (reduce) return;
    var paths = [
      [[0, 0, 1], [7, 5, 1.14], [-4, 9, .94], [3, -2, 1.06]],
      [[0, 0, 1], [-8, 6, 1.1], [-3, -4, .96], [5, 3, 1.12]],
      [[0, 0, 1], [-6, -7, 1.12], [4, -3, .95], [-2, 5, 1.05]],
      [[0, 0, 1], [6, -6, 1.08], [9, 3, 1.15], [-3, -2, .97]],
      [[0, 0, 1], [10, 8, 1.25], [-8, 4, .9], [4, -6, 1.1]],
      [[0, 0, 1], [-9, -5, 1.18], [6, -8, .92], [-4, 3, 1.08]]
    ];
    blobs.forEach(function (b, i) {
      var kf = paths[i].concat([paths[i][0]]).map(function (p) { return { transform: "translate3d(" + p[0] + "%," + p[1] + "%,0) scale(" + p[2] + ")" }; });
      try { b.animate(kf, { duration: 26000 + i * 5300, iterations: Infinity, easing: "ease-in-out", delay: -i * 4100 }); } catch (e) { }
    });
    anim(bg, [{ opacity: .3, transform: "scale(1.12)" }, { opacity: 1, transform: "none" }], { duration: 1700, easing: SOFT });
    var tx = 0, ty = 0, cx = 0, cy = 0, sy = window.scrollY, csy = sy, raf = 0;
    function tick() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; csy += (sy - csy) * 0.14;
      var sc = Math.max(-50, Math.min(50, -csy * 0.05));
      bg.style.translate = (-cx * 16).toFixed(2) + "px " + (-cy * 16 + sc).toFixed(2) + "px";
      raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 || Math.abs(sy - csy) > 0.5) ? requestAnimationFrame(tick) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    window.addEventListener("pointermove", function (e) { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; kick(); }, { passive: true });
    window.addEventListener("scroll", function () { sy = window.scrollY; kick(); }, { passive: true });
  }

  /* ---------- Lumière sur le verre : projecteur sous le doigt, reflet qui glisse au défilement ---------- */
  function sheen() {
    var vh = innerHeight;
    $$(GLASS).forEach(function (g) {
      var r = g.getBoundingClientRect();
      if (!r.width || r.bottom < -60 || r.top > vh + 60) return;
      var k = Math.max(-0.6, Math.min(1.4, r.top / vh));
      g.style.setProperty("--lx", (k * 28).toFixed(1) + "%");
      g.style.setProperty("--ly", (k * -22).toFixed(1) + "%");
    });
  }
  function initLight() {
    var bar = $(".bar");
    var stuck = function () { if (bar) bar.classList.toggle("stuck", window.scrollY > 30); };
    window.addEventListener("scroll", stuck, { passive: true }); stuck();
    if (reduce) return;
    var lit = null;
    function set(g, e) { var r = g.getBoundingClientRect(); g.style.setProperty("--px", (e.clientX - r.left).toFixed(1) + "px"); g.style.setProperty("--py", (e.clientY - r.top).toFixed(1) + "px"); }
    function on(e) {
      var g = e.target && e.target.closest ? e.target.closest(GLASS) : null;
      if (g !== lit) { if (lit) lit.style.setProperty("--la", "0"); lit = g; if (g) { set(g, e); g.style.setProperty("--la", "1"); } }
      else if (g) set(g, e);
    }
    function off() { if (lit) lit.style.setProperty("--la", "0"); lit = null; }
    document.addEventListener("pointermove", on, { passive: true });
    document.addEventListener("pointerdown", on, { passive: true });
    document.documentElement.addEventListener("pointerleave", off);
    document.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") off(); }, { passive: true });
    document.addEventListener("pointercancel", off, { passive: true });
    var raf = 0;
    window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; sheen(); }); }, { passive: true });
  }

  /* ---------- Toucher : onde, gelée, inclinaison ---------- */
  var RIPPLE = ".btn,.tab,.seg button,.pnav,.chipb,.mbtn,.ses-h,.cell.has";
  function initTouch() {
    if (reduce) return;
    document.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      var t = e.target.closest && e.target.closest(RIPPLE); if (!t) return;
      var r = t.getBoundingClientRect(), d = Math.hypot(r.width, r.height) * 1.25 / 16;
      var s = document.createElement("span"); s.className = "rp"; s.setAttribute("aria-hidden", "true");
      s.style.left = (e.clientX - r.left) + "px"; s.style.top = (e.clientY - r.top) + "px";
      if (getComputedStyle(t).position === "static") t.style.position = "relative";
      t.appendChild(s);
      var a = anim(s, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(" + d.toFixed(2) + ")", opacity: 0 }], { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)", fill: "none" });
      if (a) a.onfinish = function () { s.remove(); }; else s.remove();
    }, { passive: true });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".stats>.stat,.cell.has,.nx,.hero-facts>div");
      if (!t) return;
      anim(t, [{ transform: "scale(1)" }, { transform: "scale(1.045,.955)" }, { transform: "scale(.975,1.03)" }, { transform: "scale(1.012,.99)" }, { transform: "scale(1)" }], { duration: 560, easing: "ease-out", fill: "none" });
    });
    // inclinaison des tuiles de chiffres à la souris (écrans avec souris seulement)
    if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var tilt = null;
      var reset = function () { if (tilt) { tilt.style.transition = "transform .6s " + SPRING; tilt.style.transform = ""; } tilt = null; };
      document.addEventListener("pointermove", function (e) {
        var t = e.target.closest && e.target.closest(".stats>.stat,.hero-facts>div");
        if (t !== tilt) reset();
        if (!t) return;
        tilt = t;
        var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        t.style.transition = "transform .18s ease-out";
        t.style.transform = "perspective(700px) rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg)";
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", reset);
    }
  }

  /* ---------- Indicateur liquide sous l'onglet et la période choisis ---------- */
  var LAST = new Map();
  function keyOf(box) { return box.id || (box.classList.contains("tabs") ? "tabs" : box.className); }
  function selOf(box) { return box.querySelector(':scope > [aria-selected="true"], :scope > [aria-checked="true"]'); }
  function placeInd(box, animate) {
    var btn = selOf(box);
    if (!btn || !btn.offsetWidth) return;
    var ind = box.querySelector(":scope > .ind");
    if (!ind) { ind = document.createElement("span"); ind.className = "ind"; ind.setAttribute("aria-hidden", "true"); box.insertBefore(ind, box.firstChild); }
    box.classList.add("has-ind");
    var kids = $$(":scope > button", box);
    var to = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight, i: kids.indexOf(btn) };
    var k = keyOf(box), from = LAST.get(k);
    ind.style.width = to.w + "px"; ind.style.height = to.h + "px"; ind.style.transform = "translate(" + to.x + "px," + to.y + "px)";
    if (!reduce && animate && from && from.i !== to.i) {
      var minX = Math.min(from.x, to.x), span = Math.max(from.x + from.w, to.x + to.w) - minX;
      var mid = { transform: "translate(" + (minX + (to.x > from.x ? span * 0.1 : 0)).toFixed(1) + "px," + to.y + "px) scaleY(.8)", width: (span * 0.9).toFixed(1) + "px", height: to.h + "px", offset: 0.42 };
      anim(ind, [{ transform: "translate(" + from.x + "px," + from.y + "px)", width: from.w + "px", height: from.h + "px" }, mid,
        { transform: "translate(" + to.x + "px," + to.y + "px)", width: to.w + "px", height: to.h + "px" }], { duration: 640, easing: "cubic-bezier(.3,1.3,.45,1)", fill: "none" });
      anim(btn, [{ transform: "scale(.9)" }, { transform: "scale(1.07)", offset: 0.5 }, { transform: "none" }], { duration: 560, easing: SOFT, fill: "none" });
    }
    LAST.set(k, to);
  }
  function syncInd(animate) { $$(".tabs,.seg").forEach(function (b) { placeInd(b, animate); }); }

  /* ---------- Briques d'animation ---------- */
  function prepSvg(el, origin) { el.style.transformBox = "fill-box"; el.style.transformOrigin = origin; }
  function drawLine(p, d, dur) {
    var L = 0; try { L = p.getTotalLength(); } catch (e) { return; }
    if (!L || !isFinite(L)) return;
    p.style.strokeDasharray = L + " " + L;
    var a = anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: dur, delay: d, easing: "cubic-bezier(.5,.05,.2,1)", fill: "both" });
    if (a) a.onfinish = function () { p.style.strokeDasharray = ""; a.cancel(); };
    else p.style.strokeDasharray = "";
  }
  function pop(el, d) { prepSvg(el, "center"); anim(el, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1.35)", opacity: 1, offset: 0.55 }, { transform: "none" }], { duration: 620, delay: d, easing: SOFT }); }
  function svgEnter(svg, d, quick) {
    var k = quick ? 0.6 : 1, base = svg.querySelector("line.base"), baseY = base ? parseFloat(base.getAttribute("y1")) : null, nb = 0;
    if (svg.querySelectorAll(".m").length > 160) {
      anim(svg, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 1400 * k, delay: d, easing: SOFT });
      $$("path", svg).forEach(function (p) { if (p.getAttribute("fill") === "none") drawLine(p, d + 120 * k, 1300 * k); });
      return;
    }
    $$("path", svg).forEach(function (p) {
      if (p.getAttribute("fill") === "none") { drawLine(p, d + 120 * k, 1300 * k); return; }
      if (!p.classList.contains("m")) return;
      var bb = null; try { bb = p.getBBox(); } catch (e) { }
      var neg = baseY !== null && bb && bb.y >= baseY - 0.5;
      prepSvg(p, neg ? "center top" : "center bottom");
      anim(p, [{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 820 * k, delay: d + Math.min(nb++, 70) * 12 * k, easing: SPRING });
    });
    $$("circle.m", svg).forEach(function (c, i) { pop(c, d + 320 * k + Math.min(i, 90) * 11 * k); });
    $$(".zone,.ref,.ref-t", svg).forEach(function (z) { fade(z, d + 500 * k, 600); });
  }
  // compteurs : le chiffre défile depuis la valeur affichée précédemment
  var MEM = new Map();
  function textNode(node) {
    if (!node) return null;
    for (var i = 0; i < node.childNodes.length; i++) { var c = node.childNodes[i]; if (c.nodeType === 3 && /\d/.test(c.textContent)) return c; }
    return null;
  }
  function count(node, d, dur, key) {
    var tn = textNode(node); if (!tn) return;
    // nombre au format français : groupes de milliers séparés par une espace, décimales après la virgule
    var txt = tn.textContent, m = txt.match(/([\u2212+\-]?)(\d{1,3}(?:[\u00a0\u202f ]\d{3})*(?:,\d+)?(?!\d)|\d+(?:,\d+)?)/);
    if (!m) return;
    var dec = (m[2].split(",")[1] || "").length, target = parseFloat(m[2].replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
    if (!isFinite(target)) return;
    var start = key && MEM.has(key) ? MEM.get(key) : 0;
    if (key) MEM.set(key, target);
    if (Math.abs(start - target) < Math.pow(10, -dec) / 2) return;
    var pre = txt.slice(0, m.index) + m[1], post = txt.slice(m.index + m[0].length);
    var f = function (v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ /g, " "); };
    var t0 = performance.now() + d, ease = function (t) { return 1 - Math.pow(1 - t, 4); };
    tn.textContent = pre + f(start) + post;
    var step = function (now) {
      if (!tn.parentNode) return;
      var t = Math.max(0, Math.min(1, (now - t0) / dur));
      tn.textContent = t >= 1 ? txt : pre + f(start + (target - start) * ease(t)) + post;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  var COUNT = ".hero-v,.stat-v,.hero-facts b,.lr.big .lv,.ses-kpis b";
  var GROW = ".adh-t span,.htrack .seg-p,.htrack .seg-s,.mbtn .mt span,.wd-t span,.bal-t span,.label-bar,.cell-p span";
  var LIST = ".lr,.facts li,.nx,.prl-r,.adh-r,.hrow,.wd-r,.bal-r,.mbtn,.srcs li,.tbl tbody tr,.yr,.mrow,.ex,.form label,.kv>div";
  function inner(b, d, key, soft) {
    $$(".chart", b).forEach(function (ch) { var s = ch.querySelector("svg"); if (s) svgEnter(s, d, soft); ch._mw = ch._w; });
    $$(COUNT, b).forEach(function (el, i) { count(el, d + 120 + i * 90, soft ? 850 : 1250, key + "|" + i); });
    $$(GROW, b).forEach(function (el, i) {
      el.style.transformOrigin = "left center";
      anim(el, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: soft ? 700 : 1000, delay: d + (soft ? 80 : 260) + Math.min(i, 30) * (soft ? 18 : 35), easing: SPRING });
    });
    if (!soft) $$(LIST, b).forEach(function (el, i) {
      if (i > 22) return;
      anim(el, [{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: 620, delay: d + 160 + i * 38, easing: SOFT });
    });
    var cal = b.querySelector(".cal");
    if (cal) {
      var kids = Array.prototype.slice.call(cal.children);
      kids.forEach(function (c, idx) {
        if (!c.classList.contains("cell")) return;
        var row = Math.floor(idx / 8), col = idx % 8;
        anim(c, [{ opacity: 0, transform: "scale(.35) rotate(-8deg)" }, { opacity: 1, transform: "scale(1.08)", offset: 0.6 }, { transform: "none" }], { duration: soft ? 480 : 650, delay: d + (soft ? 40 : 120) + (row + col) * (soft ? 14 : 30), easing: SOFT });
      });
    }
    // reflet qui balaie le grand chiffre du poids
    if (!soft && (b.classList.contains("hero") || b.querySelector(".hero"))) {
      var h = b.classList.contains("hero") ? b : b.querySelector(".hero");
      h.style.setProperty("--lx", "-40%"); h.style.setProperty("--ly", "-30%");
      setTimeout(function () { h.style.setProperty("--lx", "130%"); h.style.setProperty("--ly", "20%"); }, d + 400);
      setTimeout(sheen, d + 1900);
    }
  }
  function reveal(b, d, dir, soft) {
    var p = b.closest(".panel"), key = (p ? p.id : "") + "|" + (b._bi === undefined ? b.className : b._bi);
    if (soft) anim(b, [{ opacity: 0.35, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: d, easing: SOFT });
    else {
      var dx = dir ? dir * 28 : 0;
      anim(b, [{ opacity: 0, transform: "translate(" + dx + "px,26px) scale(.965)" }, { opacity: 1, transform: "none" }], { duration: 920, delay: d, easing: SPRING });
    }
    inner(b, d, key, soft);
  }

  /* ---------- Entrée des panneaux et des blocs au défilement ---------- */
  var io = null, waiting = new Map();
  function blocksOf(panel) {
    var out = [];
    (function walk(el, depth) {
      Array.prototype.forEach.call(el.children, function (c) {
        if (c.hidden || isMine(c)) return;
        var cl = c.classList;
        if (depth < 2 && (cl.contains("hero-grid") || cl.contains("grid-ov") || cl.contains("grid2") || cl.contains("grid-body") || cl.contains("stats") || cl.contains("sessions") || c.id === "p-semaines")) walk(c, depth + 1);
        else out.push(c);
      });
    })(panel, 0);
    return out;
  }
  function panelEnter(panel, dir, soft) {
    $$(".seg", panel).forEach(function (s) { placeInd(s, true); });
    if (reduce || panel.hidden) return;
    var old = waiting.get(panel); if (old && io) old.forEach(function (b) { io.unobserve(b); });
    var later = [], vh = innerHeight, n = 0;
    blocksOf(panel).forEach(function (b, bi) {
      b._bi = bi;
      var r = b.getBoundingClientRect();
      if (r.top < vh * 1.02 && r.bottom > -40) { reveal(b, Math.min(n, 8) * (soft ? 40 : 80), dir, soft); n++; }
      else if (io) { io.observe(b); later.push(b); }
    });
    waiting.set(panel, later);
  }
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    io = new IntersectionObserver(function (entries) {
      var vis = entries.filter(function (e) { return e.isIntersecting; }).sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      vis.forEach(function (e, i) { io.unobserve(e.target); reveal(e.target, i * 80, 0, false); });
    }, { rootMargin: "0px 0px 12% 0px", threshold: 0 });
  }

  /* ---------- Observation de la page ---------- */
  var TABS = ["bilan", "nutrition", "seances", "corps", "historique", "reglages"];
  var lastTab = document.body.getAttribute("data-tab"), dirNext = 0, first = true, lastPanel = null, tabChanged = false;
  var Q = { panels: new Set(), charts: new Set(), subs: new Set(), boxes: new Set(), opened: new Set() }, qRaf = 0;
  function schedule() { if (!qRaf) qRaf = requestAnimationFrame(flush); }
  function flush() {
    qRaf = 0;
    var entering = [];
    Q.panels.forEach(function (p) { if (!p.hidden) entering.push(p); });
    entering.forEach(function (p) { panelEnter(p, dirNext, !first && !tabChanged && p === lastPanel); lastPanel = p; });
    if (entering.length) { dirNext = 0; tabChanged = false; }
    var inEntering = function (el) { return entering.some(function (p) { return p.contains(el); }); };
    Q.charts.forEach(function (ch) {
      if (inEntering(ch) || !ch.isConnected) return;
      var s = ch.querySelector("svg");
      // même largeur qu'avant : nouvelles données (choix d'un exercice…) ; sinon simple redimensionnement
      if (s && ch._mw === ch._w && !reduce && ch.offsetParent) svgEnter(s, 0, true);
      ch._mw = ch._w;
    });
    Q.subs.forEach(function (el) {
      if (reduce || inEntering(el) || !el.isConnected || !el.offsetParent) return;
      $$(":scope > *", el).slice(0, 14).forEach(function (c, i) {
        if (isMine(c)) return;
        anim(c, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: i * 30, easing: SOFT });
      });
      $$(GROW, el).forEach(function (g, i) { g.style.transformOrigin = "left center"; anim(g, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 800, delay: 80 + Math.min(i, 20) * 25, easing: SPRING }); });
    });
    Q.opened.forEach(function (b) {
      if (reduce || b.hidden) return;
      var h1 = b.offsetHeight;
      anim(b, [{ height: "0px", opacity: 0.2 }, { height: h1 + "px", opacity: 1 }], { duration: 520, easing: SPRING, fill: "none" });
      b.style.overflow = "hidden"; setTimeout(function () { b.style.overflow = ""; }, 560);
      $$(".ex", b).slice(0, 16).forEach(function (r, i) { anim(r, [{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 80 + i * 45, easing: SOFT }); });
    });
    Q.boxes.forEach(function (b) { if (b.isConnected) placeInd(b, true); });
    Q.panels.clear(); Q.charts.clear(); Q.subs.clear(); Q.boxes.clear(); Q.opened.clear();
    if (first) { first = false; requestAnimationFrame(sheen); }
  }
  function initObserve() {
    var mo = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        var t = r.target;
        if (r.type === "attributes") {
          if (r.attributeName === "data-tab" && t === document.body) {
            var nt = t.getAttribute("data-tab"), a = TABS.indexOf(lastTab), b = TABS.indexOf(nt);
            dirNext = a >= 0 && b >= 0 && a !== b ? (b > a ? 1 : -1) : 0; if (nt !== lastTab) tabChanged = true; lastTab = nt;
            return;
          }
          if (r.attributeName === "aria-expanded" && t.classList.contains("ses-h") && t.getAttribute("aria-expanded") === "true") {
            var body = document.getElementById(t.getAttribute("aria-controls")); if (body) Q.opened.add(body); schedule(); return;
          }
          var box = t.parentElement;
          if (box && (box.classList.contains("tabs") || box.classList.contains("seg"))) { Q.boxes.add(box); schedule(); }
          return;
        }
        var added = Array.prototype.slice.call(r.addedNodes), removed = Array.prototype.slice.call(r.removedNodes);
        if (added.concat(removed).every(isMine)) return;
        if (t.classList && t.classList.contains("panel")) Q.panels.add(t);
        else if (t.closest && t.closest(".chart")) Q.charts.add(t.closest(".chart"));
        else if (t.closest && t.closest(".panel")) Q.subs.add(t);
        else return;
        schedule();
      });
    });
    var main = $("main");
    if (main) mo.observe(main, { childList: true, subtree: true });
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["aria-selected", "aria-checked", "aria-expanded", "data-tab"] });
    // le contenu déjà affiché au chargement (données de l'appareil) entre aussi en scène
    $$(".panel").forEach(function (p) { if (p.children.length) Q.panels.add(p); });
    schedule();
  }

  /* ---------- Barre d'onglets : plus discrète quand on descend (téléphone) ---------- */
  function initTabsMin() {
    if (reduce) return;
    var lastY = window.scrollY, acc = 0, min = false;
    var set = function (v) { if (v !== min) { min = v; document.body.classList.toggle("tabs-min", v); } };
    window.addEventListener("scroll", function () {
      var y = window.scrollY, dy = y - lastY; lastY = y;
      if (innerWidth > 860 || y < 90) { acc = 0; set(false); return; }
      acc = (dy > 0) === (acc > 0) ? acc + dy : dy;
      if (acc > 28) set(true); else if (acc < -14) set(false);
    }, { passive: true });
  }

  /* ---------- Superpositions : message, dialogue, bandeau Dropbox, dépôt de fichiers ---------- */
  function initOverlays() {
    if (reduce) return;
    var watch = function (el, fn) { if (!el) return; new MutationObserver(function () { fn(el); }).observe(el, { attributes: true, attributeFilter: ["hidden", "class"], childList: true, characterData: true, subtree: true }); };
    var toastShown = false;
    watch($("#toast"), function (t) {
      if (t.hidden) { toastShown = false; return; }
      if (!toastShown) anim(t, [{ opacity: 0, transform: "translate(-50%,18px) scale(.9)" }, { opacity: 1, transform: "translate(-50%,0) scale(1)" }], { duration: 640, easing: SPRING, fill: "none" });
      else anim(t, [{ transform: "translate(-50%,0) scale(1.04)" }, { transform: "translate(-50%,0) scale(1)" }], { duration: 420, easing: SOFT, fill: "none" });
      toastShown = true;
    });
    var dlgShown = false;
    watch($("#dlg"), function (d) {
      if (d.hidden) { dlgShown = false; return; }
      if (dlgShown) return; dlgShown = true;
      fade(d, 0, 260);
      anim(d.querySelector(".dlg-in"), [{ opacity: 0, transform: "translateY(18px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 640, easing: SPRING });
    });
    var dropShown = false;
    watch($("#drop"), function (d) {
      if (d.hidden) { dropShown = false; return; }
      if (dropShown) return; dropShown = true;
      fade(d, 0, 240);
      anim(d.querySelector(".drop-in"), [{ transform: "scale(.88)" }, { transform: "none" }], { duration: 600, easing: SPRING });
    });
    var dbx = $("#dbx"), dbxSig = "";
    if (dbx) new MutationObserver(function () {
      if (dbx.hidden) { dbxSig = ""; return; }
      var sig = dbx.className + "|" + (dbx.querySelector(".dbx-msg b") || dbx).textContent.slice(0, 40);
      if (sig === dbxSig) return;
      var appear = !dbxSig; dbxSig = sig;
      if (appear) anim(dbx, [{ opacity: 0, transform: "translateY(-8px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 620, easing: SPRING });
      else anim(dbx, [{ transform: "scale(.98)" }, { transform: "none" }], { duration: 520, easing: SPRING, fill: "none" });
      $$(":scope > *", dbx).forEach(function (c, i) { anim(c, [{ opacity: 0, transform: "translateY(6px)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 460, delay: i * 60, easing: SOFT }); });
    }).observe(dbx, { attributes: true, attributeFilter: ["hidden", "class"], childList: true });
  }

  /* ---------- Première apparition de l'en-tête ---------- */
  function headerIn() {
    if (reduce) return;
    anim($(".brand-name"), [{ opacity: 0, transform: "translateY(14px)", filter: "blur(10px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 1000, delay: 80, easing: SOFT });
    anim($(".brand-sub"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: 220, easing: SOFT });
    $$(".top-act > .btn").forEach(function (b, i) { anim(b, [{ opacity: 0, transform: "translateY(10px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: 280 + i * 80, easing: SPRING }); });
    anim($(".tabs"), [{ opacity: 0, transform: "translateY(18px) scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: 320, easing: SPRING });
    anim($(".period"), [{ opacity: 0, transform: "translateY(12px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 950, delay: 380, easing: SPRING });
  }

  /* ---------- Démarrage ---------- */
  initBackground(); initLight(); initTouch(); initReveal(); initObserve(); initTabsMin(); initOverlays(); headerIn();
  document.documentElement.classList.toggle("mo-wait", false);
  syncInd(false);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { syncInd(false); });
    $$(".tabs,.seg").forEach(function (b) { ro.observe(b); });
  }
  window.addEventListener("resize", function () { syncInd(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { syncInd(false); sheen(); });
  window.Motion = { reduce: reduce, sync: syncInd };
})();
