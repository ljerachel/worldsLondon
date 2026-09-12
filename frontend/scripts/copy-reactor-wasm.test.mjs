import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { copyReactorWasm } from './copy-reactor-wasm.mjs'

test('copies the complete Reactor WASM runtime into Vite assets', () => {
  const root = mkdtempSync(join(tmpdir(), 'reactor-wasm-'))
  const source = join(root, 'source')
  const destination = join(root, 'dist', 'assets', 'wasm')
  mkdirSync(source)
  writeFileSync(join(source, 'reactor_wasm.js'), 'export default async function init() {}')
  writeFileSync(join(source, 'reactor_wasm_bg.wasm'), 'wasm-binary')

  copyReactorWasm(source, destination)

  assert.equal(readFileSync(join(destination, 'reactor_wasm.js'), 'utf8'), 'export default async function init() {}')
  assert.equal(readFileSync(join(destination, 'reactor_wasm_bg.wasm'), 'utf8'), 'wasm-binary')
})
