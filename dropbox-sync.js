/* =====================================================================
   Synchronisation Dropbox, 100 % dans le navigateur
   - OAuth 2 avec PKCE (sans serveur, sans secret), accès hors ligne :
     le refresh token est gardé sur cet appareil (localStorage) et
     l'access token est renouvelé automatiquement.
   - À chaque ouverture : files/list_folder sur le dossier configuré,
     puis files/download du .database et du .rtf les plus récents
     (selon server_modified). Les fichiers sont passés tels quels à
     l'import existant de la page (lecteur SQLite et lecteur RTF intégrés).
   - Les seuls échanges réseau de ce script sont avec api.dropboxapi.com,
     content.dropboxapi.com et www.dropbox.com (page de connexion).
   ===================================================================== */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || {};
  var APP_KEY = String(CFG.DROPBOX_APP_KEY || "").trim();
  var FOLDER = normFolder(CFG.DROPBOX_FOLDER);
  var API = "https://api.dropboxapi.com";
  var CONTENT = "https://content.dropboxapi.com";
  var AUTHORIZE = "https://www.dropbox.com/oauth2/authorize";
  var K = { auth: "suivi:dropbox:auth", pkce: "suivi:dropbox:pkce", revs: "suivi:dropbox:revs", last: "suivi:dropbox:last" };
  var RESYNC_MS = 10 * 60 * 1000; // au retour dans l'app après 10 min, on revérifie Dropbox

  var box = document.getElementById("dbx"), btn = document.getElementById("dbxBtn");
  var busy = false, lastSync = 0;

  /* ---------- Outils ---------- */
  function normFolder(p) {
    p = String(p || "").trim().replace(/\/+$/, "");
    if (!p || p === "/") return "";
    return p.charAt(0) === "/" ? p : "/" + p;
  }
  function sget(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function sdel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function esc(s) { return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function dm(d) { return pad(d.getDate()) + "/" + pad(d.getMonth() + 1); }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? "" : dm(d) + " à " + hm(d); }
  function serialDay(d) { return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000); }
  function b64url(bytes) {
    var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function randomString(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); }
  function sha256(str) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (h) { return b64url(new Uint8Array(h)); }); }
  function redirectUri() {
    if (CFG.REDIRECT_URI) return CFG.REDIRECT_URI;
    return location.origin + location.pathname.replace(/index\.html$/, "");
  }
  function err(user, kind) { var e = new Error(user); e.user = user; e.kind = kind || "other"; return e; }

  /* ---------- Affichage ---------- */
  function show(kind, html, acts) {
    box.className = "dbx" + (kind ? " " + kind : "");
    box.innerHTML = (kind === "load" ? '<span class="dbx-spin" aria-hidden="true"></span>' : "") +
      '<span class="dbx-msg">' + html + '</span>' + (acts ? '<span class="dbx-acts">' + acts + '</span>' : "");
    box.hidden = false;
  }
  function hide() { box.hidden = true; box.innerHTML = ""; }
  function setBtn(mode) {
    btn.hidden = false;
    btn.disabled = mode === "busy";
    if (mode === "connect") { btn.className = "btn"; btn.textContent = "Se connecter à Dropbox"; btn.onclick = function () { connect(); }; }
    else { btn.className = "btn btn-ghost"; btn.textContent = mode === "busy" ? "Synchronisation…" : "Actualiser"; btn.title = "Recharger les derniers fichiers depuis Dropbox"; btn.onclick = function () { sync(true); }; }
  }
  var A_CODE = '<button type="button" class="linkbtn" data-a="code">Connexion par code</button>';
  var A_OUT = '<button type="button" class="linkbtn" data-a="logout">Déconnecter Dropbox</button>';
  box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a");
    if (a === "connect") connect();
    else if (a === "code") connectWithCode();
    else if (a === "retry") sync(true);
    else if (a === "logout") logout();
    else if (a === "hide") hide();
    else if (a === "send") submitCode();
  });
  function showDisconnected(extra) {
    setBtn("connect");
    show("", (extra ? extra + " " : "") + "Connecte ton Dropbox pour charger automatiquement ton dernier export Santé (.rtf) et ta dernière sauvegarde GymBook (.database) à chaque ouverture.",
      '<button type="button" class="btn btn-sm" data-a="connect">Se connecter à Dropbox</button>' + A_CODE);
  }

  /* ---------- OAuth 2 + PKCE ---------- */
  // Mode « redirect » (par défaut) : Dropbox revient sur cette page avec ?code=…
  // Mode « code » (secours, utile si la redirection sort de l'app installée sur iPhone) :
  //   Dropbox affiche un code à copier, que l'on colle ici.
  function startAuth(mode) {
    var verifier = randomString(48), state = randomString(16);
    return sha256(verifier).then(function (challenge) {
      sset(K.pkce, { v: verifier, s: state, mode: mode, at: Date.now() });
      var q = { client_id: APP_KEY, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline", require_role: "personal" };
      if (mode === "redirect") { q.redirect_uri = redirectUri(); q.state = state; }
      return AUTHORIZE + "?" + new URLSearchParams(q).toString();
    });
  }
  function connect() {
    if (!APP_KEY) { showNoKey(); return; }
    if (!window.crypto || !crypto.subtle) { show("err", "<b>Connexion impossible :</b> la page doit être ouverte en https.", ""); return; }
    startAuth("redirect").then(function (url) { location.assign(url); });
  }
  function connectWithCode() {
    if (!APP_KEY) { showNoKey(); return; }
    var w = window.open("about:blank", "_blank"); // ouvert tout de suite pour ne pas être bloqué
    startAuth("code").then(function (url) {
      if (w) w.location.href = url; else location.assign(url);
      show("", "Connecte-toi dans la fenêtre Dropbox, autorise l'accès, puis copie le code affiché et colle-le ici :",
        '<span class="dbx-code"><input id="dbxCode" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Code Dropbox"><button type="button" class="btn btn-sm" data-a="send">Valider</button></span>');
      var inp = document.getElementById("dbxCode");
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submitCode(); });
    });
  }
  function submitCode() {
    var inp = document.getElementById("dbxCode"), code = inp ? inp.value.trim() : "";
    if (!code) return;
    var p = sget(K.pkce);
    if (!p || p.mode !== "code") { showDisconnected("<b>La demande de connexion a expiré.</b>"); return; }
    exchange(code, p, false);
  }
  function tokenRequest(params) {
    return fetch(API + "/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = err("token", r.status === 400 ? "grant" : "http"); e.detail = j; throw e; }
          return j;
        });
      }, function () { throw err("Impossible de joindre Dropbox (réseau indisponible ?).", "network"); });
  }
  function exchange(code, p, withRedirect) {
    var params = { grant_type: "authorization_code", code: code, code_verifier: p.v, client_id: APP_KEY };
    if (withRedirect) params.redirect_uri = redirectUri();
    setBtn("busy"); show("load", "Connexion à Dropbox…");
    return tokenRequest(params).then(function (j) {
      sdel(K.pkce);
      if (!j.refresh_token) throw err("Dropbox n'a pas fourni d'accès hors ligne.", "grant");
      sset(K.auth, { refresh: j.refresh_token, access: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000, account: j.account_id || null });
      sdel(K.revs);
      return sync(true);
    }).catch(function (e) {
      sdel(K.pkce);
      showDisconnected("<b>La connexion n'a pas abouti" + (e.kind === "network" ? " (réseau indisponible)" : e.detail && e.detail.error_description ? " : " + esc(e.detail.error_description) : "") + ".</b> Réessaie.");
    });
  }
  // Retour de Dropbox sur cette page (mode « redirect »)
  function handleRedirect() {
    var qs = new URLSearchParams(location.search);
    if (!qs.has("code") && !qs.has("error")) return null;
    var code = qs.get("code"), state = qs.get("state"), error = qs.get("error"), desc = qs.get("error_description");
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
    var p = sget(K.pkce);
    if (error) { sdel(K.pkce); showDisconnected(error === "access_denied" ? "<b>Accès refusé dans Dropbox.</b>" : "<b>Dropbox a renvoyé une erreur" + (desc ? " : " + esc(desc) : "") + ".</b>"); return Promise.resolve(); }
    if (!p || p.mode !== "redirect" || p.s !== state) {
      // Typique quand le retour de Dropbox s'ouvre hors de l'app installée (stockage différent)
      showDisconnected("<b>La connexion n'a pas pu être finalisée ici.</b> Si tu utilises l'app depuis l'écran d'accueil, ouvre-la et choisis « Connexion par code ».");
      return Promise.resolve();
    }
    return exchange(code, p, true);
  }
  function auth() { return sget(K.auth); }
  function accessToken(forceRefresh) {
    var a = auth();
    if (!a || !a.refresh) return Promise.reject(err("Pas connecté.", "auth"));
    if (!forceRefresh && a.access && a.exp > Date.now() + 60000) return Promise.resolve(a.access);
    return tokenRequest({ grant_type: "refresh_token", refresh_token: a.refresh, client_id: APP_KEY }).then(function (j) {
      a.access = j.access_token; a.exp = Date.now() + (j.expires_in || 14400) * 1000; sset(K.auth, a);
      return a.access;
    }, function (e) {
      if (e.kind === "grant") { sdel(K.auth); throw err("Ta connexion Dropbox a expiré ou a été révoquée.", "auth"); }
      throw e;
    });
  }
  function logout() {
    var a = auth();
    sdel(K.auth); sdel(K.revs); sdel(K.last); sdel(K.pkce);
    if (a && a.access && a.exp > Date.now()) fetch(API + "/2/auth/token/revoke", { method: "POST", headers: { Authorization: "Bearer " + a.access } }).catch(function () { });
    showDisconnected("<b>Dropbox déconnecté.</b> Les données déjà chargées restent sur cet appareil.");
  }

  /* ---------- API Dropbox ---------- */
  // Appel avec renouvellement automatique du token si Dropbox répond 401
  function call(doFetch) {
    return accessToken(false).then(function (t) {
      return doFetch(t).then(function (r) {
        if (r.status !== 401) return r;
        return accessToken(true).then(doFetch);
      });
    }).then(function (r) {
      if (r.ok) return r;
      return r.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) { }
        var sum = (j && j.error_summary) || txt || "";
        if (r.status === 401) { sdel(K.auth); throw err("Ta connexion Dropbox a expiré ou a été révoquée.", "auth"); }
        if (/not_found/.test(sum)) throw err("Le dossier « " + (FOLDER || "/") + " » est introuvable dans le dossier de l'app Dropbox.", "folder");
        if (/missing_scope/.test(sum)) throw err("Il manque une permission à l'app Dropbox (files.metadata.read et files.content.read).", "scope");
        if (r.status === 429) throw err("Dropbox limite temporairement les requêtes. Réessaie dans une minute.", "http");
        throw err("Dropbox a répondu par une erreur (" + r.status + ").", "http");
      });
    }, function (e) {
      if (e && e.user) throw e;
      throw err("Impossible de joindre Dropbox (réseau indisponible ?).", "network");
    });
  }
  function rpc(path, body) {
    return call(function (t) {
      return fetch(API + "/2/" + path, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json(); });
  }
  function listFolder() {
    var out = [];
    function more(res) {
      out = out.concat(res.entries || []);
      return res.has_more ? rpc("files/list_folder/continue", { cursor: res.cursor }).then(more) : out;
    }
    return rpc("files/list_folder", { path: FOLDER, recursive: false, include_deleted: false }).then(more);
  }
  function download(entry) {
    return call(function (t) {
      // L'id du fichier (« id:… ») évite les accents dans l'en-tête HTTP
      return fetch(CONTENT + "/2/files/download", { method: "POST", headers: { Authorization: "Bearer " + t, "Dropbox-API-Arg": JSON.stringify({ path: entry.id }) } });
    }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var f = new File([buf], entry.name, { lastModified: Date.parse(entry.client_modified) || Date.now() });
      // Jour de l'export : ce jour-là les repas sont considérés incomplets (même règle que l'import manuel)
      f.refDay = serialDay(new Date(entry.client_modified || entry.server_modified));
      return f;
    });
  }
  function latest(entries, re) {
    return entries.filter(function (e) { return e[".tag"] === "file" && re.test(e.name); })
      .sort(function (a, b) { return Date.parse(b.server_modified) - Date.parse(a.server_modified); })[0] || null;
  }

  /* ---------- Synchronisation ---------- */
  function waitReady() {
    return new Promise(function (res) {
      (function check(n) { if (window.SuiviApp && window.SuiviApp.isReady()) res(); else if (n > 200) res(); else setTimeout(function () { check(n + 1); }, 50); })(0);
    });
  }
  function filesLine(db, rtf) {
    var p = [];
    if (rtf) p.push("Santé : " + esc(rtf.name) + " (" + when(rtf.server_modified) + ")");
    if (db) p.push("GymBook : " + esc(db.name) + " (" + when(db.server_modified) + ")");
    return p.join(" · ");
  }
  function sync(force) {
    if (busy) return Promise.resolve();
    if (!auth()) { showDisconnected(); return Promise.resolve(); }
    busy = true; setBtn("busy");
    show("load", "Chargement des derniers fichiers depuis Dropbox…");
    return waitReady().then(listFolder).then(function (entries) {
      var db = latest(entries, /\.database$/i), rtf = latest(entries, /\.rtf$/i);
      if (!db && !rtf) throw err("Aucun fichier .database ni .rtf dans le dossier « " + (FOLDER || "/") + " » de l'app Dropbox.", "empty");
      var prev = sget(K.revs) || {}, app = window.SuiviApp, fresh = !app.hasData();
      var todo = [db, rtf].filter(function (e) { return e && (force || fresh || prev[e.id] !== e.rev); });
      // Rien de nouveau : les données enregistrées sur l'appareil sont déjà à jour
      if (!todo.length) return { db: db, rtf: rtf, same: true };
      show("load", "Téléchargement de " + todo.map(function (e) { return esc(e.name); }).join(" et ") + "…");
      return Promise.all(todo.map(download)).then(function (files) {
        show("load", "Lecture des fichiers…");
        return app.importFiles(files);
      }).then(function (r) {
        if (!r || !r.ok) throw err((r && r.msg) || "L'import des fichiers Dropbox n'a pas abouti.", "import");
        var revs = {}; [db, rtf].forEach(function (e) { if (e) revs[e.id] = e.rev; });
        sset(K.revs, revs);
        return { db: db, rtf: rtf, msg: r.msg };
      });
    }).then(function (res) {
      lastSync = Date.now();
      var now = new Date();
      sset(K.last, { at: now.toISOString(), files: filesLine(res.db, res.rtf) });
      show("ok", "<b>Dropbox à jour</b> (" + hm(now) + (res.same ? ", aucun nouveau fichier" : "") + "). " + filesLine(res.db, res.rtf) +
        (!res.db ? " · aucune sauvegarde GymBook trouvée" : "") + (!res.rtf ? " · aucun export Santé trouvé" : ""),
        '<button type="button" class="linkbtn" data-a="hide">Masquer</button>' + A_OUT);
    }).catch(function (e) {
      var msg = e && e.user ? e.user : "La synchronisation Dropbox n'a pas abouti.";
      if (e && e.kind === "auth") { showDisconnected("<b>" + esc(msg) + "</b> Reconnecte-toi."); return; }
      var last = sget(K.last), hasData = window.SuiviApp && window.SuiviApp.hasData();
      show("err", "<b>" + esc(msg) + "</b>" + (hasData ? " Les dernières données chargées" + (last ? " (le " + when(last.at) + ")" : "") + " restent affichées." : ""),
        '<button type="button" class="btn btn-sm" data-a="retry">Réessayer</button>' + A_OUT);
    }).then(function () {
      busy = false;
      if (auth()) setBtn("sync");
    });
  }
  function showNoKey() {
    btn.hidden = true;
    show("", "<b>Dropbox n'est pas encore configuré :</b> renseigne <code>DROPBOX_APP_KEY</code> dans <code>APP_CONFIG</code> en haut de index.html. En attendant, le bouton « Importer des fichiers » fonctionne.", "");
  }

  /* ---------- Démarrage ---------- */
  if (!box || !btn) return;
  if (!APP_KEY) { showNoKey(); return; }
  var pending = handleRedirect();
  if (!pending) { if (auth()) sync(false); else showDisconnected(); }
  // App rouverte depuis l'écran d'accueil sans rechargement (iOS garde la page en mémoire)
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && auth() && !busy && Date.now() - lastSync > RESYNC_MS) sync(false);
  });
  window.addEventListener("online", function () { if (auth() && !busy && box.classList.contains("err")) sync(false); });
})();

/* ---------- Mode hors ligne (PWA) ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
}
