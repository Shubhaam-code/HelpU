import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext';
import './index.css';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// Register PWA service worker
registerServiceWorker();

console.log('[HelpuPush] 0. Web app mounted inside Capacitor WebView.');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FirebaseAuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FirebaseAuthProvider>
  </StrictMode>
);
