import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import AuthCallback from './components/AuthCallback'
import './index.css'

// Remove StrictMode in development to prevent double initialization of effects
ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/auth/notion/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  // </React.StrictMode>,
)
