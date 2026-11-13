/* Connecte l'application au serveur du restaurant.
   Fournit à l'application la même interface de données partagées (documents, collections, temps réel). */
(function () {
  "use strict";
  var KEYN = "resto-code", CODE = "", LEVEL = 0, DBO = null, pending = null;
  try { CODE = localStorage.getItem(KEYN) || ""; } catch (e) {}

  function fail(status, extra) {
    var code = status === 401 ? "revoked" : status === 403 || status === 404 || status === 400 ? "invalid_argument" : "unavailable";
    var e = { code: code, status: status }; if (extra) e.message = extra; return e;
  }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: { "x-key": CODE, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
      .catch(function () { throw { code: "unavailable", message: "Serveur injoignable" }; })
      .then(function (r) {
        if (r.status === 401) { try { localStorage.removeItem(KEYN); } catch (e) {} }
        if (!r.ok) throw fail(r.status);
        return r.json();
      });
  }

  /* ----- Écran de saisie du code d'accès ----- */
  function askCode(msg) {
    return new Promise(function (ok) {
      var d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:#0e1b1d;font-family:system-ui,sans-serif";
      d.innerHTML = '<form style="background:#16282b;color:#e6f0ee;border-radius:14px;padding:22px;width:100%;max-width:380px">' +
        '<h2 style="margin:0 0 6px">Connexion au restaurant</h2>' +
        '<p style="margin:0 0 14px;color:#93a8ab;font-size:14px">Saisissez le code d’accès fourni par le restaurant (le propriétaire saisit le code administrateur).</p>' +
        '<input id="rc-code" type="password" autocomplete="current-password" placeholder="Code d’accès" style="width:100%;padding:12px;border-radius:8px;border:1px solid #2a4145;background:#0e1b1d;color:#e6f0ee;font-size:16px">' +
        '<div id="rc-err" style="color:#f87171;font-size:14px;min-height:20px;margin-top:8px"></div>' +
        '<button style="width:100%;padding:12px;border:0;border-radius:8px;background:#2dd4bf;color:#06302b;font-weight:700;font-size:16px;margin-top:6px">Se connecter</button>' +
        '<div style="margin-top:14px;font-size:14px"><a href="#" id="rc-forgot" style="color:#2dd4bf">Code oublié ? (administrateur)</a></div>' +
        '<div id="rc-rec" style="display:none;margin-top:10px"><p style="margin:0 0 8px;color:#93a8ab;font-size:13px">Saisissez l’adresse e-mail de l’administrateur principal : les codes d’accès lui seront envoyés.</p>' +
        '<input id="rc-mail" type="email" autocomplete="email" placeholder="E-mail de l’administrateur" style="width:100%;padding:12px;border-radius:8px;border:1px solid #2a4145;background:#0e1b1d;color:#e6f0ee;font-size:16px">' +
        '<button type="button" id="rc-send" style="width:100%;padding:10px;border:1px solid #2a4145;border-radius:8px;background:transparent;color:#e6f0ee;font-size:15px;margin-top:8px">Envoyer les codes par e-mail</button>' +
        '<div id="rc-msg" style="font-size:14px;margin-top:8px;color:#93a8ab"></div></div></form>';
      document.body.appendChild(d);
      var f = d.querySelector("form"), i = d.querySelector("#rc-code"), er = d.querySelector("#rc-err");
      er.textContent = msg || ""; i.focus();
      fetch("/api/status").then(function (r) { return r.json(); }).then(function (j) {
        if (j && !j.keySet) { var n = document.createElement("div"); n.style.cssText = "color:#fbbf24;font-size:13px;margin:0 0 10px"; n.textContent = "Le code employés est défini par le restaurant. Demandez-le à l’administrateur."; f.insertBefore(n, i); }
      }).catch(function () {});
      d.querySelector("#rc-forgot").addEventListener("click", function (e) { e.preventDefault(); var b = d.querySelector("#rc-rec"); b.style.display = b.style.display === "none" ? "block" : "none"; });
      d.querySelector("#rc-send").addEventListener("click", function () {
        var m = d.querySelector("#rc-mail").value.trim(), out = d.querySelector("#rc-msg"); if (!m) return; out.textContent = "Envoi…";
        fetch("/api/codes/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: m }) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) { out.textContent = x.ok ? "Si cette adresse est celle de l’administrateur principal, un e-mail contenant les codes vient d’être envoyé." : (x.j.err || "Envoi impossible."); })
          .catch(function () { out.textContent = "Serveur injoignable. Vérifiez votre connexion."; });
      });
      f.addEventListener("submit", function (ev) {
        ev.preventDefault(); var c = i.value.trim(); if (!c) return;
        er.textContent = "Vérification…";
        fetch("/api/ping", { headers: { "x-key": c } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
          if (!j) { er.textContent = "Code incorrect."; return; }
          CODE = c; LEVEL = j.level; try { localStorage.setItem(KEYN, c); } catch (e) {}
          document.body.removeChild(d); ok();
        }).catch(function () { er.textContent = "Serveur injoignable. Vérifiez votre connexion."; });
      });
    });
  }
  function connect() {
    if (pending) return pending;
    pending = (async function () {
      var msg = "";
      for (;;) {
        if (CODE) {
          try {
            var r = await fetch("/api/ping", { headers: { "x-key": CODE } });
            if (r.ok) { LEVEL = (await r.json()).level; return true; }
            if (r.status !== 401) throw 0;
            CODE = ""; try { localStorage.removeItem(KEYN); } catch (e) {} msg = "Ce code n’est plus valide.";
          } catch (e) { if (e === 0 || e) return false; }
        }
        await askCode(msg); if (CODE) return true;
      }
    })();
    return pending;
  }

  /* ----- Temps réel : une connexion qui diffuse les changements ----- */
  var cols = {}, want = {}, ctrl = null, retry = 0, sched = null;
  function C(c) { return cols[c] || (cols[c] = { docs: new Map(), subs: [], ready: false }); }
  function mk(id, d) { return { id: id, exists: d !== undefined, data: function () { return d === undefined ? undefined : JSON.parse(JSON.stringify(d)); } }; }
  function colSnap(c) { var docs = []; C(c).docs.forEach(function (d, id) { docs.push(mk(id, d)); }); return { docs: docs, size: docs.length, empty: !docs.length }; }
  function notify(c, id) {
    C(c).subs.slice().forEach(function (s) {
      try {
        if (s.type === "col") s.next(colSnap(c));
        else if (id === undefined || id === s.id) s.next(mk(s.id, C(c).docs.get(s.id)));
      } catch (e) { console.error(e); }
    });
  }
  function handle(block) {
    var ev = "", data = "";
    block.split("\n").forEach(function (l) { if (l.indexOf("event:") === 0) ev = l.slice(6).trim(); else if (l.indexOf("data:") === 0) data += l.slice(5).trim(); });
    if (!data) return;
    var o = JSON.parse(data), c = o.col; if (!c) return;
    if (ev === "snap") { C(c).docs = new Map(o.docs); C(c).ready = true; notify(c); }
    else if (ev === "ch") { if (o.data === null) C(c).docs.delete(o.id); else C(c).docs.set(o.id, o.data); if (C(c).ready) notify(c, o.id); }
  }
  async function stream() {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController(); var my = ctrl, list = Object.keys(want);
    if (!list.length) return;
    try {
      var r = await fetch("/api/stream?cols=" + encodeURIComponent(list.join(",")), { headers: { "x-key": CODE }, signal: my.signal });
      if (r.status === 401) { try { localStorage.removeItem(KEYN); } catch (e) {} Object.keys(cols).forEach(function (c) { C(c).subs.forEach(function (s) { if (s.err) s.err({ code: "revoked" }); }); }); return; }
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = ""; retry = 0;
      for (;;) {
        var x = await rd.read(); if (x.done) break;
        buf += dec.decode(x.value, { stream: true });
        var i; while ((i = buf.indexOf("\n\n")) >= 0) { var blk = buf.slice(0, i); buf = buf.slice(i + 2); handle(blk); }
      }
    } catch (e) { if (my.signal.aborted) return; }
    if (my.signal.aborted) return;
    setTimeout(stream, Math.min(10000, 1000 * ++retry));
  }
  function subscribe(c, s) {
    var st = C(c); st.subs.push(s);
    if (!want[c]) { want[c] = 1; clearTimeout(sched); sched = setTimeout(stream, 20); }
    else if (st.ready) setTimeout(function () { try { s.type === "col" ? s.next(colSnap(c)) : s.next(mk(s.id, st.docs.get(s.id))); } catch (e) { console.error(e); } }, 0);
    return function () { st.subs = st.subs.filter(function (x) { return x !== s; }); };
  }

  function database() {
    var u = function (c, id) { return "/api/doc/" + encodeURIComponent(c) + "/" + encodeURIComponent(id); };
    return {
      collection: function (c) { return { onSnapshot: function (next, err) { return subscribe(c, { type: "col", next: next, err: err }); } }; },
      doc: function (p) {
        var a = p.split("/"), c = a[0], id = a[1];
        return {
          get: function () { return api("GET", u(c, id)).then(function (r) { return mk(id, r.exists ? r.data : undefined); }); },
          set: function (d) { return api("PUT", u(c, id), d); },
          update: function (d) { return api("PATCH", u(c, id), d); },
          delete: function () { return api("DELETE", u(c, id)); },
          acquire: function (o) { return api("POST", "/api/lease/" + encodeURIComponent(c) + "/" + encodeURIComponent(id), o); },
          onSnapshot: function (next, err) { return subscribe(c, { type: "doc", id: id, next: next, err: err }); }
        };
      }
    };
  }

  function rpc(url, body) {
    return fetch(url, { method: "POST", headers: { "x-key": CODE, "content-type": "application/json" }, body: JSON.stringify(body) })
      .catch(function () { throw { message: "Serveur injoignable. Vérifiez votre connexion." }; })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { message: j.err || "Erreur" }; return j; }); });
  }
  function rget(url) {
    return fetch(url, { headers: { "x-key": CODE } })
      .catch(function () { throw { message: "Serveur injoignable. Vérifiez votre connexion." }; })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { message: j.err || "Erreur" }; return j; }); });
  }
  window.claude = {
    access: {
      get: function () { return rget("/api/access"); },
    },
    recover: {
      request: function (id) { return rpc("/api/recover/request", { id: id }); },
      confirm: function (id, code, pinh) { return rpc("/api/recover/confirm", { id: id, code: code, pinh: pinh }); }
    },
    use: async function (name) {
      if (name === "db") { if (!(await connect())) return null; return DBO || (DBO = database()); }
      if (name === "user") return { canEdit: async function () { return LEVEL >= 2; }, isOwner: async function () { return LEVEL >= 2; }, can: async function () { return true; } };
      return null;
    }
  };
})();
