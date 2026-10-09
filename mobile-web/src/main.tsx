import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/push';
import { captureInstallPrompt, escapeInAppBrowser } from './lib/install';
import { applyGoParam } from './lib/links';
import { applyLargeText } from './lib/textSize';
import './styles.css';

applyGoParam();
applyLargeText();
captureInstallPrompt();
escapeInAppBrowser();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) registerServiceWorker();
