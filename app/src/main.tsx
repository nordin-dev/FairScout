import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { loadFontsUpFront } from './lib/fonts';

const root = document.getElementById('root');
if (!root) throw new Error('The #root element is missing from index.html.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

loadFontsUpFront().catch((error: unknown) => console.error('A font file did not load.', error));
