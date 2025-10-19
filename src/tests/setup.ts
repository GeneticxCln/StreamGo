import '@testing-library/jest-dom/vitest';

// Minimal IntersectionObserver stub for JSDOM
globalThis.IntersectionObserver =
  globalThis.IntersectionObserver ||
  class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;