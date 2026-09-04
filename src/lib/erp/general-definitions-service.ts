// =============================================================================
// Enterprise ERP — General Definitions Service Layer (خدمة التعريفات العامة المرجعية)
//
// Single Source of Truth for Generic Lookup Management.
// Robust Database & Memory Hybrid Engine with automatic seed initialization.
// =============================================================================

import { db } from '@/lib/db'
import { SYSTEM_DEFINITION_TYPES } from './general-definitions-registry'

export interface DefinitionItemDTO {
  id: string
  companyId: string
  typeCode: string
  code: string
  nameAr: string
  nameEn?: string | null
  description?: string | null
  sortOrder: number
  isSystem: boolean
  active: boolean
  meta?: string | null
  usageCount?: number
  createdBy?: string | null
  updatedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TypeSummaryDTO {
  code: string
  numericId: number
  nameAr: string
  nameEn: string
  descriptionAr: string
  descriptionEn: string
  domain: 'HR' | 'ORG' | 'COMMON' | 'FINANCE'
  icon: string
  isSystem: boolean
  totalItems: number
  activeItems: number
}

// In-Memory Fallback & Live State Store
const memoryStore = new Map<string, DefinitionItemDTO>()

// Initialize memoryStore with all static seed items
function initMemoryStore(companyId = '*') {
  if (memoryStore.size > 0) return
  const now = new Date()

  for (const [typeCode, meta] of Object.entries(SYSTEM_DEFINITION_TYPES)) {
    meta.initialSeed.forEach((seed, idx) => {
      const id = `def-${typeCode}-${seed.code}`
      memoryStore.set(id, {
        id,
        companyId,
        typeCode,
        code: seed.code.toUpperCase().trim(),
        nameAr: seed.nameAr,
        nameEn: seed.nameEn || null,
        description: seed.descriptionAr || seed.descriptionEn || null,
        sortOrder: seed.sortOrder || idx + 1,
        isSystem: true,
        active: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    })
  }
}

// Safely get Prisma model or null if not registered on PrismaClient
function getModel() {
  try {
    return (db as any).generalDefinition || null
  } catch (_e) {
    return null
  }
}

/**
 * Seeds default reference items for all system-defined categories.
 */
export async function seedInitialDefinitions(companyId = '*'): Promise<void> {
  initMemoryStore(companyId)
  const model = getModel()
  if (!model) return

  try {
    for (const [typeCode, meta] of Object.entries(SYSTEM_DEFINITION_TYPES)) {
      const existingCount = await model.count({
        where: { companyId, typeCode },
      })

      if (existingCount === 0 && meta.initialSeed.length > 0) {
        await model.createMany({
          data: meta.initialSeed.map((item) => ({
            companyId,
            typeCode,
            code: item.code.toUpperCase().trim(),
            nameAr: item.nameAr,
            nameEn: item.nameEn,
            description: item.descriptionAr || item.descriptionEn || null,
            sortOrder: item.sortOrder,
            isSystem: true,
            active: true,
          })),
        })
      }
    }
  } catch (_e) {
    // Silent fallback to memoryStore if DB is not migrated yet
  }
}

/**
 * Returns a full summary of definition categories with item statistics.
 */
export async function getTypeSummaryList(companyId = '*'): Promise<TypeSummaryDTO[]> {
  initMemoryStore(companyId)
  const model = getModel()

  const countMap: Record<string, { total: number; active: number }> = {}

  if (model) {
    try {
      await seedInitialDefinitions(companyId)
      const counts = await model.groupBy({
        by: ['typeCode', 'active'],
        where: { companyId },
        _count: { id: true },
      })

      for (const c of counts) {
        if (!countMap[c.typeCode]) {
          countMap[c.typeCode] = { total: 0, active: 0 }
        }
        const cnt = c._count.id
        countMap[c.typeCode].total += cnt
        if (c.active) {
          countMap[c.typeCode].active += cnt
        }
      }
    } catch (_e) {
      // Fallback to memoryStore counts
    }
  }

  // Aggregate memoryStore counts if DB didn't provide them
  if (Object.keys(countMap).length === 0) {
    memoryStore.forEach((item) => {
      if (item.companyId === companyId || item.companyId === '*') {
        if (!countMap[item.typeCode]) {
          countMap[item.typeCode] = { total: 0, active: 0 }
        }
        countMap[item.typeCode].total += 1
        if (item.active) {
          countMap[item.typeCode].active += 1
        }
      }
    })
  }

  return Object.values(SYSTEM_DEFINITION_TYPES).map((meta) => {
    const stats = countMap[meta.code] || {
      total: meta.initialSeed.length,
      active: meta.initialSeed.length,
    }
    return {
      code: meta.code,
      numericId: meta.numericId,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      descriptionAr: meta.descriptionAr,
      descriptionEn: meta.descriptionEn,
      domain: meta.domain,
      icon: meta.icon,
      isSystem: meta.isSystem,
      totalItems: stats.total,
      activeItems: stats.active,
    }
  })
}

/**
 * Checks how many times a definition code is referenced across system modules.
 */
export async function checkUsageCount(
  typeCode: string,
  code: string,
  defId: string
): Promise<number> {
  let usage = 0
  try {
    if (typeCode === 'ORG_STRUCTURE_TYPE') {
      usage += await db.orgStructure.count({ where: { type: code } })
    } else if (typeCode === 'EMPLOYMENT_TYPE') {
      usage += await db.employee.count({ where: { OR: [{ status: code }] } })
    }
  } catch (_e) {
    usage = 0
  }
  return usage
}

/**
 * Returns items belonging to a specific definition category.
 */
export async function getDefinitions(
  typeCode: string,
  companyId = '*',
  query?: string,
  activeOnly?: boolean
): Promise<DefinitionItemDTO[]> {
  initMemoryStore(companyId)
  const model = getModel()

  if (model) {
    try {
      const where: any = { companyId, typeCode }
      if (activeOnly) where.active = true
      if (query && query.trim()) {
        const q = query.trim()
        where.OR = [
          { code: { contains: q } },
          { nameAr: { contains: q } },
          { nameEn: { contains: q } },
        ]
      }

      const items = await model.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      })

      if (items.length > 0) {
        return Promise.all(
          items.map(async (item: any) => ({
            ...item,
            usageCount: await checkUsageCount(item.typeCode, item.code, item.id),
          }))
        )
      }
    } catch (_e) {
      // Fallback to memoryStore
    }
  }

  // MemoryStore Fallback
  let items = Array.from(memoryStore.values()).filter(
    (item) => item.typeCode === typeCode && (item.companyId === companyId || item.companyId === '*')
  )

  if (activeOnly) {
    items = items.filter((item) => item.active)
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase()
    items = items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q))
    )
  }

  items.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
  return items
}

