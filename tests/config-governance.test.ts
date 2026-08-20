// =============================================================================
// Configuration governance — the build fails when configuration lies.
//
// Guarantees enforced here:
//  1. Registry integrity — unique keys, valid tree categories, defaults that
//     pass their own validators, selects with options, sane secret typing.
//  2. Enforcement honesty — every key claiming status 'enforced' must name
//     reader files that EXIST and literally CONTAIN the key. A claim cannot
//     outlive the code that made it true.
//  3. No ghost readers — every literal getSetting()/getConfig() key used by
//     business logic must exist in the registry. Code cannot depend on a
//     setting the configuration center doesn't know.
//  4. Cross-rule sanity — every rule references known keys, and shipped
//     defaults do not violate any rule.
//  5. Deprecated keys are really gone from the registry.
// =============================================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'

import { CONFIG_REGISTRY, DEPRECATED_KEYS } from '@/lib/config/registry'
import { CONFIG_TREE, isValidCategory } from '@/lib/config/tree'
import { CONFIG_RULES } from '@/lib/config/rules'
import { validateValue } from '@/lib/config/validate'

const ROOT = path.resolve(import.meta.dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry)) continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

test('registry: keys are unique and categories exist in the tree', () => {
  const seen = new Set<string>()
  for (const def of CONFIG_REGISTRY) {
    assert.ok(!seen.has(def.key), `duplicate key: ${def.key}`)
    seen.add(def.key)
    assert.ok(
      isValidCategory(def.category),
      `key ${def.key} points at unknown category '${def.category}'`
    )
  }
})

test('registry: every default value passes its own validator', () => {
  for (const def of CONFIG_REGISTRY) {
    const fail = validateValue(def, def.defaultValue)
    assert.equal(
      fail,
      null,
      `default of ${def.key} ('${def.defaultValue}') fails validation: ${fail?.messageEn}`
    )
  }
})

test('registry: selects have options, secrets are typed secret', () => {
  for (const def of CONFIG_REGISTRY) {
    if (def.type === 'select') {
      assert.ok(def.options && def.options.length >= 2, `select ${def.key} needs >= 2 options`)
    }
    if (def.secret) {
      assert.equal(def.type, 'secret', `secret key ${def.key} must have type 'secret'`)
    }
  }
})

test('enforcement honesty: every enforced key has living readers', () => {
  for (const def of CONFIG_REGISTRY) {
    if (def.enforcement.status !== 'enforced') continue
    const readers = def.enforcement.readBy ?? []
    assert.ok(readers.length > 0, `${def.key} claims 'enforced' but lists no readBy files`)
    for (const rel of readers) {
      const p = path.join(ROOT, rel)
      assert.ok(existsSync(p), `${def.key}: reader file missing: ${rel}`)
      const src = readFileSync(p, 'utf8')
      assert.ok(
        src.includes(`'${def.key}'`) || src.includes(`"${def.key}"`) || src.includes(`\`${def.key}\``),
        `${def.key}: reader ${rel} does not actually reference the key`
      )
    }
  }
})

test('no ghost readers: every literal config key used in src/ exists in the registry', () => {
  const known = new Set(CONFIG_REGISTRY.map((d) => d.key))
  const files = walk(path.join(ROOT, 'src'))
  const CALL_RE =
    /(?:getSetting|getSettingNumber|getSettingBool|getConfig|getConfigNumber|getConfigBool)\(\s*['"`]([^'"`]+)['"`]/g
  const ghosts: string[] = []
  for (const f of files) {
    // the config layer itself may mention keys generically
    if (f.includes(path.join('src', 'lib', 'config'))) continue
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(CALL_RE)) {
      const key = m[1]
      if (!key.includes('.')) continue // not a settings key literal
      if (!known.has(key)) ghosts.push(`${path.relative(ROOT, f)} → ${key}`)
    }
  }
  assert.deepEqual(ghosts, [], `business logic reads keys unknown to the registry:\n${ghosts.join('\n')}`)
})

test('cross-rules: reference known keys and pass on shipped defaults', () => {
  const defaults: Record<string, string> = {}
  const known = new Set<string>()
  for (const d of CONFIG_REGISTRY) {
    defaults[d.key] = d.defaultValue
    known.add(d.key)
  }
  for (const rule of CONFIG_RULES) {
    for (const k of rule.keys) {
      assert.ok(known.has(k), `rule ${rule.id} references unknown key ${k}`)
    }
    const err = rule.check(defaults)
    assert.equal(err, null, `rule ${rule.id} fails on shipped defaults: ${err?.messageEn}`)
  }
})

test('deprecated keys are gone from the registry', () => {
  const known = new Set(CONFIG_REGISTRY.map((d) => d.key))
  for (const dead of DEPRECATED_KEYS) {
    assert.ok(!known.has(dead), `deprecated key ${dead} is still in the registry`)
  }
})

test('tree: leaf ids unique across sections', () => {
  const ids = new Set<string>()
  for (const s of CONFIG_TREE) {
    for (const l of s.leaves) {
      assert.ok(!ids.has(l.id), `duplicate tree leaf id: ${l.id}`)
      ids.add(l.id)
    }
  }
})
