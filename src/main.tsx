import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SITE_NAME } from './config/site'
import './index.css'
import App from './App.tsx'

document.title = SITE_NAME
const description = document.querySelector<HTMLMetaElement>(
  'meta[name="description"]',
)
if (description) {
  description.content = `${SITE_NAME} — Portal de campanhas estaduais.`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
