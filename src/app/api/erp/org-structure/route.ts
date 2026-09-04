import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface OrgItem {
  id: string
  code: string
  nameAr: string
  nameEn?: string | null
  parentId?: string | null
  parent?: { id: string; code: string; nameAr: string; nameEn?: string | null } | null
  type: string
  level: number
  path?: string | null
  sortOrder?: number
  companyId?: string | null
  branchId?: string | null
  costCenterId?: string | null
  managerId?: string | null
  costCenter?: { id: string; code: string; nameAr: string } | null
  manager?: { id: string; employeeNo: string; nameAr: string } | null
  branch?: { id: string; code: string; nameAr: string } | null
  notes?: string | null
  active?: boolean
  status?: string
  isSuspended?: boolean
  suspendedBy?: string | null
  suspendedAt?: Date | string | null
  suspensionReason?: string | null
  suspensionCount?: number
  modificationCount?: number
  printCount?: number
  createdBy?: string | null
  updatedBy?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
  _count?: {
    children: number
    employees: number
  }
}

// Initial seed data for auto-populating if DB table is empty
const INITIAL_SEED_DATA = [
  { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager', type: 'قطاع', level: 1, notes: 'أعلى مستوى إداري في المنشأة', parentId: null },
  { id: '2', code: '2', nameAr: 'إدارة المالية', nameEn: 'Finance Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة لقطاع المدير العام', parentId: '1' },
  { id: '3', code: '3', nameAr: 'إدارة التسويق', nameEn: 'Marketing Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة لقطاع المدير العام', parentId: '1' },
  { id: '4', code: '4', nameAr: 'إدارة المبيعات', nameEn: 'Sales Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة لقطاع المدير العام', parentId: '1' },
  { id: '5', code: '5', nameAr: 'المحاسبة', nameEn: 'Accounting', type: 'إدارة', level: 3, notes: 'قسم محاسبي تابع لإدارة المالية', parentId: '2' },
  { id: '6', code: '6', nameAr: 'التسويق الرقمي', nameEn: 'Digital Marketing', type: 'إدارة', level: 3, notes: 'قسم فرعي للتسويق الرقمي', parentId: '3' },
  { id: '7', code: '7', nameAr: 'الموارد البشرية', nameEn: 'Human Resources', type: 'إدارة عامة', level: 2, notes: 'شؤون الموظفين والتطوير', parentId: '1' },
  { id: '8', code: '8', nameAr: 'التوظيف والتدريب', nameEn: 'Recruitment & Training', type: 'إدارة', level: 3, notes: 'فرع التوظيف وتطوير الكفاءات', parentId: '7' },
  { id: '9', code: '9', nameAr: 'إدارة تقنية المعلومات', nameEn: 'IT Department', type: 'إدارة عامة', level: 2, notes: 'البنية التحتية والأنظمة', parentId: '1' },
  { id: '10', code: '10', nameAr: 'الدعم الفني', nameEn: 'Technical Support', type: 'إدارة', level: 3, notes: 'فريق الصيانة والدعم الفني', parentId: '9' },
]

// Helper to normalize foreign key values safely to prevent Prisma foreign key constraint errors
async function sanitizeForeignKey(
  val: any,
  checkExistFn?: (id: string) => Promise<boolean>
): Promise<string | null> {
  if (val === null || val === undefined) return null
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed || trimmed === 'none' || trimmed === 'null' || trimmed === 'undefined') {
    return null
  }
  if (checkExistFn) {
    try {
      const exists = await checkExistFn(trimmed)
      if (!exists) return null
    } catch {
      return null
    }
  }
  return trimmed
}

// Helper function to format Prisma record to JSON output with computed properties
function formatOrgItem(item: any): OrgItem {
  if (!item) return item
  return {
    ...item,
    isSuspended: item.status === 'suspended' || item.status === 'SUSPENDED' || !!item.suspendedBy,
  }
}

// Cycle detection helper: Returns true if placing targetId under candidateParentId creates a loop
async function checkCircularDependency(targetId: string, candidateParentId: string): Promise<boolean> {
  if (targetId === candidateParentId) return true
  let currentId: string | null = candidateParentId
  const visited = new Set<string>([targetId])

  while (currentId) {
    if (visited.has(currentId)) return true
    visited.add(currentId)
    const parentNode: { parentId: string | null } | null = await db.orgStructure.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    })
    currentId = parentNode?.parentId || null
  }
  return false
}

