// Chart of Accounts — unit + integration-logic tests.
// Run: npm run test:coa
//
// These tests exercise the *rules*, not the database: hierarchy validation,
// cycle detection, balance rollup, contra-account signs, and every posting
// template's double-entry correctness. They are the regression net for the
// accounting bugs fixed during the re-engineering.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCOUNT_CLASSES,
  ACCOUNT_CLASS_CODES,
  classFromLegacyType,
  defaultNormalBalance,
  isValidSubtype,
  ledgerTypeForClass,
  signedBalance,
  type AccountClass,
} from '@/lib/erp/account-classes'

import {
  buildAccountTree,
  buildPath,
  flattenTree,
  levelFromPath,
  validateAccountInput,
  wouldCreateCycle,
  type AccountNodeLike,
} from '@/lib/erp/account-service'

import {
  ACCOUNT_ROLES,
  isValidRole,
  requiredRoles,
  roleAcceptsClass,
} from '@/lib/erp/account-roles'

import {
  validateBalanced,
  salesInvoicePosting,
  salesCashPosting,
  salesReturnPosting,
  purchaseInvoicePosting,
  purchaseReturnPosting,
  purchaseCashPosting,
  receiptPosting,
  paymentPosting,
  goodsReceiptPosting,
  cogsPosting,
  productionConsumptionPosting,
  productionFGReceiptPosting,
  payrollPosting,
  depreciationPosting,
  inventoryAdjustmentPosting,
  type JournalLineInput,
} from '@/lib/erp/accounting-engine'

import { LEGACY_ROLE_CODE_FALLBACK } from '@/lib/erp/account-determination'
import { COA_ACTIONS, DEFAULT_ROLE_MATRIX, matrixAllows } from '@/lib/erp/coa-policy'

// ---------------------------------------------------------------------------
const acc = (over: Partial<AccountNodeLike> & { id: string; code: string }): AccountNodeLike => ({
  nameAr: over.code,
  parentId: null,
  isPosting: true,
  accountClass: 'asset',
  normalBalance: 'debit',
  active: true,
  ...over,
})

// ===========================================================================
describe('account classes', () => {
  test('all 8 required classes exist', () => {
    for (const c of ['asset', 'liability', 'equity', 'revenue', 'cogs', 'operating_expense', 'other_income', 'other_expense']) {
      assert.ok(ACCOUNT_CLASS_CODES.includes(c as AccountClass), `missing class ${c}`)
    }
    assert.equal(ACCOUNT_CLASS_CODES.length, 8)
  })

  test('each class derives a valid legacy ledger type', () => {
    const valid = ['asset', 'liability', 'equity', 'income', 'expense']
    for (const c of ACCOUNT_CLASS_CODES) {
      assert.ok(valid.includes(ledgerTypeForClass(c)), `${c} -> ${ledgerTypeForClass(c)}`)
    }
    // classes that must collapse onto the same ledger primitive
    assert.equal(ledgerTypeForClass('revenue'), 'income')
    assert.equal(ledgerTypeForClass('other_income'), 'income')
    assert.equal(ledgerTypeForClass('cogs'), 'expense')
    assert.equal(ledgerTypeForClass('operating_expense'), 'expense')
    assert.equal(ledgerTypeForClass('other_expense'), 'expense')
  })

  test('normal balance defaults follow accounting convention', () => {
    assert.equal(defaultNormalBalance('asset'), 'debit')
    assert.equal(defaultNormalBalance('cogs'), 'debit')
    assert.equal(defaultNormalBalance('operating_expense'), 'debit')
    assert.equal(defaultNormalBalance('other_expense'), 'debit')
    assert.equal(defaultNormalBalance('liability'), 'credit')
    assert.equal(defaultNormalBalance('equity'), 'credit')
    assert.equal(defaultNormalBalance('revenue'), 'credit')
    assert.equal(defaultNormalBalance('other_income'), 'credit')
  })

  test('signedBalance respects normal balance (contra accounts included)', () => {
    // debit-normal asset: debits increase
    assert.equal(signedBalance('debit', 1000, 250), 750)
    // credit-normal liability: credits increase
    assert.equal(signedBalance('credit', 250, 1000), 750)
    // contra-asset (accumulated depreciation, credit-normal) shows a positive magnitude
    assert.equal(signedBalance('credit', 0, 5000), 5000)
    // contra-revenue (sales returns, debit-normal) shows a positive magnitude
    assert.equal(signedBalance('debit', 300, 0), 300)
  })

  test('legacy type mapping preserves the ledger primitive', () => {
    assert.equal(classFromLegacyType('asset'), 'asset')
    assert.equal(classFromLegacyType('liability'), 'liability')
    assert.equal(classFromLegacyType('equity'), 'equity')
    assert.equal(classFromLegacyType('income'), 'revenue')
    assert.equal(classFromLegacyType('income', 'other_revenue'), 'other_income')
    assert.equal(classFromLegacyType('expense', 'cogs'), 'cogs')
    assert.equal(classFromLegacyType('expense', 'purchases'), 'cogs')
    assert.equal(classFromLegacyType('expense', 'operating_expense'), 'operating_expense')
    assert.equal(classFromLegacyType('expense', 'fx_loss'), 'other_expense')
    // every mapping must round-trip to the same ledger type
    for (const [type, subtype] of [['income', 'other_revenue'], ['expense', 'cogs'], ['expense', 'fx_loss']] as const) {
      assert.equal(ledgerTypeForClass(classFromLegacyType(type, subtype)), type)
    }
  })

  test('subtypes are validated per class', () => {
    assert.ok(isValidSubtype('asset', 'contra_asset'))
    assert.ok(isValidSubtype('revenue', 'contra_revenue'))
    assert.ok(!isValidSubtype('asset', 'operating_revenue'))
    assert.ok(!isValidSubtype('equity', 'inventory'))
  })

  test('code prefixes are unique per class', () => {
    const prefixes = ACCOUNT_CLASS_CODES.map((c) => ACCOUNT_CLASSES[c].codePrefix)
    assert.equal(new Set(prefixes).size, prefixes.length)
  })
})

