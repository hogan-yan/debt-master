import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';

if (import.meta.env.DEV) {
  import('react-grab').then(() => {
    // Hide react-grab canvas from assistive technology
    setTimeout(() => {
      document.querySelectorAll('canvas').forEach((canvas) => {
        if (!canvas.hasAttribute('aria-hidden')) {
          canvas.setAttribute('aria-hidden', 'true');
        }
      });
    }, 500);
  });
}

hydrateRoot(document, <StartClient />);
