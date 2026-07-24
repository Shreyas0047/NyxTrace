import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
