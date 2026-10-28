import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const clientModules = path.join(rootDir, 'client', 'node_modules');
const reactDir = path.join(clientModules, 'react');
const reactDomDir = path.join(clientModules, 'react-dom');
const testingLibraryDir = path.join(clientModules, '@testing-library');
const axiosDir = path.join(clientModules, 'axios');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.join(reactDir, 'index.js') },
      { find: /^react\/jsx-runtime$/, replacement: path.join(reactDir, 'jsx-runtime.js') },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: path.join(reactDir, 'jsx-dev-runtime.js'),
      },
      { find: /^react-dom$/, replacement: path.join(reactDomDir, 'index.js') },
      { find: /^react-dom\/client$/, replacement: path.join(reactDomDir, 'client.js') },
      { find: /^react-dom\/server$/, replacement: path.join(reactDomDir, 'server.js') },
      { find: /^react-dom\/test-utils$/, replacement: path.join(reactDomDir, 'test-utils.js') },
      {
        find: /^@testing-library\/react$/,
        replacement: path.join(testingLibraryDir, 'react', 'dist', 'index.js'),
      },
      {
        find: /^@testing-library\/user-event$/,
        replacement: path.join(testingLibraryDir, 'user-event', 'dist', 'esm', 'index.js'),
      },
      {
        find: /^@testing-library\/jest-dom\/vitest$/,
        replacement: path.join(testingLibraryDir, 'jest-dom', 'dist', 'vitest.mjs'),
      },
      { find: /^axios$/, replacement: path.join(axiosDir, 'index.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.jsx'],
    server: {
      deps: {
        inline: true,
      },
    },
  },
});
