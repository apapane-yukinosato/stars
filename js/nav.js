/* アプリとして追加（ホーム画面／Dock）したとき、同じサイト内のリンクをアプリ内で開く */
(function () {
  'use strict';
  // 常に最新の版を使うための Service Worker（https または localhost のときだけ）
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(new URL('sw.js', document.currentScript ? document.currentScript.src : location.href).href).then(function (reg) { reg.update(); }).catch(function () { /* 登録できなくても動作に影響なし */ });
      });
    }
  } catch (e) { /* 無視 */ }
  var standalone = false;
  try {
    standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  } catch (e) { /* 判定できない環境では何もしない */ }
  if (!standalone) return;
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    // 同じサイト（同じオリジンで /stars/ 配下）だけをアプリ内遷移にする
    var base = new URL('./', location.href).pathname;
    if (u.origin !== location.origin || u.pathname.indexOf(base) !== 0) return;
    e.preventDefault();
    location.href = u.href;
  }, false);
})();
