import { vi } from "vitest";
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

vi.mock('../world/pixiWorld', async () => {
  const fake = await import('../world/fakeWorld');
  return { createPixiWorld: vi.fn(async () => fake.fakeWorld) };
});
