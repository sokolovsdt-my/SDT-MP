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
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico'
  })
})