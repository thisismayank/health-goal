// Basecamp service worker — handles web-push events + click routing.
// Kept intentionally small; no offline caching yet.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Basecamp", body: event.data.text() };
  }
  const title = data.title || "Basecamp";
  const options = {
    body: data.body || "",
    icon: "/icon",
    badge: "/icon",
    // actionUrls maps action-id → URL so notificationclick can route
    // to the right place when the user taps an action button.
    data: {
      url: data.url || "/",
      actionUrls: data.actionUrls || {},
    },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    actions: Array.isArray(data.actions) ? data.actions : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clicked = event.action; // '' when body tapped; else action id
  const actionUrls =
    (event.notification.data && event.notification.data.actionUrls) || {};
  const url = clicked && actionUrls[clicked]
    ? actionUrls[clicked]
    : (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Prefer focusing an existing tab, navigate it to the URL.
      for (const client of clientList) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(url);
            return;
          } catch {
            // fall through to openWindow
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
