import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@/index.css';

function renderFatalError(message: string): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    return;
  }
  rootElement.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 40rem;">
      <h1 style="color: #b91c1c; margin-bottom: 0.5rem;">Failed to start the app</h1>
      <pre style="white-space: pre-wrap; background: #fef2f2; padding: 1rem; border-radius: 8px;">${message}</pre>
      <p style="margin-top: 1rem; color: #444;">Check the browser console for details, then refresh.</p>
    </div>
  `;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  renderFatalError(message);
}

window.addEventListener('error', (event) => {
  console.error('[window.error]', event.error ?? event.message);
  const message = event.error instanceof Error ? event.error.message : event.message;
  if (typeof message === 'string' && message.length > 0) {
    renderFatalError(message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  renderFatalError(message);
});
