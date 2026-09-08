import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { setBackend } from './bindings/backend'
import { detectBackend } from './bindings'
import { initI18n } from './i18n'
import './style.css'

initI18n()
setBackend(detectBackend())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