// ===========================================================================
describe('account validation rules', () => {
  test('requires code, arabic name and class on create', () => {
    const errors = validateAccountInput({}, { isCreate: true })
    const fields = errors.map((e) => e.field)
    assert.ok(fields.includes('code'))
    assert.ok(fields.includes('nameAr'))
    assert.ok(fields.includes('accountClass'))
  })

  test('rejects malformed codes', () => {
    const errors = validateAccountInput({ code: 'ab cd/!', nameAr: 'x', accountClass: 'asset' }, { isCreate: true })
    assert.ok(errors.some((e) => e.field === 'code' && e.code === 'INVALID_FORMAT'))
  })

  test('accepts a clean payload', () => {
    const errors = validateAccountInput(
      { code: '1101', nameAr: 'صندوق فرعي', accountClass: 'asset', subtype: 'cash_and_equivalents', isPosting: true },
      { isCreate: true }
    )
    assert.deepEqual(errors, [])
  })

  test('rejects a subtype that does not belong to the class', () => {
    const errors = validateAccountInput(
      { code: '1101', nameAr: 'x', accountClass: 'asset', subtype: 'operating_revenue' },
      { isCreate: true }
    )
    assert.ok(errors.some((e) => e.field === 'subtype' && e.code === 'INVALID_COMBINATION'))
  })

  test('parent must be a GROUP account', () => {
    const parent = acc({ id: 'p', code: '1100', isPosting: true })
    const errors = validateAccountInput(
      { code: '1101', nameAr: 'x', accountClass: 'asset', parentId: 'p' },
      { isCreate: true, parent }
    )
    assert.ok(errors.some((e) => e.code === 'PARENT_NOT_GROUP'))
  })

  test('parent must not be inactive', () => {
    const parent = acc({ id: 'p', code: '11', isPosting: false, active: false })
    const errors = validateAccountInput(
      { code: '1101', nameAr: 'x', accountClass: 'asset', parentId: 'p' },
      { isCreate: true, parent }
    )
    assert.ok(errors.some((e) => e.code === 'PARENT_INACTIVE'))
  })

  test('child class must match parent class', () => {
    const parent = acc({ id: 'p', code: '21', isPosting: false, accountClass: 'liability', normalBalance: 'credit' })
    const errors = validateAccountInput(
      { code: '2101', nameAr: 'x', accountClass: 'asset', parentId: 'p' },
      { isCreate: true, parent }
    )
    assert.ok(errors.some((e) => e.code === 'CLASS_MISMATCH_PARENT'))
  })

  test('missing parent is reported', () => {
    const errors = validateAccountInput(
      { code: '1101', nameAr: 'x', accountClass: 'asset', parentId: 'ghost' },
      { isCreate: true, parent: null }
    )
    assert.ok(errors.some((e) => e.field === 'parentId' && e.code === 'NOT_FOUND'))
  })

  test('system accounts: code and class are immutable', () => {
    const existing = { ...acc({ id: 'a', code: '1000', isSystem: true }), hasPostings: true, childCount: 0 }
    const errors = validateAccountInput({ code: '9999', accountClass: 'liability' }, { isCreate: false, existing })
    assert.ok(errors.some((e) => e.field === 'code' && e.code === 'IMMUTABLE_SYSTEM'))
    assert.ok(errors.some((e) => e.field === 'accountClass' && e.code === 'IMMUTABLE_SYSTEM'))
  })

  test('class cannot change once the account carries postings', () => {
    const existing = { ...acc({ id: 'a', code: '5100' }), accountClass: 'cogs', hasPostings: true, childCount: 0 }
    const errors = validateAccountInput({ accountClass: 'operating_expense' }, { isCreate: false, existing })
    assert.ok(errors.some((e) => e.field === 'accountClass' && e.code === 'HAS_POSTINGS'))
  })

  test('group -> posting blocked when children exist', () => {
    const existing = { ...acc({ id: 'g', code: '11', isPosting: false }), hasPostings: false, childCount: 3 }
    const errors = validateAccountInput({ isPosting: true }, { isCreate: false, existing })
    assert.ok(errors.some((e) => e.field === 'isPosting' && e.code === 'HAS_CHILDREN'))
  })

  test('posting -> group blocked when postings exist', () => {
    const existing = { ...acc({ id: 'a', code: '1000', isPosting: true }), hasPostings: true, childCount: 0 }
    const errors = validateAccountInput({ isPosting: false }, { isCreate: false, existing })
    assert.ok(errors.some((e) => e.field === 'isPosting' && e.code === 'HAS_POSTINGS'))
  })

  test('roles cannot be assigned to group accounts', () => {
    const errors = validateAccountInput(
      { code: '11', nameAr: 'x', accountClass: 'asset', isPosting: false, role: 'CASH' },
      { isCreate: true }
    )
    assert.ok(errors.some((e) => e.field === 'role' && e.code === 'ROLE_ON_GROUP'))
  })

  test('role must accept the account class', () => {
    const errors = validateAccountInput(
      { code: '4001', nameAr: 'x', accountClass: 'revenue', isPosting: true, role: 'CASH' },
      { isCreate: true }
    )
    assert.ok(errors.some((e) => e.field === 'role' && e.code === 'ROLE_CLASS_MISMATCH'))
  })

  test('unknown role is rejected', () => {
    const errors = validateAccountInput(
      { code: '4001', nameAr: 'x', accountClass: 'revenue', isPosting: true, role: 'NOT_A_ROLE' },
      { isCreate: true }
    )
    assert.ok(errors.some((e) => e.field === 'role' && e.code === 'UNKNOWN_ROLE'))
  })

  test('invalid enum values are rejected', () => {
    const errors = validateAccountInput(
      { code: '1', nameAr: 'x', accountClass: 'asset', normalBalance: 'sideways', taxBehavior: 'weird', fsSection: 'nowhere' },
      { isCreate: true }
    )
    assert.ok(errors.some((e) => e.field === 'normalBalance'))
    assert.ok(errors.some((e) => e.field === 'taxBehavior'))
    assert.ok(errors.some((e) => e.field === 'fsSection'))
  })
})