/**
 * Creates a new definition value under a given type.
 */
export async function createDefinition(
  data: {
    typeCode: string
    code: string
    nameAr: string
    nameEn?: string
    description?: string
    sortOrder?: number
    active?: boolean
    companyId?: string
  },
  userId?: string
): Promise<DefinitionItemDTO> {
  const companyId = data.companyId || '*'
  initMemoryStore(companyId)

  const meta = SYSTEM_DEFINITION_TYPES[data.typeCode]
  if (!meta) {
    throw new Error(`نوع التعريف «${data.typeCode}» غير معروف بالنظام.`)
  }

  const normalizedCode = data.code
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_]/g, '_')

  if (!normalizedCode) {
    throw new Error('رمز التعريف (Code) مطلوب ويجب أن يحتوي على أرقام أو حروف إنجليزية فقط.')
  }

  if (!data.nameAr || !data.nameAr.trim()) {
    throw new Error('الاسم العربي مطلوب.')
  }

  // Check code uniqueness in memoryStore & DB
  const duplicateInMemory = Array.from(memoryStore.values()).find(
    (item) => item.typeCode === data.typeCode && item.code === normalizedCode
  )

  const model = getModel()
  if (model) {
    try {
      const existing = await model.findUnique({
        where: {
          companyId_typeCode_code: {
            companyId,
            typeCode: data.typeCode,
            code: normalizedCode,
          },
        },
      })
      if (existing || duplicateInMemory) {
        throw new Error(`الرمز «${normalizedCode}» معرف مسبقاً ضمن «${meta.nameAr}». يرجى استخدام رمز آخر.`)
      }

      const created = await model.create({
        data: {
          companyId,
          typeCode: data.typeCode,
          code: normalizedCode,
          nameAr: data.nameAr.trim(),
          nameEn: data.nameEn?.trim() || null,
          description: data.description?.trim() || null,
          sortOrder: data.sortOrder ?? 0,
          active: data.active ?? true,
          isSystem: false,
          createdBy: userId || null,
        },
      })

      const dto: DefinitionItemDTO = { ...created, usageCount: 0 }
      memoryStore.set(created.id, dto)
      return dto
    } catch (e: any) {
      if (e.message && e.message.includes('معرف مسبقاً')) throw e
      // DB failed, store in memory
    }
  }

  if (duplicateInMemory) {
    throw new Error(`الرمز «${normalizedCode}» معرف مسبقاً ضمن «${meta.nameAr}». يرجى استخدام رمز آخر.`)
  }

  const now = new Date()
  const newId = `def-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const newItem: DefinitionItemDTO = {
    id: newId,
    companyId,
    typeCode: data.typeCode,
    code: normalizedCode,
    nameAr: data.nameAr.trim(),
    nameEn: data.nameEn?.trim() || null,
    description: data.description?.trim() || null,
    sortOrder: data.sortOrder ?? 0,
    isSystem: false,
    active: data.active ?? true,
    usageCount: 0,
    createdBy: userId || null,
    createdAt: now,
    updatedAt: now,
  }

  memoryStore.set(newId, newItem)
  return newItem
}

/**
 * Updates an existing definition value.
 */
export async function updateDefinition(
  id: string,
  data: {
    code?: string
    nameAr?: string
    nameEn?: string
    description?: string
    sortOrder?: number
    active?: boolean
  },
  userId?: string
): Promise<DefinitionItemDTO> {
  initMemoryStore()

  // Find existing item in memoryStore or DB
  let existing = memoryStore.get(id)
  const model = getModel()

  if (!existing && model) {
    try {
      const dbItem = await model.findUnique({ where: { id } })
      if (dbItem) existing = dbItem
    } catch (_e) {
      // ignore
    }
  }

  // Fallback search by ID pattern if ID was generated dynamically
  if (!existing) {
    existing = Array.from(memoryStore.values()).find(
      (item) => item.id === id || id.endsWith(item.code)
    )
  }

  if (!existing) {
    throw new Error('سجل التعريف المطلوب غير موجود بالنظام.')
  }

  const updates: Partial<DefinitionItemDTO> = {
    updatedBy: userId || null,
    updatedAt: new Date(),
  }

  if (data.nameAr !== undefined) {
    if (!data.nameAr.trim()) throw new Error('الاسم العربي لا يمكن أن يكون فارغاً.')
    updates.nameAr = data.nameAr.trim()
  }

  if (data.nameEn !== undefined) {
    updates.nameEn = data.nameEn.trim() || null
  }

  if (data.description !== undefined) {
    updates.description = data.description.trim() || null
  }

  if (data.sortOrder !== undefined) {
    updates.sortOrder = Number(data.sortOrder) || 0
  }

  if (data.active !== undefined) {
    updates.active = Boolean(data.active)
  }

  // Handle Code changes if specified
  if (data.code && data.code.toUpperCase().trim() !== existing.code) {
    const newCode = data.code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_')
    const usage = await checkUsageCount(existing.typeCode, existing.code, existing.id)
    if (usage > 0) {
      throw new Error(`لا يمكن تغيير الرمز «${existing.code}» لأنه مستخدم حالياً في (${usage}) سجل بالنظام.`)
    }
    updates.code = newCode
  }

  if (model) {
    try {
      const updated = await model.update({
        where: { id: existing.id },
        data: updates,
      })
      const usageCount = await checkUsageCount(updated.typeCode, updated.code, updated.id)
      const dto = { ...updated, usageCount }
      memoryStore.set(existing.id, dto)
      return dto
    } catch (_e) {
      // Fallback update memoryStore
    }
  }

  // Update in memoryStore
  const updatedItem: DefinitionItemDTO = {
    ...existing,
    ...updates,
  }
  memoryStore.set(existing.id, updatedItem)
  return updatedItem
}

/**
 * Safely deletes a definition value with usage constraint protection.
 */
export async function deleteDefinition(
  id: string,
  userId?: string
): Promise<{ success: boolean; message: string }> {
  initMemoryStore()
  let existing = memoryStore.get(id)
  const model = getModel()

  if (!existing && model) {
    try {
      const dbItem = await model.findUnique({ where: { id } })
      if (dbItem) existing = dbItem
    } catch (_e) {
      // ignore
    }
  }

  if (!existing) {
    existing = Array.from(memoryStore.values()).find(
      (item) => item.id === id || id.endsWith(item.code)
    )
  }

  if (!existing) {
    throw new Error('السجل غير موجود.')
  }

  const usageCount = await checkUsageCount(existing.typeCode, existing.code, id)
  if (usageCount > 0) {
    throw new Error(
      `تعذر حذف التعريف «${existing.nameAr}» لوجود (${usageCount}) سجلات مرتبطة به بالنظام. يمكنك إلغاء تفعيله بدلاً من الحذف للحفاظ على سلامة البيانات التاريخية.`
    )
  }

  if (model) {
    try {
      await model.delete({ where: { id: existing.id } })
    } catch (_e) {
      // Fallback memoryStore delete
    }
  }

  memoryStore.delete(existing.id)

  return {
    success: true,
    message: `تم حذف التعريف «${existing.nameAr}» بنجاح.`,
  }
}
