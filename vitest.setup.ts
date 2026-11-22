/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// jsdom leaves these out; the app reads both on first paint.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

window.scrollTo = () => undefined;
