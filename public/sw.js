// Minimal service worker — its only job is to exist, since a controlling
// SW is one of the install-prompt criteria on Chrome/Android/desktop. No
// offline caching: the app needs a live server for auth and data anyway.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