// ===========================================================================
describe('hierarchy: cycle detection', () => {
  const parentOf = new Map<string, string | null>([
    ['root', null],
    ['a', 'root'],
    ['b', 'a'],
    ['c', 'b'],
  ])

  test('no cycle for a fresh parent', () => {
    assert.equal(wouldCreateCycle('c', 'root', parentOf), false)
  })
  test('null parent is always safe', () => {
    assert.equal(wouldCreateCycle('c', null, parentOf), false)
  })
  test('self-parent is a cycle', () => {
    assert.equal(wouldCreateCycle('a', 'a', parentOf), true)
  })
  test('moving a node under its own descendant is a cycle', () => {
    assert.equal(wouldCreateCycle('a', 'c', parentOf), true)
    assert.equal(wouldCreateCycle('root', 'b', parentOf), true)
  })
  test('pre-existing corruption is refused rather than looped', () => {
    const corrupt = new Map<string, string | null>([['x', 'y'], ['y', 'x']])
    assert.equal(wouldCreateCycle('z', 'x', corrupt), true)
  })
})

describe('hierarchy: materialized path', () => {
  test('buildPath composes and levelFromPath counts depth', () => {
    const root = buildPath(null, 'r')
    assert.equal(root, '/r')
    assert.equal(levelFromPath(root), 0)
    const child = buildPath(root, 'c')
    assert.equal(child, '/r/c')
    assert.equal(levelFromPath(child), 1)
    assert.equal(levelFromPath(buildPath(child, 'g')), 2)
  })
})

