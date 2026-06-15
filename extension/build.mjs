import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(dirname, 'dist')
const publicDir = path.join(dirname, 'public')

await rm(distDir, { recursive: true, force: true })
await mkdir(distDir, { recursive: true })

await Promise.all([
  build({
    entryPoints: [path.join(dirname, 'src', 'content.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['firefox121', 'chrome121'],
    outfile: path.join(distDir, 'content.js'),
    jsx: 'automatic',
    sourcemap: false,
    logLevel: 'info',
  }),
  build({
    entryPoints: [path.join(dirname, 'src', 'injected.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['firefox121', 'chrome121'],
    outfile: path.join(distDir, 'injected.js'),
    sourcemap: false,
    logLevel: 'info',
  }),
  build({
    entryPoints: [path.join(dirname, 'src', 'background.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['firefox121', 'chrome121'],
    outfile: path.join(distDir, 'background.js'),
    sourcemap: false,
    logLevel: 'info',
  }),
])

await cp(publicDir, distDir, { recursive: true })
