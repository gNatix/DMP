import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { TextInputProvider } from './contexts/TextInputContext.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <TextInputProvider>
        <App />
      </TextInputProvider>
    </AuthProvider>
  </React.StrictMode>,
)
