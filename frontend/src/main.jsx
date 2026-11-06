import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// Register PWA service worker
registerServiceWorker();

console.log('[HelpuPush] 0. Web app mounted inside Capacitor WebView.');

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl="/"
      allowedRedirectProtocols={['com.helpu.app:', 'com.helpu.app', 'helpu:', 'helpu']}
      allowedRedirectOrigins={['https://helpu.vercel.app']}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
