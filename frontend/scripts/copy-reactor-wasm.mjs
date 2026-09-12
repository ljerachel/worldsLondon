import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function copyReactorWasm(
  source = resolve('node_modules/@reactor-team/js-sdk/dist/wasm'),
  destination = resolve('dist/assets/wasm'),
) {
  if (!existsSync(source)) throw new Error(`Reactor WASM runtime not found at ${source}`)
  cpSync(source, destination, { recursive: true })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  copyReactorWasm()
}
