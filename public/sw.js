self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 基本的なキャッシュなし。PWAのインストール条件をクリアするための最低限のハンドラです。
});
