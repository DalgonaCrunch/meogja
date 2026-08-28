/*
 * 🔴 CACHE 이름을 올리면 install 에서 새 HTML 을 다시 받고 activate 에서 옛 캐시를 지운다.
 *    옛 캐시에는 그때의 "/" HTML 이 들어 있고, 그 HTML 은 그때의 청크를 가리킨다.
 *    청크 파일은 Vercel 에 계속 남아 있어서 네트워크가 한 번 흔들려 캐시로 떨어지면
 *    아주 오래된 앱이 그대로 살아난다(지운 기능이 되살아나 보인다).
 *    그래서 아래 fetch 에서 성공한 화면 요청을 캐시에 덮어써 폴백을 늘 최신으로 유지한다.
 */
const CACHE = "meogja-v3";
const STATIC = ["/", "/login"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isPage = e.request.mode === "navigate";
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // 화면(HTML)은 성공할 때마다 캐시를 갱신한다. 폴백이 옛 청크를 가리키면 안 된다.
        if (isPage && res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      // 🔴 "/" 폴백은 화면 요청에만 준다. API·청크·이미지 요청에 HTML 을 돌려주면
      //    JSON 파싱이 엉뚱하게 깨져서 원인 찾기가 훨씬 어려워진다. 깨끗하게 실패하는 게 낫다.
      .catch(() => caches.match(e.request).then((hit) => hit || (isPage ? caches.match("/") : undefined)))
  );
});

self.addEventListener("push", (e) => {
  let data = { title: "뭐 먹지?", body: "", url: "/" };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes(self.location.origin)) {
          win.focus();
          win.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
