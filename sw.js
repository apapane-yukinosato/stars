/* 常に最新のファイルを優先して取得する Service Worker。
 * ホーム画面に追加したアプリが古い JS/CSS を使い続けないようにする（オフラインのときだけ保存済みのものを使う） */
const CACHE = 'hoshizora-lab-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // 外部サイトには触れない
  event.respondWith((async () => {
    try {
      // 常にサーバーに確認して最新を取得（HTTP キャッシュの古い内容を使わない）
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (e) {
      const hit = await caches.match(req, { ignoreSearch: false }) || await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw e;
    }
  })());
});
