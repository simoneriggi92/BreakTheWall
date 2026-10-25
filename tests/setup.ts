import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
// jsdom does not implement viewport scrolling or native dialog focus management.
if (typeof window !== 'undefined') {
  // The interface follows the system locale; existing tests read the Italian interface, English is tested explicitly.
  Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true });
  window.scrollTo = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
}
afterEach(cleanup);