// ===========================================================================
describe('tree building and balance rollup', () => {
  //  1 (group, asset)
  //  └── 11 (group)
  //      ├── 1000 posting  debit 1000
  //      └── 1100 posting  debit 500 credit 200
  const accounts: AccountNodeLike[] = [
    acc({ id: 'c1', code: '1', isPosting: false }),
    acc({ id: 'g11', code: '11', parentId: 'c1', isPosting: false }),
    acc({ id: 'a1000', code: '1000', parentId: 'g11' }),
    acc({ id: 'a1100', code: '1100', parentId: 'g11' }),
  ]
  const balances = new Map([
    ['a1000', { debit: 1000, credit: 0 }],
    ['a1100', { debit: 500, credit: 200 }],
  ])

  test('builds a single root with nested children', () => {
    const roots = buildAccountTree(accounts, balances)
    assert.equal(roots.length, 1)
    assert.equal(roots[0].account.code, '1')
    assert.equal(roots[0].children.length, 1)
    assert.equal(roots[0].children[0].children.length, 2)
  })

  test('group accounts aggregate their whole subtree', () => {
    const roots = buildAccountTree(accounts, balances)
    const root = roots[0]
    // own balance of a group is zero (nothing posts to it)
    assert.equal(root.ownBalance, 0)
    // 1000 + (500-200) = 1300
    assert.equal(root.aggregateBalance, 1300)
    assert.equal(root.aggregateDebit, 1500)
    assert.equal(root.aggregateCredit, 200)
    assert.equal(root.descendantCount, 3)
  })

  test('levels are assigned by depth', () => {
    const roots = buildAccountTree(accounts, balances)
    const flat = flattenTree(roots)
    assert.deepEqual(flat.map((n) => [n.account.code, n.level]), [['1', 0], ['11', 1], ['1000', 2], ['1100', 2]])
  })

  test('credit-normal children roll up with the correct sign', () => {
    const liab: AccountNodeLike[] = [
      acc({ id: 'c2', code: '2', isPosting: false, accountClass: 'liability', normalBalance: 'credit' }),
      acc({ id: 'a2000', code: '2000', parentId: 'c2', accountClass: 'liability', normalBalance: 'credit' }),
    ]
    const roots = buildAccountTree(liab, new Map([['a2000', { debit: 100, credit: 900 }]]))
    assert.equal(roots[0].aggregateBalance, 800)
  })

  test('a contra child reduces nothing but presents positively', () => {
    // Accumulated depreciation (credit-normal) inside the asset class:
    // the group aggregate is a plain sum of signed balances, which is why a
    // contra account must live in its own reporting group.
    const tree: AccountNodeLike[] = [
      acc({ id: 'g15', code: '15', isPosting: false }),
      acc({ id: 'a1500', code: '1500', parentId: 'g15' }),
      acc({ id: 'a1590', code: '1590', parentId: 'g15', normalBalance: 'credit' }),
    ]
    const roots = buildAccountTree(tree, new Map([
      ['a1500', { debit: 10000, credit: 0 }],
      ['a1590', { debit: 0, credit: 2500 }],
    ]))
    const [fixed, accum] = roots[0].children
    assert.equal(fixed.ownBalance, 10000)
    assert.equal(accum.ownBalance, 2500) // positive magnitude, not -2500
  })

  test('siblings sort numerically, not lexicographically', () => {
    const many: AccountNodeLike[] = [
      acc({ id: 'g', code: '1', isPosting: false }),
      acc({ id: 'a2', code: '2', parentId: 'g' }),
      acc({ id: 'a10', code: '10', parentId: 'g' }),
      acc({ id: 'a1', code: '1000', parentId: 'g' }),
    ]
    const roots = buildAccountTree(many, new Map())
    assert.deepEqual(roots[0].children.map((c) => c.account.code), ['2', '10', '1000'])
  })

  test('orphans surface as roots instead of disappearing', () => {
    const orphaned: AccountNodeLike[] = [acc({ id: 'x', code: '9999', parentId: 'missing-parent' })]
    const roots = buildAccountTree(orphaned, new Map())
    assert.equal(roots.length, 1)
    assert.equal(roots[0].account.code, '9999')
  })

  test('cyclic data does not hang the tree builder', () => {
    const cyclic: AccountNodeLike[] = [
      acc({ id: 'p', code: '1', parentId: 'q', isPosting: false }),
      acc({ id: 'q', code: '2', parentId: 'p', isPosting: false }),
    ]
    const roots = buildAccountTree(cyclic, new Map())
    // both have a parent inside the set, so no root is produced — and crucially
    // the call returns instead of recursing forever.
    assert.ok(Array.isArray(roots))
  })

  test('empty input yields an empty forest', () => {
    assert.deepEqual(buildAccountTree([], new Map()), [])
  })
})

