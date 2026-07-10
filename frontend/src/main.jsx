import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { startKeepAlive } from './services/keepAlive.js'

// Mantém o backend do Render.com acordado com pings a cada 10 min
startKeepAlive()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
