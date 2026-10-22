import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveConfig } from 'vite';
import { pages } from '../src/tools/shared/navigation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [...pages.filter(page => !page.file.includes('#')).map(page => page.file), 'popup.html'];

test('HTML sources live in pages while tool URLs keep their original filenames', () => {
  assert.deepEqual(readdirSync(root).filter(file => file.endsWith('.html')), []);
  for (const file of entries) assert.ok(existsSync(path.join(root, 'pages', file)), `missing source: pages/${file}`);
  assert.deepEqual(readdirSync(path.join(root, 'pages')).filter(file => file.endsWith('.html')).sort(), [...entries].sort());
});

test('Vite uses pages as its root while keeping public resources and dist at the repository root', async () => {
  const config = await resolveConfig({ configFile: path.join(root, 'vite.config.js'), logLevel: 'silent' }, 'build');
  assert.equal(config.root, path.join(root, 'pages'));
  assert.equal(config.publicDir, path.join(root, 'public'));
  assert.equal(path.resolve(config.root, config.build.outDir), path.join(root, 'dist'));
  assert.deepEqual(Object.values(config.build.rolldownOptions.input).sort(), entries.map(file => path.join(root, 'pages', file)).sort());
});
