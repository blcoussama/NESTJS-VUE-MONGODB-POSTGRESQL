import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import store, { persistor } from './store/store'
import { ThemeProvider } from './context/ThemeProvider'
import { initializeStoreReferences } from './utils/storeInitializer'

// Set store reference for SocketManager
initializeStoreReferences(store);

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
              <App />
          </ThemeProvider>
        </BrowserRouter>
      </PersistGate>
    </StrictMode>
  </Provider>
)
