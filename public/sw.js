self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // 基本的なキャッシュなし。PWAのインストール条件をクリアするための最低限のハンドラです。
});
