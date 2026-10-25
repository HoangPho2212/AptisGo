const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('Scaffold: required client, server, and root files exist', () => {
  const requiredPaths = [
    'package.json',
    '.prettierrc.json',
    '.prettierignore',
    'client/package.json',
    'client/index.html',
    'client/vite.config.js',
    'client/eslint.config.js',
    'client/src/main.jsx',
    'client/src/App.jsx',
    'client/src/index.css',
    'client/.env.example',
    'server/package.json',
    'server/eslint.config.js',
    'server/src/app.js',
    'server/src/server.js',
    'server/.env.example',
  ];

  for (const path of requiredPaths) {
    assert.ok(existsSync(join(ROOT, path)), `missing required scaffold file: ${path}`);
  }
});

test('Scaffold: manifests declare dependencies, scripts, engines, and no workspaces', () => {
  const root = readJson('package.json');
  const client = readJson('client/package.json');
  const server = readJson('server/package.json');

  for (const [name, manifest] of [
    ['root', root],
    ['client', client],
    ['server', server],
  ]) {
    assert.equal(manifest.private, true, `${name} package must be private`);
    assert.equal(manifest.engines.node, '>=20.19.0', `${name} package must require Node >=20.19.0`);
    assert.equal(manifest.workspaces, undefined, `${name} package must not use npm workspaces`);
  }

  assert.equal(root.scripts.test, 'node --test "tests/*.test.js"');
  assert.ok(root.scripts.lint.includes('client'));
  assert.ok(root.scripts.lint.includes('server'));
  assert.ok(root.devDependencies.prettier, 'root must own Prettier');

  assert.equal(client.type, 'module');
  for (const dependency of ['react', 'react-dom']) {
    assert.ok(client.dependencies[dependency], `client must depend on ${dependency}`);
  }
  for (const dependency of ['vite', 'tailwindcss', '@tailwindcss/vite', '@vitejs/plugin-react']) {
    assert.ok(client.devDependencies[dependency], `client must dev-depend on ${dependency}`);
  }
  for (const script of ['dev', 'build', 'lint', 'format:check']) {
    assert.ok(client.scripts[script], `client must define the ${script} script`);
  }

  assert.equal(server.type, undefined, 'server must stay CommonJS');
  assert.ok(server.dependencies.express, 'server must depend on express');
  for (const script of ['dev', 'start', 'lint', 'format:check']) {
    assert.ok(server.scripts[script], `server must define the ${script} script`);
  }
  assert.equal(server.devDependencies['@vitejs/plugin-react'], undefined);
});

test('Scaffold: ESLint uses flat config only and Prettier owns formatting', () => {
  for (const configPath of [
    'eslint.config.js',
    'client/eslint.config.js',
    'server/eslint.config.js',
  ]) {
    assert.ok(existsSync(join(ROOT, configPath)), `missing flat config: ${configPath}`);
  }

  for (const legacyPath of [
    '.eslintrc',
    '.eslintrc.json',
    'client/.eslintrc',
    'server/.eslintrc',
  ]) {
    assert.ok(!existsSync(join(ROOT, legacyPath)), `legacy ESLint config found: ${legacyPath}`);
  }

  const clientConfig = read('client/eslint.config.js');
  assert.match(clientConfig, /eslint-plugin-react-hooks/);
  assert.match(clientConfig, /eslint-config-prettier/);
  assert.match(clientConfig, /globals\.browser/);

  const serverConfig = read('server/eslint.config.js');
  assert.match(serverConfig, /globals\.node/);
  assert.match(serverConfig, /eslint-config-prettier/);

  const prettier = readJson('.prettierrc.json');
  assert.equal(prettier.singleQuote, true);
  assert.equal(prettier.semi, true);
  assert.equal(prettier.printWidth, 100);
  assert.equal(prettier.trailingComma, 'es5');
  assert.equal(prettier.endOfLine, 'lf');

  assert.match(read('client/src/index.css'), /@import\s+['"]tailwindcss['"]/);
});