// ===========================================================================
describe('account role catalog', () => {
  test('every role required by the brief exists', () => {
    const required = [
      'CUSTOMER_RECEIVABLE', 'SUPPLIER_PAYABLE', 'SALES', 'SALES_RETURN', 'PURCHASE', 'COGS',
      'INVENTORY', 'TAX_RECEIVABLE', 'TAX_PAYABLE', 'CASH', 'BANK', 'RETAINED_EARNINGS',
      'CURRENT_YEAR_EARNINGS', 'ROUNDING', 'SUSPENSE', 'FX_GAIN', 'FX_LOSS', 'OPENING_BALANCE',
      'PAYROLL', 'ASSET', 'DEPRECIATION', 'ACCUMULATED_DEPRECIATION',
    ]
    for (const r of required) assert.ok(isValidRole(r), `role ${r} missing from catalog`)
  })

  test('role codes are unique', () => {
    const codes = ACCOUNT_ROLES.map((r) => r.code)
    assert.equal(new Set(codes).size, codes.length)
  })

  test('every role declares at least one allowed class, all valid', () => {
    for (const r of ACCOUNT_ROLES) {
      assert.ok(r.allowedClasses.length > 0, `${r.code} has no allowed classes`)
      for (const c of r.allowedClasses) {
        assert.ok(ACCOUNT_CLASS_CODES.includes(c as AccountClass), `${r.code} references unknown class ${c}`)
      }
    }
  })

  test('class guard accepts valid and rejects invalid pairings', () => {
    assert.ok(roleAcceptsClass('CASH', 'asset'))
    assert.ok(roleAcceptsClass('TAX_PAYABLE', 'liability'))
    assert.ok(roleAcceptsClass('COGS', 'cogs'))
    assert.ok(!roleAcceptsClass('CASH', 'revenue'))
    assert.ok(!roleAcceptsClass('SUPPLIER_PAYABLE', 'asset'))
    assert.ok(!roleAcceptsClass('UNKNOWN', 'asset'))
  })

  test('the engine-critical roles are flagged required', () => {
    const req = requiredRoles()
    for (const r of ['CUSTOMER_RECEIVABLE', 'SUPPLIER_PAYABLE', 'SALES', 'COGS', 'INVENTORY', 'CASH', 'TAX_PAYABLE', 'TAX_RECEIVABLE']) {
      assert.ok(req.includes(r as never), `${r} should be required`)
    }
  })

  test('legacy fallback map only references known roles', () => {
    for (const role of Object.keys(LEGACY_ROLE_CODE_FALLBACK)) {
      assert.ok(isValidRole(role), `fallback references unknown role ${role}`)
    }
  })
})