// Recursively update path and level for all descendant units
async function updateDescendantsPathAndLevel(parentId: string, parentPath: string, parentLevel: number) {
  const children = await db.orgStructure.findMany({
    where: { parentId },
    select: { id: true },
  })

  for (const child of children) {
    const childPath = `${parentPath}/${child.id}`
    const childLevel = parentLevel + 1
    await db.orgStructure.update({
      where: { id: child.id },
      data: {
        path: childPath,
        level: childLevel,
      },
    })
    await updateDescendantsPathAndLevel(child.id, childPath, childLevel)
  }
}

// Write Audit Log helper
async function createAuditEntry(data: {
  action: string
  documentId?: string
  oldValue?: any
  newValue?: any
  reason?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        moduleCode: 'ORG',
        documentType: 'OrgStructure',
        documentId: data.documentId || null,
        action: data.action,
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        reason: data.reason || null,
      },
    })
  } catch (err) {
    console.warn('[OrgStructure AuditLog] Log creation skipped:', err)
  }
}

// GET: Retrieve all Organizational Units
export async function GET(req: NextRequest) {
  try {
    let items = await db.orgStructure.findMany({
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      include: {
        parent: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        costCenter: {
          select: { id: true, code: true, nameAr: true },
        },
        manager: {
          select: { id: true, employeeNo: true, nameAr: true },
        },
        branch: {
          select: { id: true, code: true, nameAr: true },
        },
        _count: {
          select: {
            children: true,
            employees: true,
          },
        },
      },
    })

    // Auto-seed if database table is completely empty
    if (!items || items.length === 0) {
      const createdMap = new Map<string, string>()

      for (const seed of INITIAL_SEED_DATA) {
        const parentId = seed.parentId ? createdMap.get(seed.parentId) || null : null
        const created = await db.orgStructure.create({
          data: {
            code: seed.code,
            nameAr: seed.nameAr,
            nameEn: seed.nameEn,
            type: seed.type,
            level: seed.level,
            notes: seed.notes,
            parentId: parentId,
            status: 'active',
            active: true,
          },
        })
        createdMap.set(seed.id, created.id)
        const path = parentId ? `/${parentId}/${created.id}` : `/${created.id}`
        await db.orgStructure.update({
          where: { id: created.id },
          data: { path },
        })
      }

      items = await db.orgStructure.findMany({
        orderBy: [{ level: 'asc' }, { code: 'asc' }],
        include: {
          parent: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          costCenter: {
            select: { id: true, code: true, nameAr: true },
          },
          manager: {
            select: { id: true, employeeNo: true, nameAr: true },
          },
          branch: {
            select: { id: true, code: true, nameAr: true },
          },
          _count: {
            select: {
              children: true,
              employees: true,
            },
          },
        },
      })
    }

    const formattedItems = items.map(formatOrgItem)
    return NextResponse.json({ ok: true, data: formattedItems })
  } catch (err: any) {
    console.error('[OrgStructure GET Error]:', err)
    return NextResponse.json({ ok: false, message: err.message || 'فشل جلب بيانات الهيكل التنظيمي' }, { status: 500 })
  }
}

