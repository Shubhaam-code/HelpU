import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext';
import './index.css';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// Register PWA service worker
registerServiceWorker();

// Suppress accidental long-press Android context menu & selection popups on non-input UI elements
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    const tag = e.target?.tagName?.toUpperCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.target?.isContentEditable) {
      e.preventDefault();
    }
  });
}

console.log('[HelpuPush] 0. Web app mounted inside Capacitor WebView.');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FirebaseAuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FirebaseAuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
