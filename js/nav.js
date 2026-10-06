/* アプリとして追加（ホーム画面／Dock）したとき、同じサイト内のリンクをアプリ内で開く */
(function () {
  'use strict';
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