// POST: Create New Organizational Unit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, nameAr, nameEn, parentId, type, notes, companyId, branchId, costCenterId, managerId, status, isSuspended } = body

    if (!code?.trim() || !nameAr?.trim()) {
      return NextResponse.json({ ok: false, message: 'رقم الهيكل والاسم باللغة العربية حقول مطلوبة' }, { status: 400 })
    }

    // Check duplicate code
    const existingCode = await db.orgStructure.findUnique({
      where: { code: code.trim() },
    })
    if (existingCode) {
      return NextResponse.json({ ok: false, message: `رقم الهيكل «${code}» مستخدم بالفعل لنظير آخر` }, { status: 400 })
    }

    // Sanitize Foreign Keys safely
    const targetParentId = await sanitizeForeignKey(parentId, async (id) => {
      const p = await db.orgStructure.findUnique({ where: { id }, select: { id: true } })
      return !!p
    })

    const targetCostCenterId = await sanitizeForeignKey(costCenterId, async (id) => {
      const c = await db.costCenter.findUnique({ where: { id }, select: { id: true } })
      return !!c
    })

    const targetManagerId = await sanitizeForeignKey(managerId, async (id) => {
      const m = await db.employee.findUnique({ where: { id }, select: { id: true } })
      return !!m
    })

    const targetCompanyId = await sanitizeForeignKey(companyId, async (id) => {
      const comp = await db.company.findUnique({ where: { id }, select: { id: true } })
      return !!comp
    })

    const targetBranchId = await sanitizeForeignKey(branchId, async (id) => {
      const b = await db.branch.findUnique({ where: { id }, select: { id: true } })
      return !!b
    })

    let calculatedLevel = 1
    let parentPath = ''

    if (targetParentId) {
      const parentNode = await db.orgStructure.findUnique({
        where: { id: targetParentId },
      })
      if (parentNode) {
        calculatedLevel = parentNode.level + 1
        parentPath = parentNode.path || `/${parentNode.id}`
      }
    }

    const shouldSuspend = status === 'suspended' || status === 'SUSPENDED' || !!isSuspended
    const initialStatus = status ? status.toLowerCase() : (shouldSuspend ? 'suspended' : 'active')

    const newItem = await db.orgStructure.create({
      data: {
        code: code.trim(),
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        parentId: targetParentId,
        type: type || 'إدارة',
        level: calculatedLevel,
        notes: notes?.trim() || null,
        companyId: targetCompanyId,
        branchId: targetBranchId,
        costCenterId: targetCostCenterId,
        managerId: targetManagerId,
        status: initialStatus,
        active: initialStatus !== 'suspended' && initialStatus !== 'archived',
        suspendedBy: shouldSuspend ? 'admin' : null,
        suspendedAt: shouldSuspend ? new Date() : null,
        suspensionReason: shouldSuspend ? body.suspensionReason || 'تم إنشاء الهيكل بحالة موقوف' : null,
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      include: {
        parent: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        costCenter: { select: { id: true, code: true, nameAr: true } },
        manager: { select: { id: true, employeeNo: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { children: true, employees: true } },
      },
    })

    // Compute & update path
    const fullPath = parentPath ? `${parentPath}/${newItem.id}` : `/${newItem.id}`
    const updatedWithPath = await db.orgStructure.update({
      where: { id: newItem.id },
      data: { path: fullPath },
      include: {
        parent: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        costCenter: { select: { id: true, code: true, nameAr: true } },
        manager: { select: { id: true, employeeNo: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { children: true, employees: true } },
      },
    })

    await createAuditEntry({
      action: 'create',
      documentId: newItem.id,
      newValue: updatedWithPath,
      reason: 'إنشاء هيكل تنظيمي جديد',
    })

    return NextResponse.json({ ok: true, data: formatOrgItem(updatedWithPath) })
  } catch (err: any) {
    console.error('[OrgStructure POST Error]:', err)
    return NextResponse.json({ ok: false, message: err.message || 'فشل إضافة الهيكل التنظيمي' }, { status: 500 })
  }
}

// PUT: Update Existing Organizational Unit & Cascade Path/Level
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, code, nameAr, nameEn, parentId, type, notes, companyId, branchId, costCenterId, managerId, status, isSuspended, suspensionReason } = body

    if (!id) {
      return NextResponse.json({ ok: false, message: 'معرف الهيكل التنظيمي مطلوب' }, { status: 400 })
    }

    const existing = await db.orgStructure.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, message: 'الهيكل التنظيمي غير موجود بالنظام' }, { status: 400 })
    }

    // Code uniqueness check
    if (code && code.trim() !== existing.code) {
      const duplicateCode = await db.orgStructure.findUnique({
        where: { code: code.trim() },
      })
      if (duplicateCode) {
        return NextResponse.json({ ok: false, message: `كود الهيكل «${code}» مستخدم بالفعل` }, { status: 400 })
      }
    }

    // Sanitize Foreign Keys safely
    const targetParentId = parentId !== undefined
      ? await sanitizeForeignKey(parentId, async (pid) => {
          const p = await db.orgStructure.findUnique({ where: { id: pid }, select: { id: true } })
          return !!p
        })
      : existing.parentId

    const targetCostCenterId = costCenterId !== undefined
      ? await sanitizeForeignKey(costCenterId, async (cid) => {
          const c = await db.costCenter.findUnique({ where: { id: cid }, select: { id: true } })
          return !!c
        })
      : existing.costCenterId

    const targetManagerId = managerId !== undefined
      ? await sanitizeForeignKey(managerId, async (mid) => {
          const m = await db.employee.findUnique({ where: { id: mid }, select: { id: true } })
          return !!m
        })
      : existing.managerId

    const targetCompanyId = companyId !== undefined
      ? await sanitizeForeignKey(companyId, async (compid) => {
          const comp = await db.company.findUnique({ where: { id: compid }, select: { id: true } })
          return !!comp
        })
      : existing.companyId

    const targetBranchId = branchId !== undefined
      ? await sanitizeForeignKey(branchId, async (bid) => {
          const b = await db.branch.findUnique({ where: { id: bid }, select: { id: true } })
          return !!b
        })
      : existing.branchId

    // Circular Dependency Protection
    if (targetParentId && targetParentId !== existing.parentId) {
      const isCircular = await checkCircularDependency(id, targetParentId)
      if (isCircular) {
        return NextResponse.json(
          { ok: false, message: 'لا يمكن تعيين هذا الهيكل الأب: سيؤدي ذلك إلى مرجع دائري غير مسموح به في الهيكل الشجري' },
          { status: 400 }
        )
      }
    }

    let calculatedLevel = existing.level
    let parentPath = ''

    if (targetParentId) {
      const parentNode = await db.orgStructure.findUnique({
        where: { id: targetParentId },
      })
      if (parentNode) {
        calculatedLevel = parentNode.level + 1
        parentPath = parentNode.path || `/${parentNode.id}`
      }
    } else {
      calculatedLevel = 1
    }

    const newPath = parentPath ? `${parentPath}/${id}` : `/${id}`
    const shouldSuspend = isSuspended !== undefined ? !!isSuspended : (status === 'suspended' || status === 'SUSPENDED')
    const finalStatus = status ? status.toLowerCase() : (shouldSuspend ? 'suspended' : 'active')

    let newSuspensionCount = existing.suspensionCount
    if (shouldSuspend && existing.status !== 'suspended' && !existing.suspendedBy) {
      newSuspensionCount += 1
    }

    const updated = await db.orgStructure.update({
      where: { id },
      data: {
        code: code ? code.trim() : existing.code,
        nameAr: nameAr ? nameAr.trim() : existing.nameAr,
        nameEn: nameEn !== undefined ? nameEn : existing.nameEn,
        parentId: targetParentId,
        type: type || existing.type,
        level: calculatedLevel,
        path: newPath,
        notes: notes !== undefined ? notes : existing.notes,
        companyId: targetCompanyId,
        branchId: targetBranchId,
        costCenterId: targetCostCenterId,
        managerId: targetManagerId,
        status: finalStatus,
        active: finalStatus !== 'suspended' && finalStatus !== 'archived',
        suspendedBy: shouldSuspend ? 'admin' : null,
        suspendedAt: shouldSuspend ? (existing.suspendedAt || new Date()) : null,
        suspensionReason: shouldSuspend ? (suspensionReason || existing.suspensionReason || 'تم إيقاف الهيكل') : null,
        suspensionCount: newSuspensionCount,
        modificationCount: existing.modificationCount + 1,
        updatedBy: 'admin',
      },
      include: {
        parent: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        costCenter: { select: { id: true, code: true, nameAr: true } },
        manager: { select: { id: true, employeeNo: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { children: true, employees: true } },
      },
    })

    // Cascade path & level updates to all child subtrees
    await updateDescendantsPathAndLevel(id, newPath, calculatedLevel)

    await createAuditEntry({
      action: 'update',
      documentId: id,
      oldValue: existing,
      newValue: updated,
      reason: 'تحديث بيانات الهيكل التنظيمي',
    })

    return NextResponse.json({ ok: true, data: formatOrgItem(updated) })
  } catch (err: any) {
    console.error('[OrgStructure PUT Error]:', err)
    return NextResponse.json({ ok: false, message: err.message || 'فشل تحديث الهيكل التنظيمي' }, { status: 500 })
  }
}

