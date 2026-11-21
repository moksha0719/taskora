import '@testing-library/jest-dom';

class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions): void {}

  unobserve(_target: Element): void {}

  disconnect(): void {}
}

globalThis.ResizeObserver = MockResizeObserver;
