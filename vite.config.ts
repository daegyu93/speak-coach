import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/speak-coach/',
  plugins: [preact()],
  test: { environment: 'node' },
});
