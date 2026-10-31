import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.jsx'

// Unexpected errors outside React rendering (event handlers, promises) go to the app log
window.addEventListener('error', (e) => {
  window.electronAPI?.logError?.({ message: e.message, stack: e.error?.stack })
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason
  window.electronAPI?.logError?.({ message: reason?.message || String(reason), stack: reason?.stack })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
