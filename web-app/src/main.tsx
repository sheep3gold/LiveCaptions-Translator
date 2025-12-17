import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // 临时移除 StrictMode 以避免语音识别问题
  // <React.StrictMode>
    <App />
  // </React.StrictMode>,
)

