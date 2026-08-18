// Money & quantity helpers — regression net for the Float→Decimal migration.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { n, round2, roundTo, sumBy, decimalsToNumbers } from '@/lib/erp/money'

const D = (v: string | number) => new Prisma.Decimal(v)

describe('money.n() coercion', () => {
  test('coerces Prisma.Decimal to number', () => {
    assert.equal(n(D('123.45')), 123.45)
    assert.equal(n(D(0)), 0)
    assert.equal(n(D('-99.9')), -99.9)
  })
  test('passes through numbers', () => {
    assert.equal(n(42), 42)
    assert.equal(n(3.14), 3.14)
  })
  test('parses numeric strings', () => {
    assert.equal(n('15.5'), 15.5)
  })
  test('null/undefined/garbage become 0', () => {
    assert.equal(n(null), 0)
    assert.equal(n(undefined), 0)
    assert.equal(n('not-a-number'), 0)
  })
})

describe('money.round2 / roundTo', () => {
  test('round2 snaps to cents', () => {
    assert.equal(round2(D('10.005')), 10.01)
    assert.equal(round2('2.344'), 2.34)
    assert.equal(round2(1 / 3), 0.33)
  })
  test('roundTo default 6 dp for quantities', () => {
    assert.equal(roundTo(D('1.2345678')), 1.234568)
    assert.equal(roundTo('2.5', 0), 3)
  })
})

describe('money.sumBy', () => {
  test('sums Decimal fields safely (no string concat); cents snapped with round2', () => {
    const lines = [{ total: D('10.10') }, { total: D('20.20') }, { total: D('0.70') }]
    const raw = sumBy(lines, (l) => l.total)
    // sumBy coerces each Decimal via n(), so it is real addition (not "10.1020.20..").
    assert.ok(Math.abs(raw - 31) < 1e-9, `raw sum ~31, got ${raw}`)
    // Residual binary-float drift is expected on a raw JS sum; money must be round2'd.
    assert.equal(round2(raw), 31)
  })
  test('mixed Decimal/number/null', () => {
    const rows = [{ v: D('5') }, { v: 3 as unknown as Prisma.Decimal }, { v: null }]
    assert.equal(sumBy(rows, (r) => r.v as never), 8)
  })
})

describe('money.decimalsToNumbers (API serialization)', () => {
  test('converts a top-level Decimal', () => {
    assert.strictEqual(decimalsToNumbers(D('12.34')), 12.34)
  })
  test('deeply converts nested Decimals in objects and arrays', () => {
    const payload = {
      code: 'INV-1',
      total: D('115.00'),
      lines: [
        { qty: D('2'), price: D('50.00') },
        { qty: D('1'), price: D('15.00') },
      ],
      meta: { balance: D('-3.50'), note: 'x' },
      when: new Date('2026-01-01T00:00:00.000Z'),
    }
    const out = decimalsToNumbers(payload) as any
    assert.equal(out.total, 115)
    assert.equal(out.lines[0].price, 50)
    assert.equal(out.lines[1].qty, 1)
    assert.equal(out.meta.balance, -3.5)
    assert.equal(out.code, 'INV-1')          // strings untouched
    assert.equal(out.meta.note, 'x')
    assert.ok(out.when instanceof Date)        // Dates preserved, not walked
    // and the result must JSON-serialize as numbers, not strings
    const json = JSON.parse(JSON.stringify(out))
    assert.strictEqual(json.total, 115)
    assert.strictEqual(typeof json.lines[0].price, 'number')
  })
  test('handles null and primitives safely', () => {
    assert.equal(decimalsToNumbers(null), null)
    assert.equal(decimalsToNumbers(5), 5)
    assert.equal(decimalsToNumbers('str'), 'str')
  })
})
