import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Enregistre le service worker — condition nécessaire, avec le manifest,
// pour que le navigateur propose "Installer l'application".
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // L'app fonctionne normalement même si l'enregistrement échoue —
      // seule l'installation en tant qu'app ne sera pas proposée.
    });
  });
}
