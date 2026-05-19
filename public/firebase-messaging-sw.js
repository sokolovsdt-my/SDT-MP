importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyBhmmj5-O8hTAEmDFrJ64Ybn2e9qLE-nmI",
  authDomain: "sdt-mp.firebaseapp.com",
  projectId: "sdt-mp",
  storageBucket: "sdt-mp.firebasestorage.app",
  messagingSenderId: "1071935978243",
  appId: "1:1071935978243:web:a4536e5f0d2d18ad44c736"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  // data.url пробрасываем дальше в showNotification, чтобы при клике вернуть
  // пользователя на нужный экран (см. notificationclick ниже).
  const data = payload.data || {}
  self.registration.showNotification(title || 'Уведомление', {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/favicon.ico',
    data,
  })
})

// S25: клик по пушу теперь фокусирует уже открытую вкладку с приложением
// или открывает новую на data.url. Раньше клик просто закрывал нотификацию
// и ничего не происходило.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Если приложение уже открыто — фокусируем и переходим на нужный URL.
    for (const c of allClients) {
      if ('focus' in c) {
        try { await c.navigate(targetUrl) } catch { /* navigate может быть запрещён для cross-origin — игнорируем */ }
        return c.focus()
      }
    }
    // Иначе — открываем новую вкладку.
    if (clients.openWindow) {
      return clients.openWindow(targetUrl)
    }
  })())
})
