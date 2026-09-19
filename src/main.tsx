import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './shared.css';
import { App } from './App.tsx';
import { BridgeProvider } from './components/BridgeProvider.tsx';

// The provider is deliberately above App rather than inside it: it holds the
// socket and the snapshot, and everything a hot update touches is below it.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider>
      <App />
    </BridgeProvider>
  </StrictMode>,
);