// ===========================================================================
// The heart of it: every posting template must be a valid double entry, and
// must address accounts by ROLE (never by hardcoded code).
// ===========================================================================
describe('posting templates', () => {
  const partnerId = 'partner-1'

  const templates: Record<string, JournalLineInput[]> = {
    salesInvoice: salesInvoicePosting({ subtotal: 1000, taxTotal: 150, total: 1150, partnerId }),
    salesInvoiceWithDiscount: salesInvoicePosting({ subtotal: 1000, taxTotal: 150, total: 1050, partnerId, discount: 100 }),
    salesInvoiceZeroTax: salesInvoicePosting({ subtotal: 1000, taxTotal: 0, total: 1000, partnerId }),
    salesCash: salesCashPosting({ subtotal: 500, taxTotal: 75, total: 575 }),
    salesCashWithDiscount: salesCashPosting({ subtotal: 500, taxTotal: 75, total: 525, discount: 50 }),
    salesReturn: salesReturnPosting({ subtotal: 200, taxTotal: 30, total: 230, partnerId }),
    purchaseInvoice: purchaseInvoicePosting({ subtotal: 800, taxTotal: 120, total: 920, partnerId }),
    purchaseReturn: purchaseReturnPosting({ subtotal: 100, taxTotal: 15, total: 115, partnerId }),
    purchaseCash: purchaseCashPosting({ subtotal: 300, taxTotal: 45, total: 345 }),
    receipt: receiptPosting({ amount: 400, partnerId }),
    payment: paymentPosting({ amount: 250, partnerId }),
    goodsReceipt: goodsReceiptPosting({ amount: 700 }),
    cogs: cogsPosting({ amount: 650 }),
    productionConsumption: productionConsumptionPosting({ amount: 320 }),
    productionFGReceipt: productionFGReceiptPosting({ outputCost: 480 }),
    payroll: payrollPosting({ gross: 10000, deductions: 1500, net: 8500 }),
    payrollNoDeductions: payrollPosting({ gross: 5000, deductions: 0, net: 5000 }),
    depreciation: depreciationPosting({ amount: 900 }),
    inventorySurplus: inventoryAdjustmentPosting({ varianceAmount: 250 }),
    inventoryShortage: inventoryAdjustmentPosting({ varianceAmount: -175 }),
  }

  test('EVERY template produces a balanced entry', () => {
    for (const [name, lines] of Object.entries(templates)) {
      const debit = lines.reduce((s, l) => s + l.debit, 0)
      const credit = lines.reduce((s, l) => s + l.credit, 0)
      assert.ok(
        validateBalanced(lines),
        `${name} is unbalanced: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)}`
      )
    }
  })

  test('EVERY template has at least two lines', () => {
    for (const [name, lines] of Object.entries(templates)) {
      assert.ok(lines.length >= 2, `${name} has only ${lines.length} line(s)`)
    }
  })

  test('no line is both debit and credit, and none is negative', () => {
    for (const [name, lines] of Object.entries(templates)) {
      for (const [i, l] of lines.entries()) {
        assert.ok(!(l.debit > 0 && l.credit > 0), `${name} line ${i + 1} is on both sides`)
        assert.ok(l.debit >= 0 && l.credit >= 0, `${name} line ${i + 1} is negative`)
      }
    }
  })

  test('templates never hardcode an account code — they use roles', () => {
    for (const [name, lines] of Object.entries(templates)) {
      for (const [i, l] of lines.entries()) {
        assert.ok(l.role, `${name} line ${i + 1} does not use a role (found accountCode=${l.accountCode})`)
        assert.equal(l.accountCode, undefined, `${name} line ${i + 1} hardcodes an account code`)
        assert.ok(isValidRole(l.role as string), `${name} line ${i + 1} uses unknown role ${l.role}`)
      }
    }
  })

  // ---- REGRESSION: header discount used to unbalance the sales invoice ----
  test('REGRESSION: sales invoice with a header discount balances', () => {
    const subtotal = 1000
    const taxTotal = 150
    const discount = 100
    const total = subtotal + taxTotal - discount // what the route computes
    const lines = salesInvoicePosting({ subtotal, taxTotal, total, partnerId, discount })

    assert.ok(validateBalanced(lines), 'discounted invoice must balance')
    // AR is debited with the NET amount the customer owes
    const ar = lines.find((l) => l.role === 'CUSTOMER_RECEIVABLE')
    assert.equal(ar?.debit, 1050)
    // the discount is a contra-revenue DEBIT, which is what makes it balance
    const disc = lines.find((l) => l.role === 'SALES_DISCOUNT')
    assert.equal(disc?.debit, 100)
    // revenue is still credited GROSS
    assert.equal(lines.find((l) => l.role === 'SALES')?.credit, 1000)
    assert.equal(lines.find((l) => l.role === 'TAX_PAYABLE')?.credit, 150)
  })

  test('no discount line is emitted when the discount is zero', () => {
    const lines = salesInvoicePosting({ subtotal: 100, taxTotal: 15, total: 115, partnerId, discount: 0 })
    assert.equal(lines.find((l) => l.role === 'SALES_DISCOUNT'), undefined)
  })

  // ---- REGRESSION: payroll deductions were credited to an EXPENSE ----
  test('REGRESSION: payroll deductions are credited to a LIABILITY role', () => {
    const lines = payrollPosting({ gross: 10000, deductions: 1500, net: 8500 })
    assert.ok(validateBalanced(lines))

    assert.equal(lines.find((l) => l.role === 'PAYROLL')?.debit, 10000)
    assert.equal(lines.find((l) => l.role === 'SALARIES_PAYABLE')?.credit, 8500)

    const deduction = lines.find((l) => l.role === 'PAYROLL_DEDUCTIONS_PAYABLE')
    assert.ok(deduction, 'deductions must post to PAYROLL_DEDUCTIONS_PAYABLE')
    assert.equal(deduction.credit, 1500)

    // and the deduction role must be a liability-class role
    const def = ACCOUNT_ROLES.find((r) => r.code === 'PAYROLL_DEDUCTIONS_PAYABLE')!
    assert.deepEqual([...def.allowedClasses], ['liability'])
  })

  test('payroll with no deductions omits the deductions line', () => {
    const lines = payrollPosting({ gross: 5000, deductions: 0, net: 5000 })
    assert.equal(lines.length, 2)
    assert.ok(validateBalanced(lines))
  })

  test('sales return debits contra-revenue and credits the customer', () => {
    const lines = salesReturnPosting({ subtotal: 200, taxTotal: 30, total: 230, partnerId })
    assert.equal(lines.find((l) => l.role === 'SALES_RETURN')?.debit, 200)
    assert.equal(lines.find((l) => l.role === 'TAX_PAYABLE')?.debit, 30)
    assert.equal(lines.find((l) => l.role === 'CUSTOMER_RECEIVABLE')?.credit, 230)
  })

  test('purchase invoice: inventory/purchases + input tax vs payable', () => {
    const lines = purchaseInvoicePosting({ subtotal: 800, taxTotal: 120, total: 920, partnerId })
    assert.equal(lines.find((l) => l.role === 'PURCHASE')?.debit, 800)
    assert.equal(lines.find((l) => l.role === 'TAX_RECEIVABLE')?.debit, 120)
    assert.equal(lines.find((l) => l.role === 'SUPPLIER_PAYABLE')?.credit, 920)
  })

  test('purchase return reverses the payable', () => {
    const lines = purchaseReturnPosting({ subtotal: 100, taxTotal: 15, total: 115, partnerId })
    assert.equal(lines.find((l) => l.role === 'SUPPLIER_PAYABLE')?.debit, 115)
    assert.equal(lines.find((l) => l.role === 'PURCHASE_RETURN')?.credit, 100)
    assert.equal(lines.find((l) => l.role === 'TAX_RECEIVABLE')?.credit, 15)
  })

  test('perpetual inventory: COGS debited, inventory credited', () => {
    const lines = cogsPosting({ amount: 650 })
    assert.equal(lines.find((l) => l.role === 'COGS')?.debit, 650)
    assert.equal(lines.find((l) => l.role === 'INVENTORY')?.credit, 650)
  })

  test('inventory adjustment routes surplus and shortage to different roles', () => {
    const surplus = inventoryAdjustmentPosting({ varianceAmount: 250 })
    assert.equal(surplus.find((l) => l.role === 'INVENTORY')?.debit, 250)
    assert.equal(surplus.find((l) => l.role === 'INVENTORY_GAIN')?.credit, 250)

    const shortage = inventoryAdjustmentPosting({ varianceAmount: -175 })
    assert.equal(shortage.find((l) => l.role === 'INVENTORY_LOSS')?.debit, 175)
    assert.equal(shortage.find((l) => l.role === 'INVENTORY')?.credit, 175)
  })

  test('depreciation credits the contra-asset role', () => {
    const lines = depreciationPosting({ amount: 900 })
    assert.equal(lines.find((l) => l.role === 'DEPRECIATION')?.debit, 900)
    assert.equal(lines.find((l) => l.role === 'ACCUMULATED_DEPRECIATION')?.credit, 900)
  })

  test('amounts are rounded to 2 decimals so cents never drift', () => {
    const lines = salesInvoicePosting({ subtotal: 33.333, taxTotal: 5.0, total: 38.333, partnerId })
    for (const l of lines) {
      const v = l.debit || l.credit
      assert.equal(Math.round(v * 100) / 100, v, `unrounded amount ${v}`)
    }
    assert.ok(validateBalanced(lines))
  })
})

