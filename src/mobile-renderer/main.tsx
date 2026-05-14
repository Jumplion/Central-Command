import React from 'react';
import { createRoot } from 'react-dom/client';
import { installMobileBridge } from '@mobile-bridge/index';
import App from '@renderer/App';
import '@renderer/styles/globals.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

async function init() {
  await installMobileBridge();

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element');

  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

init().catch((err) => {
  console.error('[mobile] Failed to initialise:', err);
});
