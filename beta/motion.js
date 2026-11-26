/* =====================================================================
   Couche de mouvement — version test
   N'ajoute que de l'animation : sans ce fichier, la page est identique,
   simplement immobile. Elle observe le DOM produit par la page (onglets,
   panneaux, graphiques) sans rien changer à sa logique.

   Fluidité :
   - pendant le défilement : une parallaxe du fond (un seul élément) et deux classes ;
   - une seule animation par bloc, et par calque de graphique (barres,
     courbes, points), jamais une par barre ;
   - uniquement des transformations et de l'opacité, que le téléphone
     confie à la carte graphique ;
   - fond qui dérive lentement : deux taches sur téléphone, trois sur ordinateur ;
   - reflets et lueurs : un petit calque par carte, animé une fois (transformations).
   Tout est désactivé si le système demande de réduire les animations.
   ===================================================================== */
(function () {
  "use strict";
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq("(prefers-reduced-motion: reduce)");
  var fine = mq("(hover: hover) and (pointer: fine)");
  var SPRING = "cubic-bezier(.34,1.56,.64,1)";
  var SOFT = "cubic-bezier(.2,.8,.2,1)";
  var SPOT = ".card,.hero,.label,.stats>.stat,.panel>.sessions>.ses,.start";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function anim(el, kf, o) { if (!el || !el.animate) return null; try { return el.animate(kf, Object.assign({ fill: "backwards" }, o)); } catch (e) { return null; } }
  function fade(el, d, dur) { return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: dur || 500, delay: d, easing: "ease-out" }); }
  var MINE = ["rp", "ind", "glint", "fx", "fx-glint", "fx-glow"];
  function isMine(n) { return n.nodeType === 1 && !!n.classList && MINE.some(function (c) { return n.classList.contains(c); }); }

  /* ---------- Fond : les taches dérivent lentement (2 sur téléphone, 3 sur ordinateur), parallaxe légère ---------- */
  function initBackground() {
    var bg = $(".bg"); if (!bg || reduce) return;
    anim(bg, [{ opacity: 0.35, transform: "scale(1.08)" }, { opacity: 1, transform: "none" }], { duration: 1500, easing: SOFT });
    var big = fine && innerWidth >= 861;
    bg.classList.add("liquid"); if (!big) bg.classList.add("lite");
    var paths = [
      [[0, 0, 1], [-9, 7, 1.1], [-3, -5, .95], [6, 3, 1.12]],
      [[0, 0, 1], [-7, -8, 1.12], [5, -3, .94], [-2, 6, 1.06]],
      [[0, 0, 1], [7, -6, 1.08], [10, 4, 1.15], [-3, -2, .97]]
    ];
    (big ? [2, 3, 4] : [2, 3]).forEach(function (n, i) {
      var b = document.createElement("i"); b.className = "blob b" + n; bg.appendChild(b);
      var kf = paths[i].concat([paths[i][0]]).map(function (p) { return { transform: "translate3d(" + p[0] + "%," + p[1] + "%,0) scale(" + p[2] + ")" }; });
      try { b.animate(kf, { duration: 34000 + i * 8000, iterations: Infinity, easing: "ease-in-out", delay: -i * 6000 }); } catch (e) { }
    });
    var tx = 0, ty = 0, cx = 0, cy = 0, sy = window.scrollY, csy = sy, raf = 0;
    function tick() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06; csy += (sy - csy) * 0.18;
      var sc = Math.max(-40, Math.min(40, -csy * 0.04));
      bg.style.translate = (-cx * 14).toFixed(1) + "px " + (-cy * 14 + sc).toFixed(1) + "px";
      raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 || Math.abs(sy - csy) > 0.5) ? requestAnimationFrame(tick) : 0;
    }
    var kick = function () { if (!raf) raf = requestAnimationFrame(tick); };
    if (fine) window.addEventListener("pointermove", function (e) { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; kick(); }, { passive: true });
    window.addEventListener("scroll", function () { sy = window.scrollY; kick(); }, { passive: true });
  }

  /* ---------- Reflets et lueurs : un calque .fx par carte, animé une seule fois ---------- */
  var FXSEL = ".card,.hero,.label,.stats>.stat,.panel>.sessions>.ses,.start";
  function fxLayer(el) {
    var f = el.querySelector(":scope > .fx");
    if (!f) { f = document.createElement("span"); f.className = "fx"; f.setAttribute("aria-hidden", "true"); el.appendChild(f); }
    return f;
  }
  function glint(el, d) {
    if (reduce || !el.matches || !el.matches(FXSEL)) return;
    var g = document.createElement("i"); g.className = "fx-glint"; fxLayer(el).appendChild(g);
    var a = anim(g, [{ transform: "translateX(-130%) skewX(-14deg)" }, { transform: "translateX(330%) skewX(-14deg)" }], { duration: 1250, delay: d, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
    if (a) a.onfinish = function () { g.remove(); }; else g.remove();
  }
  function initGlow() {
    if (reduce) return;
    // lueur sous le doigt sur les cartes (les boutons ont déjà leur onde)
    document.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || !e.target.closest) return;
      if (e.target.closest(".btn,.tab,.seg button,.pnav,.chipb,.mbtn,.ses-h,.dcell,input,select,textarea,a")) return;
      var c = e.target.closest(FXSEL); if (!c) return;
      var r = c.getBoundingClientRect(), g = document.createElement("i"); g.className = "fx-glow";
      g.style.left = (e.clientX - r.left) + "px"; g.style.top = (e.clientY - r.top) + "px";
      fxLayer(c).appendChild(g);
      var a = anim(g, [{ transform: "scale(.25)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 750, easing: "cubic-bezier(.2,.7,.3,1)", fill: "none" });
      if (a) a.onfinish = function () { g.remove(); }; else g.remove();
    }, { passive: true });
  }

  /* ---------- Lumière : projecteur sous la souris (ordinateur) ; barre collante ---------- */
  function initLight() {
    var bar = $(".bar"), stuck = false;
    var onScroll = function () { var s = window.scrollY > 30; if (s !== stuck && bar) { stuck = s; bar.classList.toggle("stuck", s); } };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    if (reduce || !fine) return;
    var lit = null, raf = 0, last = null;
    function apply() {
      raf = 0; var e = last; if (!e) return;
      var g = e.target && e.target.closest ? e.target.closest(SPOT) : null;
      if (g !== lit) { if (lit) lit.style.setProperty("--la", "0"); lit = g; if (g) g.style.setProperty("--la", "1"); }
      if (g) { var r = g.getBoundingClientRect(); g.style.setProperty("--px", (e.clientX - r.left).toFixed(0) + "px"); g.style.setProperty("--py", (e.clientY - r.top).toFixed(0) + "px"); }
    }
    document.addEventListener("pointermove", function (e) { last = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { if (lit) lit.style.setProperty("--la", "0"); lit = null; });
  }

  /* ---------- Toucher : onde, gelée ; inclinaison des tuiles à la souris ---------- */
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
      var a = anim(s, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(" + d.toFixed(2) + ")", opacity: 0 }], { duration: 600, easing: "cubic-bezier(.2,.7,.3,1)", fill: "none" });
      if (a) a.onfinish = function () { s.remove(); }; else s.remove();
    }, { passive: true });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".stats>.stat,.cell.has,.nx,.hero-facts>div");
      if (!t) return;
      anim(t, [{ transform: "scale(1)" }, { transform: "scale(1.04,.96)" }, { transform: "scale(.98,1.025)" }, { transform: "scale(1)" }], { duration: 480, easing: "ease-out", fill: "none" });
    });
    if (!fine) return;
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
    if (!from || from.x !== to.x || from.y !== to.y || from.w !== to.w || from.h !== to.h || !ind.style.width) {
      ind.style.width = to.w + "px"; ind.style.height = to.h + "px"; ind.style.transform = "translate(" + to.x + "px," + to.y + "px)";
    }
    if (!reduce && animate && from && from.i !== to.i) {
      // la goutte s'étire vers sa destination puis se resserre (transformations seulement)
      // à mi-course, la goutte couvre 90 % du trajet, collée au côté d'arrivée
      var sx = Math.max(from.x + from.w, to.x + to.w) - Math.min(from.x, to.x), midX = Math.min(from.x, to.x) + (to.x > from.x ? sx * 0.1 : 0);
      var st = (sx * 0.9 / to.w).toFixed(3);
      anim(ind, [
        { transform: "translate(" + from.x + "px," + from.y + "px) scale(" + (from.w / to.w).toFixed(3) + ",1)", transformOrigin: "0 50%" },
        { transform: "translate(" + midX.toFixed(1) + "px," + to.y + "px) scale(" + st + ",.82)", transformOrigin: "0 50%", offset: 0.42 },
        { transform: "translate(" + to.x + "px," + to.y + "px)", transformOrigin: "0 50%" }
      ], { duration: 620, easing: "cubic-bezier(.3,1.3,.45,1)", fill: "none" });
      anim(btn, [{ transform: "scale(.9)" }, { transform: "scale(1.07)", offset: 0.5 }, { transform: "none" }], { duration: 520, easing: SOFT, fill: "none" });
    }
    LAST.set(k, to);
  }
  function syncInd(animate) { $$(".tabs,.seg").forEach(function (b) { placeInd(b, animate); }); }

  /* ---------- Graphiques : chaque calque entre en une seule animation ---------- */
  function drawLine(p, d, dur) {
    var L = 0; try { L = p.getTotalLength(); } catch (e) { return; }
    if (!L || !isFinite(L)) return;
    p.style.strokeDasharray = L + " " + L;
    var a = anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: dur, delay: d, easing: "cubic-bezier(.5,.05,.2,1)", fill: "both" });
    if (a) a.onfinish = function () { p.style.strokeDasharray = ""; a.cancel(); };
    else p.style.strokeDasharray = "";
  }
  function svgEnter(svg, d, quick) {
    var k = quick ? 0.6 : 1;
    var bars = svg.querySelector("g.bars");
    if (bars && bars.firstChild) {
      var y0 = parseFloat(bars.getAttribute("data-y0")) || 0;
      bars.style.transformBox = "view-box"; bars.style.transformOrigin = "0 " + y0 + "px";
      anim(bars, [{ transform: "scaleY(0)" }, { transform: "none" }], { duration: 900 * k, delay: d, easing: SPRING });
    }
    var area = svg.querySelector("g.areas");
    if (area && area.firstChild) anim(area, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 900 * k, delay: d + 300 * k, easing: SOFT });
    var lines = $$("g.lines path", svg);
    if (lines.length <= 4) lines.forEach(function (p) { drawLine(p, d + 80 * k, 1200 * k); });
    else { var gl = svg.querySelector("g.lines"); if (gl) fade(gl, d, 600); }
    var dots = svg.querySelector("g.dots");
    if (dots && dots.firstChild) fade(dots, d + 450 * k, 600 * k);
    $$("g.refs,g.labels", svg).forEach(function (g) { if (g.firstChild) fade(g, d + 500 * k, 600); });
    var hi = svg.querySelector("g.hi");
    if (hi && hi.firstChild) {
      hi.style.transformBox = "fill-box"; hi.style.transformOrigin = "center";
      anim(hi, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1.08)", offset: 0.6 }, { transform: "none" }], { duration: 700, delay: d + 1000 * k, easing: SOFT });
    }
  }

  /* ---------- Compteurs : le chiffre défile depuis la valeur affichée précédemment ---------- */
  var MEM = new Map();
  function textNode(node) {
    if (!node) return null;
    for (var i = 0; i < node.childNodes.length; i++) { var c = node.childNodes[i]; if (c.nodeType === 3 && /\d/.test(c.textContent)) return c; }
    return null;
  }
  function count(node, d, dur, key) {
    var tn = textNode(node); if (!tn) return;
    // nombre au format français : groupes de milliers séparés par une espace, décimales après la virgule
    var txt = tn.textContent, m = txt.match(/([−+\-]?)(\d{1,3}(?:[   ]\d{3})*(?:,\d+)?(?!\d)|\d+(?:,\d+)?)/);
    if (!m) return;
    var dec = (m[2].split(",")[1] || "").length, target = parseFloat(m[2].replace(/[\s  ]/g, "").replace(",", "."));
    if (!isFinite(target)) return;
    var start = key && MEM.has(key) ? MEM.get(key) : 0;
    if (key) MEM.set(key, target);
    if (Math.abs(start - target) < Math.pow(10, -dec) / 2) return;
    var pre = txt.slice(0, m.index) + m[1], post = txt.slice(m.index + m[0].length);
    var f = function (v) { return v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ /g, " "); };
    var t0 = performance.now() + d, ease = function (t) { return 1 - Math.pow(1 - t, 4); }, lastS = "", fr = 0;
    tn.textContent = pre + f(start) + post;
    var step = function (now) {
      if (!tn.parentNode) return;
      var t = Math.max(0, Math.min(1, (now - t0) / dur));
      // une image sur deux : le défilement des chiffres reste fluide à l'œil et coûte moitié moins
      if (t < 1 && (fr++ & 1)) { requestAnimationFrame(step); return; }
      var s = t >= 1 ? txt : pre + f(start + (target - start) * ease(t)) + post;
      if (s !== lastS) { tn.textContent = s; lastS = s; }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Contenu d'un bloc qui entre ---------- */
  var COUNT = ".hero-v,.stat-v,.hero-facts b";
  var GROW = ".adh-t span,.htrack .seg-p,.htrack .seg-s,.mbtn .mt span,.wd-t span,.bal-t span,.lgauge i,.dd-mac";
  var LIST = ".facts li,.nx";
  function inner(b, d, key, soft) {
    $$(".chart", b).forEach(function (ch) { var s = ch.querySelector("svg"); if (s) svgEnter(s, d, soft); ch._mw = ch._w; });
    $$(COUNT, b).slice(0, 6).forEach(function (el, i) { count(el, d + 100 + i * 70, soft ? 700 : 1000, key + "|" + i); });
    $$(GROW, b).slice(0, 14).forEach(function (el, i) {
      el.style.transformOrigin = "left center";
      anim(el, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: soft ? 650 : 950, delay: d + (soft ? 60 : 240) + i * (soft ? 15 : 30), easing: SPRING });
    });
    if (!soft) $$(LIST, b).slice(0, 6).forEach(function (el, i) {
      anim(el, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: d + 160 + i * 45, easing: SOFT });
    });
    // reflet sur les grandes cartes (les tuiles de chiffres ont déjà leurs compteurs)
    if (!soft && !b.matches(".stats>.stat")) glint(b, d + 320);
    // vague sur le calendrier : les bulles apparaissent ligne après ligne
    var cal = b.querySelector(".dcal");
    if (cal && !soft) Array.prototype.forEach.call(cal.children, function (c, idx) {
      if (!c.classList.contains("dcell")) return;
      var row = Math.floor(idx / 8), col = idx % 8;
      anim(c, [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "scale(1.06)", offset: 0.6 }, { transform: "none" }], { duration: 560, delay: d + 150 + (row + col) * 28, easing: SOFT });
    });
  }
  function reveal(b, d, dir, soft) {
    var p = b.closest(".panel"), key = (p ? p.id : "") + "|" + (b._bi === undefined ? b.className : b._bi);
    if (soft) anim(b, [{ opacity: 0.4, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: d, easing: SOFT });
    else {
      var dx = dir ? dir * 26 : 0;
      anim(b, [{ opacity: 0, transform: "translate(" + dx + "px,22px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: d, easing: SPRING });
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
      if (r.top < vh * 1.02 && r.bottom > -40) { reveal(b, Math.min(n, 5) * (soft ? 35 : 65), dir, soft); n++; }
      else if (io) { io.observe(b); later.push(b); }
    });
    waiting.set(panel, later);
  }
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    io = new IntersectionObserver(function (entries) {
      var vis = entries.filter(function (e) { return e.isIntersecting; }).sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      vis.forEach(function (e, i) { io.unobserve(e.target); reveal(e.target, i * 70, 0, false); });
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
      $$(":scope > *", el).slice(0, 10).forEach(function (c, i) {
        if (isMine(c)) return;
        anim(c, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: i * 30, easing: SOFT });
      });
      $$(GROW, el).slice(0, 8).forEach(function (g, i) { g.style.transformOrigin = "left center"; anim(g, [{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 700, delay: 80 + i * 25, easing: SPRING }); });
    });
    Q.opened.forEach(function (b) {
      if (reduce || b.hidden) return;
      // ouverture d'une séance : le contenu glisse en place, sans animer la hauteur (rien à recalculer)
      anim(b, [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: SOFT });
      $$(".ex", b).slice(0, 10).forEach(function (r, i) { anim(r, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 460, delay: 60 + i * 40, easing: SOFT }); });
    });
    Q.boxes.forEach(function (b) { if (b.isConnected) placeInd(b, true); });
    Q.panels.clear(); Q.charts.clear(); Q.subs.clear(); Q.boxes.clear(); Q.opened.clear();
    first = false;
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
      if (acc > 36) set(true); else if (acc < -16) set(false);
    }, { passive: true });
  }

  /* ---------- Superpositions : message, dialogue, bandeau Dropbox, dépôt de fichiers ---------- */
  function initOverlays() {
    if (reduce) return;
    var watch = function (el, fn) { if (!el) return; new MutationObserver(function () { fn(el); }).observe(el, { attributes: true, attributeFilter: ["hidden", "class"], childList: true, characterData: true, subtree: true }); };
    var toastShown = false;
    watch($("#toast"), function (t) {
      if (t.hidden) { toastShown = false; return; }
      if (!toastShown) anim(t, [{ opacity: 0, transform: "translate(-50%,18px) scale(.9)" }, { opacity: 1, transform: "translate(-50%,0) scale(1)" }], { duration: 600, easing: SPRING, fill: "none" });
      else anim(t, [{ transform: "translate(-50%,0) scale(1.04)" }, { transform: "translate(-50%,0) scale(1)" }], { duration: 400, easing: SOFT, fill: "none" });
      toastShown = true;
    });
    var dlgShown = false;
    watch($("#dlg"), function (d) {
      if (d.hidden) { dlgShown = false; return; }
      if (dlgShown) return; dlgShown = true;
      fade(d, 0, 240);
      anim(d.querySelector(".dlg-in"), [{ opacity: 0, transform: "translateY(18px) scale(.92)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: SPRING });
    });
    var dropShown = false;
    watch($("#drop"), function (d) {
      if (d.hidden) { dropShown = false; return; }
      if (dropShown) return; dropShown = true;
      fade(d, 0, 220);
      anim(d.querySelector(".drop-in"), [{ transform: "scale(.9)" }, { transform: "none" }], { duration: 560, easing: SPRING });
    });
    var dbx = $("#dbx"), dbxSig = "";
    if (dbx) new MutationObserver(function () {
      if (dbx.hidden) { dbxSig = ""; return; }
      var sig = dbx.className + "|" + (dbx.querySelector(".dbx-msg b") || dbx).textContent.slice(0, 40);
      if (sig === dbxSig) return;
      var appear = !dbxSig; dbxSig = sig;
      if (appear) anim(dbx, [{ opacity: 0, transform: "translateY(-8px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 560, easing: SPRING });
      else anim(dbx, [{ opacity: 0.6, transform: "scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: SPRING, fill: "none" });
    }).observe(dbx, { attributes: true, attributeFilter: ["hidden", "class"], childList: true });
  }

  /* ---------- Première apparition de l'en-tête ---------- */
  function headerIn() {
    if (reduce) return;
    anim($(".brand-name"), [{ opacity: 0, transform: "translateY(14px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 950, delay: 60, easing: SOFT });
    anim($(".brand-sub"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 750, delay: 180, easing: SOFT });
    $$(".top-act > .btn").forEach(function (b, i) { anim(b, [{ opacity: 0, transform: "translateY(10px) scale(.92)" }, { opacity: 1, transform: "none" }], { duration: 750, delay: 240 + i * 70, easing: SPRING }); });
    anim($(".tabs"), [{ opacity: 0, transform: "translateY(18px) scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: 280, easing: SPRING });
    anim($(".period"), [{ opacity: 0, transform: "translateY(12px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 850, delay: 320, easing: SPRING });
  }

  /* ---------- Démarrage ---------- */
  initBackground(); initLight(); initTouch(); initGlow(); initReveal(); initObserve(); initTabsMin(); initOverlays(); headerIn();
  document.documentElement.classList.toggle("mo-wait", false);
  syncInd(false);
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { syncInd(false); }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { syncInd(false); });
  window.Motion = { reduce: reduce, sync: syncInd };
})();