// ===========================================================================
describe('balance validation tolerance', () => {
  test('accepts sub-cent floating point noise', () => {
    assert.ok(validateBalanced([{ debit: 0.1 + 0.2, credit: 0 }, { debit: 0, credit: 0.3 }]))
  })
  test('rejects a one-cent difference', () => {
    assert.equal(validateBalanced([{ debit: 100.01, credit: 0 }, { debit: 0, credit: 100 }]), false)
  })
  test('rejects a wildly unbalanced entry', () => {
    assert.equal(validateBalanced([{ debit: 500, credit: 0 }, { debit: 0, credit: 100 }]), false)
  })
})

// ===========================================================================
describe('RBAC default policy', () => {
  test('the three CoA permission actions are defined', () => {
    assert.equal(COA_ACTIONS.ACCOUNTS, 'COA')
    assert.equal(COA_ACTIONS.LEDGER, 'COA_LEDGER')
    assert.equal(COA_ACTIONS.CONFIG, 'COA_CONFIG')
  })

  test('admin and finance manager get full access', () => {
    for (const role of ['ADMIN', 'FIN_MGR']) {
      assert.equal(DEFAULT_ROLE_MATRIX[role].COA, '*')
      assert.equal(DEFAULT_ROLE_MATRIX[role].COA_CONFIG, '*')
    }
  })

  test('viewer is read-only and cannot configure determination', () => {
    assert.deepEqual(DEFAULT_ROLE_MATRIX.VIEWER.COA, ['canRead'])
    assert.deepEqual(DEFAULT_ROLE_MATRIX.VIEWER.COA_CONFIG, [])
  })

  test('auditor can read and export but never write', () => {
    const coa = DEFAULT_ROLE_MATRIX.AUDITOR.COA as string[]
    assert.ok(coa.includes('canRead'))
    assert.ok(coa.includes('canExport'))
    assert.ok(!coa.includes('canCreate'))
    assert.ok(!coa.includes('canUpdate'))
    assert.ok(!coa.includes('canDelete'))
  })

  test('matrixAllows enforces the policy', () => {
    assert.ok(matrixAllows('ADMIN', 'COA', 'canDelete'))
    assert.ok(matrixAllows('ACCOUNTANT', 'COA', 'canCreate'))
    assert.ok(!matrixAllows('ACCOUNTANT', 'COA', 'canDelete'))
    assert.ok(!matrixAllows('VIEWER', 'COA', 'canUpdate'))
    assert.ok(!matrixAllows('AUDITOR', 'COA_CONFIG', 'canUpdate'))
  })

  test('an unknown role falls back to read-only', () => {
    assert.ok(matrixAllows('SOME_NEW_ROLE', 'COA', 'canRead'))
    assert.ok(!matrixAllows('SOME_NEW_ROLE', 'COA', 'canCreate'))
    assert.ok(!matrixAllows('SOME_NEW_ROLE', 'COA_CONFIG', 'canRead'))
  })

  test('accountant can create/update but not manage determination', () => {
    const coa = DEFAULT_ROLE_MATRIX.ACCOUNTANT.COA as string[]
    assert.ok(coa.includes('canCreate'))
    assert.ok(coa.includes('canUpdate'))
    assert.ok(!coa.includes('canDelete'))
    assert.deepEqual(DEFAULT_ROLE_MATRIX.ACCOUNTANT.COA_CONFIG, ['canRead'])
  })
})