// PATCH: Quick Status Toggle (Activate / Suspend / Archive)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, isSuspended, suspensionReason } = body

    if (!id) {
      return NextResponse.json({ ok: false, message: 'معرف الهيكل التنظيمي مطلوب' }, { status: 400 })
    }

    const existing = await db.orgStructure.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, message: 'الهيكل المطلوب غير موجود' }, { status: 404 })
    }

    let targetAction = action
    if (!targetAction && isSuspended !== undefined) {
      targetAction = isSuspended ? 'suspend' : 'activate'
    }

    let updateData: any = {}

    if (targetAction === 'suspend') {
      updateData = {
        status: 'suspended',
        active: false,
        suspendedBy: 'admin',
        suspendedAt: new Date(),
        suspensionReason: suspensionReason || existing.suspensionReason || 'توقف إداري موقت',
        suspensionCount: existing.status !== 'suspended' && !existing.suspendedBy ? existing.suspensionCount + 1 : existing.suspensionCount,
        modificationCount: existing.modificationCount + 1,
      }
    } else if (targetAction === 'activate') {
      updateData = {
        status: 'active',
        active: true,
        suspendedBy: null,
        suspendedAt: null,
        suspensionReason: null,
        modificationCount: existing.modificationCount + 1,
      }
    } else if (targetAction === 'archive') {
      updateData = {
        status: 'archived',
        active: false,
        modificationCount: existing.modificationCount + 1,
      }
    } else {
      return NextResponse.json({ ok: false, message: 'إجراء حالة غير معروف' }, { status: 400 })
    }

    const updated = await db.orgStructure.update({
      where: { id },
      data: updateData,
      include: {
        parent: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        costCenter: { select: { id: true, code: true, nameAr: true } },
        manager: { select: { id: true, employeeNo: true, nameAr: true } },
        branch: { select: { id: true, code: true, nameAr: true } },
        _count: { select: { children: true, employees: true } },
      },
    })

    await createAuditEntry({
      action: `status_${targetAction}`,
      documentId: id,
      oldValue: existing,
      newValue: updated,
      reason: `تغيير حالة الهيكل إلى ${targetAction}`,
    })

    return NextResponse.json({ ok: true, data: formatOrgItem(updated) })
  } catch (err: any) {
    console.error('[OrgStructure PATCH Error]:', err)
    return NextResponse.json({ ok: false, message: err.message || 'فشل تغيير حالة الهيكل' }, { status: 500 })
  }
}

