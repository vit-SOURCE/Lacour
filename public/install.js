/* Installation de l'application (PWA) : propose l'installation dès que le lien est ouvert sur un téléphone.
   - Android / Chrome : bouton « Installer » (invite native du navigateur)
   - iPhone / iPad : explications pas à pas (Safari ne permet pas l'invite automatique)
   - Navigateur intégré (WhatsApp, Facebook…) : demande d'ouvrir le lien dans Chrome ou Safari */
(function () {
  "use strict";
  var ua = navigator.userAgent || "", deferred = null, LATER = "pwa-later", DAYS = 3;
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|TikTok|WhatsApp|; wv\)/i.test(ua) ||
    (isIOS && !/Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua));
  var landing = !!window.PWA_LANDING;

  function standalone() {
    try { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; } catch (e) { return false; }
  }
  function decide() {
    if (standalone()) return "installed";
    if (deferred) return "prompt";
    if (inApp) return "browser";
    if (isIOS) return "ios";
    if (isAndroid) return "android";
    return "desktop";
  }
  function later() { try { var t = Number(localStorage.getItem(LATER)); return t && Date.now() - t < DAYS * 864e5; } catch (e) { return false; } }
  function setLater() { try { localStorage.setItem(LATER, String(Date.now())); } catch (e) {} }
  function copy(text, done) {
    function fb() { try { var a = document.createElement("textarea"); a.value = text; document.body.appendChild(a); a.select(); document.execCommand("copy"); document.body.removeChild(a); done(true); } catch (e) { done(false); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fb); else fb();
  }
  function chromeIntent() { return "intent://" + location.host + location.pathname + location.search + "#Intent;scheme=https;package=com.android.chrome;end"; }

  var TEXT = {
    prompt: ["Installer l’application", "Ajoutez-la à votre écran d’accueil pour l’ouvrir en un geste, comme une application."],
    ios: ["Installer sur iPhone", "Touchez le bouton Partager (le carré avec une flèche vers le haut), faites défiler, puis touchez « Sur l’écran d’accueil » et « Ajouter »."],
    android: ["Installer sur Android", "Ouvrez le menu ⋮ du navigateur, puis touchez « Installer l’application » (ou « Ajouter à l’écran d’accueil »)."],
    browser: ["Ouvrez le lien dans votre navigateur", "Ce lien est ouvert dans une fenêtre intégrée (WhatsApp, Facebook…) qui ne permet pas l’installation. Ouvrez-le dans Chrome ou Safari, puis installez l’application."],
    desktop: ["Installer sur cet ordinateur", "Cliquez sur l’icône d’installation dans la barre d’adresse de Chrome ou d’Edge, ou ouvrez le menu puis « Installer ». Sur téléphone, ouvrez ce lien depuis votre téléphone."],
    installed: ["Application installée", "L’application est déjà installée sur cet appareil."]
  };

  function actions(mode, box, onDone) {
    var b = box.querySelector("[data-act]"); if (!b) return;
    b.innerHTML = "";
    function btn(label, primary, fn) {
      var x = document.createElement("button"); x.type = "button"; x.textContent = label;
      x.style.cssText = "font:inherit;font-weight:700;padding:10px 14px;border-radius:10px;cursor:pointer;border:" + (primary ? "0" : "1px solid #cbd6d4") + ";background:" + (primary ? "#0f766e" : "transparent") + ";color:" + (primary ? "#fff" : "inherit");
      x.addEventListener("click", fn); b.appendChild(x); return x;
    }
    if (mode === "prompt") btn("Installer", true, function () {
      if (!deferred) return; var d = deferred; d.prompt();
      if (d.userChoice && d.userChoice.then) d.userChoice.then(function (c) { deferred = null; if (c && c.outcome === "accepted") onDone("installed"); else refresh(); });
    });
    if (mode === "browser") {
      var cp = btn("Copier le lien", true, function () { copy(location.href, function (ok) { cp.textContent = ok ? "Lien copié ✓" : "Copiez le lien dans la barre d’adresse"; }); });
      if (isAndroid) { var a = document.createElement("a"); a.href = chromeIntent(); a.textContent = "Ouvrir dans Chrome"; a.style.cssText = "font-weight:700;padding:10px 14px;border-radius:10px;border:1px solid #cbd6d4;text-decoration:none;color:inherit"; b.appendChild(a); }
    }
    if (mode === "ios" || mode === "android") btn("Copier le lien", false, function () { copy(location.href, function () {}); });
    if (!landing && mode !== "installed") btn("Plus tard", false, function () { setLater(); hideBar(); });
    if (landing) { var o = document.createElement("a"); o.href = "./"; o.textContent = "Ouvrir l’application"; o.style.cssText = "font-weight:700;padding:10px 14px;border-radius:10px;border:1px solid #cbd6d4;text-decoration:none;color:inherit"; b.appendChild(o); }
  }
  function fill(box, mode) {
    var t = TEXT[mode];
    box.querySelector("[data-t]").textContent = t[0];
    box.querySelector("[data-d]").textContent = t[1];
    actions(mode, box, function (m) { fill(box, m); });
  }
  function build() {
    var bar = document.createElement("div"); bar.id = "pwa-bar"; bar.setAttribute("role", "dialog");
    bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:60;max-width:520px;margin:0 auto;background:#fff;color:#12262a;border:1px solid #d5dfdd;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:14px;display:flex;gap:12px;font:15px/1.4 system-ui,-apple-system,sans-serif";
    bar.innerHTML = '<img src="icons/icon-192.png" alt="" width="46" height="46" style="border-radius:10px;flex:none;align-self:flex-start"><div style="flex:1"><div data-t style="font-weight:700;margin-bottom:2px"></div><div data-d style="color:#4b5f64;font-size:14px;margin-bottom:10px"></div><div data-act style="display:flex;gap:8px;flex-wrap:wrap"></div></div>';
    return bar;
  }
  function hideBar() { var b = document.getElementById("pwa-bar"); if (b && b.parentNode) b.parentNode.removeChild(b); }
  function refresh() {
    var mode = decide();
    if (landing) { var c = document.getElementById("pwa-landing"); if (c) fill(c, mode); return; }
    if (mode === "installed" || later()) { hideBar(); return; }
    if (mode === "desktop") { hideBar(); return; } // sur ordinateur : bannière seulement si le navigateur propose l'installation
    var bar = document.getElementById("pwa-bar");
    if (!bar) { bar = build(); document.body.appendChild(bar); }
    fill(bar, mode);
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener("appinstalled", function () { deferred = null; hideBar(); refresh(); });
  window.__pwa = { decide: decide };
  function start() { setTimeout(refresh, landing ? 0 : 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
