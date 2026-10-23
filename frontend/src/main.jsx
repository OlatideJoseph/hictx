import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgba(22,26,36,0.95)',
          border: '1px solid #232838',
          color: '#e8ebf4',
          backdropFilter: 'blur(12px)',
        },
      }}
    />
  </StrictMode>,
)
