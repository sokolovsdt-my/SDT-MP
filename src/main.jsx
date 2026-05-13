import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Регистрируем Firebase Messaging service worker явно, не полагаясь на то,
// что Firebase SDK сделает это сам при getToken(). Так при первом запуске
// есть шанс получить токен сразу, а не на втором клике, и сбой регистрации
// виден в console.error, а не утаивается внутри SDK.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .catch(err => console.error('SW registration failed:', err))
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