// DELETE: Safe Deletion with Referential Protection
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let id = searchParams.get('id')

    if (!id) {
      try {
        const body = await req.json()
        id = body?.id || null
      } catch { }
    }

    if (!id) {
      return NextResponse.json({ ok: false, message: 'معرف الهيكل غير محدد' }, { status: 400 })
    }

    const existing = await db.orgStructure.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            employees: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, message: 'الهيكل المطلوب غير موجود' }, { status: 404 })
    }

    if (existing._count.children > 0) {
      return NextResponse.json(
        { ok: false, message: `لا يمكن حذف الهيكل «${existing.nameAr}» لاحتوائه على (${existing._count.children}) هياكل فرعية تابعة. يرجى إعادة توجيه التفرعات أو تعليق الهيكل.` },
        { status: 400 }
      )
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        { ok: false, message: `لا يمكن حذف الهيكل «${existing.nameAr}» لارتباطه بـ (${existing._count.employees}) موظفين مستندين بالنظام. قم بتغيير التبعية للموظفين أولاً أو توقيف الهيكل.` },
        { status: 400 }
      )
    }

    await db.orgStructure.delete({
      where: { id },
    })

    await createAuditEntry({
      action: 'delete',
      documentId: id,
      oldValue: existing,
      reason: 'حذف نهائي آمن للهيكل التنظيمي',
    })

    return NextResponse.json({ ok: true, message: 'تم حذف الهيكل التنظيمي بنجاح' })
  } catch (err: any) {
    console.error('[OrgStructure DELETE Error]:', err)
    return NextResponse.json({ ok: false, message: err.message || 'فشل حذف الهيكل التنظيمي' }, { status: 500 })
  }
}
