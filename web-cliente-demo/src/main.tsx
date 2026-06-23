import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DevAuthProvider } from './context/DevAuthContext'
import { AppStoreProvider } from './context/AppStoreContext'
import { SettingsProvider } from './context/SettingsContext'
import '@tabler/core/dist/css/tabler.min.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './tabler-brand.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DevAuthProvider>
          <SettingsProvider>
            <AppStoreProvider>
              <App />
            </AppStoreProvider>
          </SettingsProvider>
        </DevAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
