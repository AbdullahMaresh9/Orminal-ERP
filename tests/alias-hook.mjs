// Module resolution hook for `node --test` runs.
// Node does not read tsconfig `paths`, and TypeScript source uses extensionless
// imports. This hook maps "@/..." to src/... and appends the .ts/.tsx extension
// for both aliased and relative specifiers.
import { registerHooks } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

function firstExisting(base) {
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    base,
  ]
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).isFile()) return c
    } catch {}
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/lib/..." -> "<root>/src/lib/..."
    if (specifier.startsWith('@/')) {
      const hit = firstExisting(path.join(root, 'src', specifier.slice(2)))
      if (hit) return nextResolve(pathToFileURL(hit).href, context)
    }
    // extensionless relative import from a TS file
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier) && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL))
      const hit = firstExisting(path.resolve(parentDir, specifier))
      if (hit) return nextResolve(pathToFileURL(hit).href, context)
    }
    // Bare package subpaths that Next ships as ESM files (e.g. "next/server").
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND' && !path.extname(specifier)) {
        return nextResolve(`${specifier}.js`, context)
      }
      throw err
    }
  },
})