// ===========================================================================
// Cross-checks between the migration's target chart and the code's catalogs.
// These catch the classic drift bug: a role exists in code but the migration
// never maps it to an account, so the first posting that needs it fails.
// ===========================================================================
describe('migration target chart consistency', () => {
  test('every required role is mapped by the migration', async () => {
    const { ROLE_MAP } = await import('../scripts/migrate-chart-of-accounts.mjs')
    for (const role of requiredRoles()) {
      assert.ok(ROLE_MAP[role], `required role ${role} is not mapped by the migration`)
    }
  })

  test('every role in the catalog is mapped by the migration', async () => {
    const { ROLE_MAP } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const unmapped = ACCOUNT_ROLES.map((r) => r.code).filter((c) => !ROLE_MAP[c])
    assert.deepEqual(unmapped, [], `unmapped roles: ${unmapped.join(', ')}`)
  })

  test('mapped roles point at codes the migration actually creates or reparents', async () => {
    const { ROLE_MAP, REPARENT, NEW_ACCOUNTS } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const known = new Set([...REPARENT.map((r) => r.code), ...NEW_ACCOUNTS.map((a) => a.code)])
    for (const [role, code] of Object.entries(ROLE_MAP)) {
      assert.ok(known.has(code), `role ${role} -> ${code}, which the migration never provisions`)
    }
  })

  test('each mapped account class satisfies its role class guard', async () => {
    const { ROLE_MAP, REPARENT, NEW_ACCOUNTS, CLASS_DEFAULTS } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const classOf = new Map<string, string>()
    for (const a of NEW_ACCOUNTS) classOf.set(a.code, a.accountClass)
    // REPARENT rows only carry accountClass when they reclassify; otherwise infer
    // from the code prefix via the class defaults table.
    const prefixToClass: Record<string, string> = {
      '1': 'asset', '2': 'liability', '3': 'equity', '4': 'revenue',
      '5': 'cogs', '6': 'operating_expense', '7': 'other_income', '8': 'other_expense',
    }
    for (const r of REPARENT) {
      classOf.set(r.code, r.accountClass ?? prefixToClass[r.code[0]])
    }
    for (const [role, code] of Object.entries(ROLE_MAP)) {
      const klass = classOf.get(code)
      assert.ok(klass, `no class known for ${code}`)
      assert.ok(CLASS_DEFAULTS[klass], `unknown class ${klass}`)
      assert.ok(roleAcceptsClass(role, klass), `role ${role} cannot accept class ${klass} (account ${code})`)
    }
  })

  test('group skeleton is internally consistent (parents exist, classes match)', async () => {
    const { GROUPS } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const byCode = new Map(GROUPS.map((g) => [g.code, g]))
    for (const g of GROUPS) {
      if (!g.parent) continue
      const parent = byCode.get(g.parent)
      assert.ok(parent, `group ${g.code} references missing parent ${g.parent}`)
      assert.equal(parent.accountClass, g.accountClass, `group ${g.code} class differs from parent ${g.parent}`)
    }
    // exactly one root per class
    const roots = GROUPS.filter((g) => !g.parent)
    assert.equal(roots.length, 8)
    assert.equal(new Set(roots.map((r) => r.accountClass)).size, 8)
  })

  test('reparent targets exist in the group skeleton', async () => {
    const { GROUPS, REPARENT, NEW_ACCOUNTS } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const groupCodes = new Set(GROUPS.map((g) => g.code))
    for (const r of [...REPARENT, ...NEW_ACCOUNTS]) {
      assert.ok(groupCodes.has(r.parent), `${r.code} points at non-existent group ${r.parent}`)
    }
  })

  test('no duplicate codes across the migration tables', async () => {
    const { GROUPS, REPARENT, NEW_ACCOUNTS } = await import('../scripts/migrate-chart-of-accounts.mjs')
    const all = [...GROUPS.map((g) => g.code), ...REPARENT.map((r) => r.code), ...NEW_ACCOUNTS.map((a) => a.code)]
    const dupes = all.filter((c, i) => all.indexOf(c) !== i)
    assert.deepEqual(dupes, [], `duplicate codes: ${dupes.join(', ')}`)
  })
})
