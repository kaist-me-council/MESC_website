/* 기계공학과 학생회 — 웹 푸시 전용 서비스 워커.
 *
 * 페이지 오프라인 캐시는 일부러 넣지 않는다. 공지·신청 마감처럼 "지금 값"이 중요한
 * 사이트에서 오래된 캐시를 보여 주는 것이 캐시가 없는 것보다 나쁘다.
 *
 * 아이폰은 홈 화면에 추가한 상태(standalone)에서만 푸시가 동작한다.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const FALLBACK = { title: "기계공학과 학생회", body: "새 소식이 있습니다.", url: "/" };

function readPayload(event) {
  if (!event.data) return FALLBACK;
  try {
    const d = event.data.json();
    return {
      title: typeof d.title === "string" && d.title ? d.title : FALLBACK.title,
      body: typeof d.body === "string" && d.body ? d.body : FALLBACK.body,
      url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : FALLBACK.url,
    };
  } catch {
    // JSON 이 아니면 본문을 그대로 쓴다
    let text = "";
    try { text = event.data.text(); } catch { /* 무시 */ }
    return { ...FALLBACK, body: text || FALLBACK.body };
  }
}

self.addEventListener("push", (event) => {
  const p = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: p.url },
      tag: p.url, // 같은 대상 알림은 덮어써서 쌓이지 않게
    })
  );
});

/**
 * 알림 대상 URL 을 같은 origin 으로 확정한다. 다른 origin·잘못된 값이면 홈으로.
 * (알림 payload 는 서버가 만들지만, 값이 어긋나도 외부로 열지 않도록 여기서 한 번 더 막는다.)
 */
function resolveTarget(url) {
  try {
    const u = new URL(url || "/", self.location.origin);
    return u.origin === self.location.origin ? u.href : new URL("/", self.location.origin).href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}

/**
 * 열려 있는 창 중 "정확히 대상 URL 인" 창만 고른다. 없으면 null → 새 창을 연다.
 * 관련 없는 탭을 navigate 하지 않는다 — 관리자가 공지·캠페인을 작성 중이면
 * 미저장 입력이 사라지기 때문이다.
 */
function pickClient(clientList, target) {
  for (const client of clientList) {
    if (client.url === target) return client;
  }
  return null;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    (async () => {
      const target = resolveTarget(url);
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = pickClient(clientList, target);
      if (existing && "focus" in existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});

// 브라우저가 구독을 갱신하면 새 구독을 서버에 다시 등록한다.
// 옛 endpoint 는 다음 발송에서 410 을 받아 서버가 정리한다.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription && event.oldSubscription.options
        ? event.oldSubscription.options.applicationServerKey
        : null;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    })()
  );
});
