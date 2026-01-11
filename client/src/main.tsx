import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import campfireUrl from './assets/fonts/Campfire.ttf?url'

const injectedFontStyle = document.createElement('style')
injectedFontStyle.textContent = `
@font-face {
  font-family: 'Campfire';
  src: url('${campfireUrl}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
html, body, #root, #root * {
  font-family: 'Campfire', 'Carter One', system-ui, sans-serif !important;
}
`
document.head.appendChild(injectedFontStyle)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
