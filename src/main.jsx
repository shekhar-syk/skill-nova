import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Case A Google Maps Demo Key Quota Defense: listen for auth/quota failures cleanly
window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args) => {
  origConsoleError.apply(console, args);
  try {
    const serialized = args
      .map((a) => (typeof a === 'string' ? a : a?.message || ''))
      .join(' ');
    if (/OverQuotaMapError|QuotaExceededError|RESOURCE_EXHAUSTED/i.test(serialized)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  } catch {
    // ignore serialization error
  }
};

createRoot(document.getElementById('root')).render(<App />);
