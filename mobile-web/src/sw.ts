/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA: serve index.html for in-app navigations so deep links work offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)))

// Web Push: payload is JSON { title, body, url? } sent by the backend.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? '세아온 근태관리', {
      body: data.body ?? '',
      icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
      data: { url: data.url ?? import.meta.env.BASE_URL },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data as { url?: string })?.url ?? import.meta.env.BASE_URL, self.location.origin)
  // Only navigate within this app's origin.
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = all.find((c) => c.url.startsWith(target.origin))
      if (existing) {
        await existing.focus()
        return existing.navigate(target.href)
      }
      return self.clients.openWindow(target.href)
    })(),
  )
})
